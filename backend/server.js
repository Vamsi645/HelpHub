require('dotenv').config();

const bcrypt = require('bcryptjs');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');

const app = express();
const port = Number(process.env.PORT || 5000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const jwtPlaceholder = 'replace_with_a_long_random_secret';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  return secret && secret !== jwtPlaceholder && Buffer.byteLength(secret, 'utf8') >= 32 ? secret : null;
}

app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: '30kb' }));

const endpoint = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validBody = (body) => body !== null && typeof body === 'object' && !Array.isArray(body);
const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });
const bookingDetails = `SELECT b.id, b.customer_id AS customerId, b.service_id AS serviceId,
  b.worker_id AS workerId, b.service_address AS serviceAddress,
  b.scheduled_at AS scheduledAt, b.price_at_booking AS priceAtBooking, b.status,
  s.name AS serviceName, worker.name AS workerName
  FROM bookings AS b
  INNER JOIN services AS s ON s.id = b.service_id
  LEFT JOIN worker_profiles AS wp ON wp.id = b.worker_id
  LEFT JOIN users AS worker ON worker.id = wp.user_id`;

const authenticate = endpoint(async (req, res, next) => {
  const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ message: 'A bearer token is required.' });
  const secret = getJwtSecret();
  if (!secret) return res.status(500).json({ message: 'Authentication is not configured on the server.' });

  let payload;
  try {
    payload = jwt.verify(match[1], secret);
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'The token has expired. Please sign in again.' : 'The token is invalid.';
    return res.status(401).json({ message });
  }
  const [users] = await pool.execute('SELECT id, name, email, role FROM users WHERE id = ?', [payload.sub]);
  if (!users.length) return res.status(401).json({ message: 'The account for this token no longer exists.' });
  req.user = users[0];
  next();
});

const allow = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to access this resource.' });
  }
  next();
};

function createToken(id) {
  const secret = getJwtSecret();
  if (!secret) throw new Error('Authentication is not configured on the server.');
  return jwt.sign({}, secret, { subject: String(id), expiresIn: '1d' });
}

function futureDate(value) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now()
    ? null
    : date.toISOString().slice(0, 19).replace('T', ' ');
}

app.post('/api/auth/register', endpoint(async (req, res) => {
  const body = validBody(req.body) ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = body.role === undefined ? 'customer' : body.role;
  const serviceArea = typeof body.serviceArea === 'string' ? body.serviceArea.trim() : '';
  const years = body.experienceYears === undefined ? 0 : Number(body.experienceYears);
  if (!getJwtSecret()) return res.status(500).json({ message: 'Authentication is not configured on the server.' });
  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    return res.status(400).json({ message: 'Enter a name and a valid email address.' });
  }
  if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Password must be between 8 and 72 bytes.' });
  }
  if (!['customer', 'worker'].includes(role)) return res.status(400).json({ message: 'Register as a customer or worker.' });
  if (role === 'worker' && (!Number.isInteger(years) || years < 0 || years > 60 || serviceArea.length > 255)) {
    return res.status(400).json({ message: 'Enter a valid service area and 0 to 60 years of experience.' });
  }

  let connection;
  try {
    const hash = await bcrypt.hash(password, 12);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, role]
    );
    if (role === 'worker') {
      await connection.execute(
        'INSERT INTO worker_profiles (user_id, experience_years, service_area) VALUES (?, ?, ?)',
        [result.insertId, years, serviceArea]
      );
    }
    await connection.commit();
    const user = { id: result.insertId, name, email, role };
    res.status(201).json({ user, token: createToken(user.id) });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An account with this email already exists.' });
    throw error;
  } finally {
    if (connection) connection.release();
  }
}));

app.post('/api/auth/login', endpoint(async (req, res) => {
  const body = validBody(req.body) ? req.body : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!getJwtSecret()) return res.status(500).json({ message: 'Authentication is not configured on the server.' });
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
  const [users] = await pool.execute(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  if (!users.length || !(await bcrypt.compare(password, users[0].password_hash))) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }
  const user = publicUser(users[0]);
  res.json({ user, token: createToken(user.id) });
}));

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/auth/logout', authenticate, (req, res) => res.json({ message: 'Signed out.' }));

app.get('/api/services', endpoint(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search.length > 100) return res.status(400).json({ message: 'Search text must be 100 characters or fewer.' });
  const searchClause = search ? 'AND (s.name LIKE ? OR c.name LIKE ?)' : '';
  const term = `%${search}%`;
  const [services] = await pool.execute(
    `SELECT s.id, s.name, s.description, s.image_url, s.base_price,
            c.id AS category_id, c.name AS category_name
     FROM services AS s INNER JOIN service_categories AS c ON c.id = s.category_id
     WHERE s.is_active = TRUE ${searchClause}
     ORDER BY c.name, s.name`,
    search ? [term, term] : []
  );
  res.json({ services });
}));

app.get('/api/workers', endpoint(async (req, res) => {
  const availability = req.query.availability || 'all';
  if (!['all', 'available', 'unavailable'].includes(availability)) {
    return res.status(400).json({ message: 'Availability must be all, available, or unavailable.' });
  }
  const where = availability === 'all' ? '' : 'WHERE wp.availability = ?';
  const [workers] = await pool.execute(
    `SELECT wp.id, u.id AS userId, u.name, wp.experience_years AS experienceYears,
            wp.service_area AS serviceArea, wp.availability
     FROM worker_profiles AS wp INNER JOIN users AS u ON u.id = wp.user_id
     ${where} ORDER BY (wp.availability = 'available') DESC, u.name`,
    availability === 'all' ? [] : [availability]
  );
  res.json({ workers });
}));

app.get('/api/workers/me', authenticate, allow('worker'), endpoint(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT wp.id, wp.user_id AS userId, u.name, u.email,
            wp.experience_years AS experienceYears, wp.service_area AS serviceArea, wp.availability
     FROM worker_profiles AS wp INNER JOIN users AS u ON u.id = wp.user_id
     WHERE wp.user_id = ?`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Worker profile was not found.' });
  res.json({ worker: rows[0] });
}));

app.patch('/api/workers/me', authenticate, allow('worker'), endpoint(async (req, res) => {
  const body = validBody(req.body) ? req.body : null;
  if (!body) return res.status(400).json({ message: 'Request body must be a JSON object.' });
  const updates = [];
  const values = [];
  if (Object.hasOwn(body, 'experienceYears')) {
    const years = Number(body.experienceYears);
    if (!Number.isInteger(years) || years < 0 || years > 60) return res.status(400).json({ message: 'Experience must be 0 to 60 years.' });
    updates.push('experience_years = ?');
    values.push(years);
  }
  if (Object.hasOwn(body, 'serviceArea')) {
    if (typeof body.serviceArea !== 'string' || body.serviceArea.trim().length > 255) return res.status(400).json({ message: 'Service area must be at most 255 characters.' });
    updates.push('service_area = ?');
    values.push(body.serviceArea.trim());
  }
  if (Object.hasOwn(body, 'availability')) {
    if (!['available', 'unavailable'].includes(body.availability)) return res.status(400).json({ message: 'Choose available or unavailable.' });
    updates.push('availability = ?');
    values.push(body.availability);
  }
  if (!updates.length) return res.status(400).json({ message: 'Provide a profile field to update.' });
  values.push(req.user.id);
  await pool.execute(`UPDATE worker_profiles SET ${updates.join(', ')} WHERE user_id = ?`, values);
  const [rows] = await pool.execute(
    `SELECT wp.id, wp.user_id AS userId, u.name, u.email,
            wp.experience_years AS experienceYears, wp.service_area AS serviceArea, wp.availability
     FROM worker_profiles AS wp INNER JOIN users AS u ON u.id = wp.user_id WHERE wp.user_id = ?`,
    [req.user.id]
  );
  res.json({ worker: rows[0] });
}));

app.post('/api/bookings', authenticate, allow('customer'), endpoint(async (req, res) => {
  const body = validBody(req.body) ? req.body : null;
  if (!body) return res.status(400).json({ message: 'Request body must be a JSON object.' });
  const serviceId = parseId(body.serviceId);
  const workerId = body.workerId ? parseId(body.workerId) : null;
  const serviceAddress = typeof body.serviceAddress === 'string' ? body.serviceAddress.trim() : '';
  const scheduledAt = futureDate(body.scheduledAt);
  if (!serviceId || (body.workerId && !workerId)) return res.status(400).json({ message: 'Choose a valid service and worker.' });
  if (!serviceAddress || serviceAddress.length > 500) return res.status(400).json({ message: 'Enter a service address of at most 500 characters.' });
  if (!scheduledAt) return res.status(400).json({ message: 'Choose a valid future date and time.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [services] = await connection.execute('SELECT id, base_price FROM services WHERE id = ? AND is_active = TRUE FOR UPDATE', [serviceId]);
    if (!services.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Service is not available.' });
    }
    if (workerId) {
      const [workers] = await connection.execute("SELECT id FROM worker_profiles WHERE id = ? AND availability = 'available' FOR UPDATE", [workerId]);
      if (!workers.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'That worker is not available.' });
      }
    }
    const [result] = await connection.execute(
      `INSERT INTO bookings (customer_id, service_id, worker_id, service_address, scheduled_at, price_at_booking, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, serviceId, workerId, serviceAddress, scheduledAt, services[0].base_price]
    );
    await connection.commit();
    res.status(201).json({ booking: { id: result.insertId, serviceId, workerId, scheduledAt, priceAtBooking: services[0].base_price, status: 'pending' } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.get('/api/bookings/mine', authenticate, allow('customer'), endpoint(async (req, res) => {
  const [bookings] = await pool.execute(`${bookingDetails} WHERE b.customer_id = ? ORDER BY b.scheduled_at DESC`, [req.user.id]);
  res.json({ bookings });
}));

app.get('/api/bookings/worker', authenticate, allow('worker'), endpoint(async (req, res) => {
  const [bookings] = await pool.execute(
    `${bookingDetails}
     INNER JOIN worker_profiles AS assigned_profile ON assigned_profile.id = b.worker_id
     WHERE assigned_profile.user_id = ? ORDER BY b.scheduled_at ASC`,
    [req.user.id]
  );
  res.json({ bookings });
}));

app.post('/api/bookings/:bookingId/cancel', authenticate, allow('customer'), endpoint(async (req, res) => {
  const bookingId = parseId(req.params.bookingId);
  if (!bookingId) return res.status(400).json({ message: 'Invalid booking ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT status FROM bookings WHERE id = ? AND customer_id = ? FOR UPDATE', [bookingId, req.user.id]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Booking was not found.' });
    }
    if (!['pending', 'confirmed'].includes(rows[0].status)) {
      await connection.rollback();
      return res.status(409).json({ message: 'Only pending or confirmed bookings can be cancelled.' });
    }
    await connection.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);
    await connection.commit();
    res.json({ message: 'Booking cancelled.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.patch('/api/bookings/:bookingId/status', authenticate, allow('worker'), endpoint(async (req, res) => {
  const bookingId = parseId(req.params.bookingId);
  const nextStatus = validBody(req.body) ? req.body.status : null;
  const transitions = { pending: 'confirmed', confirmed: 'in_progress', in_progress: 'completed' };
  if (!bookingId || !Object.values(transitions).includes(nextStatus)) return res.status(400).json({ message: 'Choose a valid booking status.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT b.status FROM bookings AS b
       INNER JOIN worker_profiles AS wp ON wp.id = b.worker_id
       WHERE b.id = ? AND wp.user_id = ? FOR UPDATE`,
      [bookingId, req.user.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Assigned booking was not found.' });
    }
    if (transitions[rows[0].status] !== nextStatus) {
      await connection.rollback();
      return res.status(409).json({ message: `Cannot change booking from ${rows[0].status} to ${nextStatus}.` });
    }
    await connection.execute('UPDATE bookings SET status = ? WHERE id = ?', [nextStatus, bookingId]);
    await connection.commit();
    res.json({ status: nextStatus });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.get('/api/admin/dashboard', authenticate, allow('admin'), endpoint(async (req, res) => {
  const [[summary]] = await pool.execute(
    `SELECT COUNT(*) AS totalBookings,
            COALESCE(SUM(status = 'pending'), 0) AS pendingBookings,
            COALESCE(SUM(status = 'completed'), 0) AS completedBookings,
            (SELECT COUNT(*) FROM users WHERE role IN ('customer', 'worker')) AS enrolledPeople,
            (SELECT COUNT(*) FROM users WHERE role = 'customer') AS enrolledCustomers,
            (SELECT COUNT(*) FROM users WHERE role = 'worker') AS enrolledWorkers,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN price_at_booking ELSE 0 END), 0) AS totalRevenue
     FROM bookings`
  );
  res.json({ summary });
}));

app.get('/api/admin/users', authenticate, allow('admin'), endpoint(async (req, res) => {
  const [users] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.role, u.created_at AS enrolledAt,
            wp.experience_years AS experienceYears, wp.service_area AS serviceArea, wp.availability
     FROM users AS u LEFT JOIN worker_profiles AS wp ON wp.user_id = u.id
     WHERE u.role IN ('customer', 'worker') ORDER BY u.created_at DESC LIMIT 200`
  );
  res.json({ users });
}));

app.get('/api/admin/bookings', authenticate, allow('admin'), endpoint(async (req, res) => {
  const [bookings] = await pool.execute(
    `SELECT b.id, b.status, b.scheduled_at AS scheduledAt,
            b.service_address AS serviceAddress, b.price_at_booking AS priceAtBooking,
            customer.name AS customerName, s.name AS serviceName,
            wp.id AS workerId, worker.name AS workerName
     FROM bookings AS b INNER JOIN users AS customer ON customer.id = b.customer_id
     INNER JOIN services AS s ON s.id = b.service_id
     LEFT JOIN worker_profiles AS wp ON wp.id = b.worker_id
     LEFT JOIN users AS worker ON worker.id = wp.user_id
     ORDER BY b.created_at DESC LIMIT 200`
  );
  res.json({ bookings });
}));

app.get('/api/admin/workers', authenticate, allow('admin'), endpoint(async (req, res) => {
  const [workers] = await pool.execute(
    `SELECT wp.id, u.name FROM worker_profiles AS wp
     INNER JOIN users AS u ON u.id = wp.user_id
     WHERE wp.availability = 'available' ORDER BY u.name`
  );
  res.json({ workers });
}));

app.patch('/api/admin/bookings/:bookingId/assign', authenticate, allow('admin'), endpoint(async (req, res) => {
  const bookingId = parseId(req.params.bookingId);
  const workerId = validBody(req.body) ? parseId(req.body.workerId) : null;
  if (!bookingId || !workerId) return res.status(400).json({ message: 'Choose a valid booking and worker.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [bookings] = await connection.execute('SELECT status FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
    if (!bookings.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Booking was not found.' });
    }
    if (bookings[0].status !== 'pending') {
      await connection.rollback();
      return res.status(409).json({ message: 'Only pending bookings can be assigned.' });
    }
    const [workers] = await connection.execute("SELECT id FROM worker_profiles WHERE id = ? AND availability = 'available' FOR UPDATE", [workerId]);
    if (!workers.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'Worker is not available.' });
    }
    await connection.execute('UPDATE bookings SET worker_id = ? WHERE id = ?', [workerId, bookingId]);
    await connection.commit();
    res.json({ workerId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.patch('/api/admin/bookings/:bookingId/status', authenticate, allow('admin'), endpoint(async (req, res) => {
  const bookingId = parseId(req.params.bookingId);
  const status = validBody(req.body) ? req.body.status : null;
  const allowedNext = { pending: ['confirmed', 'cancelled'], confirmed: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [] };
  if (!bookingId || !Object.hasOwn(allowedNext, status)) return res.status(400).json({ message: 'Choose a valid booking status.' });
  const [rows] = await pool.execute('SELECT status FROM bookings WHERE id = ?', [bookingId]);
  if (!rows.length) return res.status(404).json({ message: 'Booking was not found.' });
  if (!allowedNext[rows[0].status].includes(status)) return res.status(409).json({ message: `Cannot change booking from ${rows[0].status} to ${status}.` });
  await pool.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId]);
  res.json({ status });
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HelpHub API is running.' });
});

app.get('/api/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', message: 'Database connection is working.' });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({
      status: 'error',
      message: 'Database is unavailable. Check the backend configuration and MySQL service.'
    });
  }
});

app.use((req, res) => res.status(404).json({ message: 'API route was not found.' }));
app.use((error, req, res, next) => {
  console.error('Request failed:', error.message);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body must be valid JSON.' });
  res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'An unexpected server error occurred.' });
});

app.listen(port, () => {
  console.log(`HelpHub API listening at http://localhost:${port}`);
});
