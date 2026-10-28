import { lazy, Suspense, useEffect, useState } from 'react';
import { apiRequest } from './services/api.js';
import Home from './pages/Home.jsx';
import WorkerDashboard from './pages/WorkerDashboard.jsx';
import BookingForm from './pages/BookingForm.jsx';
import CustomerBookings from './pages/CustomerBookings.jsx';

const AdminDashboard = lazy(() => import('./pages/AdminDashboardCore.jsx'));

const initialForm = { name: '', email: '', password: '', serviceArea: '', experienceYears: '0' };

export default function App() {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('customer');
  const [form, setForm] = useState(initialForm);
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState('home');
  const [selectedService, setSelectedService] = useState(null);
  const [bookingNotice, setBookingNotice] = useState('');

  useEffect(() => {
    if (!sessionStorage.getItem('helphub-token')) {
      setCheckingSession(false);
      return;
    }

    apiRequest('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => sessionStorage.removeItem('helphub-token'))
      .finally(() => setCheckingSession(false));
  }, []);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    const body = mode === 'register'
      ? {
          name: form.name,
          email: form.email,
          password: form.password,
          role,
          ...(role === 'worker' ? {
            serviceArea: form.serviceArea,
            experienceYears: Number(form.experienceYears)
          } : {})
        }
      : { email: form.email, password: form.password };

    try {
      const result = await apiRequest(`/auth/${mode}`, { method: 'POST', body });
      sessionStorage.setItem('helphub-token', result.token);
      setUser(result.user);
      setForm(initialForm);
      setNotice(mode === 'register' ? 'Your account has been created.' : 'You are signed in.');
      setView('home');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // The local session is cleared even if the server is unavailable.
    }
    sessionStorage.removeItem('helphub-token');
    setUser(null);
    setMode('login');
    setView('home');
    setNotice('You have signed out.');
    setError('');
  }

  if (checkingSession) {
    return <main className="page-shell"><p className="loading-text">Checking your session...</p></main>;
  }

  if (view === 'worker-profile' && user?.role === 'worker') {
    return <WorkerDashboard user={user} onBack={() => setView('home')} />;
  }

  if (view === 'booking-form' && user?.role === 'customer' && selectedService) {
    return <BookingForm
      service={selectedService}
      onBack={() => setView('home')}
      onCreated={(booking) => {
        setBookingNotice(`Booking #${booking.id} has been requested.`);
        setView('customer-bookings');
      }}
    />;
  }

  if (view === 'customer-bookings' && user?.role === 'customer') {
    return <CustomerBookings onBack={() => setView('home')} initialNotice={bookingNotice} />;
  }

  if (view === 'admin-dashboard' && user?.role === 'admin') {
    return <Suspense fallback={<main className="page-shell"><p className="loading-text">Loading admin dashboard...</p></main>}>
      <AdminDashboard user={user} onBack={() => setView('home')} onSignOut={handleLogout} />
    </Suspense>;
  }

  if (view === 'home') {
    return <Home
      user={user}
      onSignIn={() => { setView('auth'); setError(''); setNotice(''); }}
      onSignOut={handleLogout}
      onManageProfile={() => setView('worker-profile')}
      onViewBookings={() => { setBookingNotice(''); setView('customer-bookings'); }}
      onOpenAdmin={() => setView('admin-dashboard')}
      onBook={(service) => {
        if (user?.role === 'customer') {
          setSelectedService(service);
          setView('booking-form');
        } else if (!user) {
          setView('auth');
        }
      }}
    />;
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setView('home'); }} aria-label="Back to services"><span className="brand-mark">H</span>HelpHub</a>
        <span className="topbar-note">A-Z HOME SERVICES</span>
      </header>

      <section className="auth-layout" aria-labelledby="page-title">
        <div className="intro-panel">
          <p className="eyebrow">LOCAL HELP, MADE SIMPLE</p>
          <h1 id="page-title">A better day<br />starts at home.</h1>
          <p className="intro-copy">Connect with trusted people for the work that keeps home running.</p>
          <div className="intro-rule"><span /> SERVICE · CARE · COMFORT</div>
        </div>

        <div className="auth-panel">
          {user ? (
            <div className="signed-in">
              <p className="eyebrow">ACCOUNT CONNECTED</p>
              <h2>Welcome, {user.name}.</h2>
              <p className="account-email">{user.email}</p>
              <span className="role-label">{user.role}</span>
              <p className="auth-note">Your account is authenticated by the HelpHub API.</p>
              <button className="primary-button" onClick={handleLogout}>Sign out</button>
            </div>
          ) : (
            <>
              <p className="eyebrow">YOUR HELPHUB ACCOUNT</p>
              <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
              <p className="form-intro">{mode === 'login' ? 'Sign in to continue.' : 'A few details and you’re ready to begin.'}</p>

              <div className="mode-switch" aria-label="Account action">
                <button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Sign in</button>
                <button className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); setNotice(''); }}>Register</button>
              </div>

              {mode === 'register' && (
                <div className="role-switch" aria-label="Account type">
                  <button className={role === 'customer' ? 'selected' : ''} onClick={() => setRole('customer')}>Customer</button>
                  <button className={role === 'worker' ? 'selected' : ''} onClick={() => setRole('worker')}>Worker</button>
                </div>
              )}

              <form className="auth-form" onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <label>
                    Full name
                    <input name="name" value={form.name} onChange={updateField} autoComplete="name" maxLength={120} required />
                  </label>
                )}
                <label>
                  Email address
                  <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" maxLength={255} required />
                </label>
                <label>
                  Password
                  <input name="password" type="password" value={form.password} onChange={updateField} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={72} required />
                </label>
                {mode === 'register' && role === 'worker' && (
                  <div className="worker-fields">
                    <label>
                      Service area
                      <input name="serviceArea" value={form.serviceArea} onChange={updateField} maxLength={255} placeholder="City or neighborhood" />
                    </label>
                    <label>
                      Experience (years)
                      <input name="experienceYears" type="number" value={form.experienceYears} onChange={updateField} min="0" max="60" step="1" />
                    </label>
                  </div>
                )}
                {error && <p className="form-message error-message" role="alert">{error}</p>}
                {notice && <p className="form-message success-message" role="status">{notice}</p>}
                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>
              <p className="auth-note">Admin accounts are created privately by the project administrator.</p>
            </>
          )}
        </div>
      </section>
      <footer className="page-footer"><span>© HelpHub</span><span>Home services, with care.</span></footer>
    </main>
  );
}
