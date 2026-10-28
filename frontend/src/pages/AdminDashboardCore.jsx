import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';

const nextStatuses = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function AdminDashboard({ user, onBack, onSignOut }) {
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const [dashboard, bookingList, workerList, userList] = await Promise.all([
      apiRequest('/admin/dashboard'),
      apiRequest('/admin/bookings'),
      apiRequest('/admin/workers'),
      apiRequest('/admin/users')
    ]);
    setSummary(dashboard.summary);
    setBookings(bookingList.bookings);
    setWorkers(workerList.workers);
    setUsers(userList.users);
  }, []);

  useEffect(() => {
    refresh()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function updateBooking(bookingId, change) {
    setSavingId(bookingId);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/bookings/${bookingId}/${change.type}`, {
        method: 'PATCH',
        body: change.body
      });
      await refresh();
      setNotice(`Booking #${bookingId} updated.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="simple-admin-page">
      <header className="topbar catalog-topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }} aria-label="Back to services">
          <span className="brand-mark">H</span>HelpHub
        </a>
        <div className="admin-user"><span>{user.name} · Admin</span><button onClick={onSignOut}>Sign out</button></div>
      </header>

      <section className="simple-admin-content">
        <div className="admin-page-heading">
          <div><p className="eyebrow">ADMIN</p><h1>Dashboard</h1></div>
          <button className="admin-refresh" type="button" onClick={() => refresh().catch((requestError) => setError(requestError.message))}>Refresh</button>
        </div>
        {error && <p className="form-message error-message" role="alert">{error}</p>}
        {notice && <p className="form-message success-message" role="status">{notice}</p>}
        {loading && <p className="catalog-message">Loading dashboard...</p>}

        {!loading && summary && (
          <>
            <div className="simple-admin-metrics">
              <article><span>Total bookings</span><strong>{Number(summary.totalBookings)}</strong></article>
              <article><span>Pending</span><strong>{Number(summary.pendingBookings)}</strong></article>
              <article><span>Completed</span><strong>{Number(summary.completedBookings)}</strong></article>
              <article><span>Enrolled people</span><strong>{Number(summary.enrolledPeople)}</strong></article>
              <article><span>Customers</span><strong>{Number(summary.enrolledCustomers)}</strong></article>
              <article><span>Workers</span><strong>{Number(summary.enrolledWorkers)}</strong></article>
              <article><span>Completed revenue</span><strong>{money.format(Number(summary.totalRevenue))}</strong></article>
            </div>
            <section className="simple-admin-users">
              <div className="section-heading"><h2>Recent enrollments</h2><span>{users.length} accounts</span></div>
              {users.length === 0 && <p className="catalog-message">No customers or workers have enrolled yet.</p>}
              {users.slice(0, 8).map((enrolledUser) => (
                <article className="simple-admin-user" key={enrolledUser.id}>
                  <div><strong>{enrolledUser.name}</strong><span>{enrolledUser.email}</span></div>
                  <span className="enrollment-role">{enrolledUser.role}</span>
                  {enrolledUser.role === 'worker' && <span>{enrolledUser.experienceYears} years · {enrolledUser.serviceArea || 'No service area'}</span>}
                  <time>{new Date(enrolledUser.enrolledAt).toLocaleDateString()}</time>
                </article>
              ))}
            </section>
            <section className="simple-admin-bookings">
              <div className="section-heading"><h2>Bookings</h2><span>{bookings.length} total</span></div>
              {bookings.length === 0 && <p className="catalog-message">There are no bookings yet.</p>}
              {bookings.map((booking) => (
                <article className="simple-admin-booking" key={booking.id}>
                  <div className="simple-admin-booking-main">
                    <div><strong>#{booking.id} · {booking.serviceName}</strong><span>{booking.customerName} · {booking.serviceAddress}</span><span>{new Date(booking.scheduledAt).toLocaleString()} · {money.format(Number(booking.priceAtBooking))}</span></div>
                    <span className={`booking-status ${booking.status}`}>{booking.status.replace('_', ' ')}</span>
                  </div>
                  <div className="simple-admin-actions">
                    {booking.status === 'pending' && (
                      <label>Assign worker
                        <select value={booking.workerId || ''} disabled={savingId === booking.id} onChange={(event) => event.target.value && updateBooking(booking.id, { type: 'assign', body: { workerId: Number(event.target.value) } })}>
                          <option value="">Choose worker</option>
                          {workers.filter((worker) => worker.availability === 'available').map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                        </select>
                      </label>
                    )}
                    {nextStatuses[booking.status]?.length > 0 && (
                      <label>Update status
                        <select value={booking.status} disabled={savingId === booking.id} onChange={(event) => event.target.value !== booking.status && updateBooking(booking.id, { type: 'status', body: { status: event.target.value } })}>
                          <option value={booking.status}>{booking.status.replace('_', ' ')}</option>
                          {nextStatuses[booking.status].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                        </select>
                      </label>
                    )}
                    {booking.workerName && <span className="assigned-worker">Worker: {booking.workerName}</span>}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
