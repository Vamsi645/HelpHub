import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';

export default function WorkerDashboard({ user, onBack }) {
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ experienceYears: '0', serviceArea: '', availability: 'available' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadWorkerData = useCallback(async () => {
    const [profileResult, bookingsResult] = await Promise.all([
      apiRequest('/workers/me'),
      apiRequest('/bookings/worker')
    ]);
    setProfile(profileResult.worker);
    setForm({
      experienceYears: String(profileResult.worker.experienceYears),
      serviceArea: profileResult.worker.serviceArea,
      availability: profileResult.worker.availability
    });
    setBookings(bookingsResult.bookings);
  }, []);

  useEffect(() => {
    loadWorkerData()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [loadWorkerData]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/workers/me', {
        method: 'PATCH',
        body: {
          experienceYears: Number(form.experienceYears),
          serviceArea: form.serviceArea,
          availability: form.availability
        }
      });
      setProfile(result.worker);
      setNotice('Your profile has been updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateBookingStatus(bookingId, status) {
    setError('');
    setNotice('');
    try {
      await apiRequest(`/bookings/${bookingId}/status`, { method: 'PATCH', body: { status } });
      await loadWorkerData();
      setNotice('Booking status updated.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="worker-dashboard-page">
      <header className="topbar catalog-topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }} aria-label="Back to services"><span className="brand-mark">H</span>HelpHub</a>
        <span className="topbar-note">WORKER PROFILE</span>
      </header>
      <section className="worker-dashboard-content">
        <button className="back-link" type="button" onClick={onBack}>← Back to services</button>
        <p className="eyebrow">YOUR PROFESSIONAL PROFILE</p>
        <h1>{user.name}</h1>
        <p className="profile-intro">Update the details customers see when they explore local professionals.</p>
        {loading && <p className="catalog-message">Loading your profile...</p>}
        {!loading && profile && (
          <form className="profile-form" onSubmit={saveProfile}>
            <label>
              Experience (years)
              <input name="experienceYears" type="number" min="0" max="60" step="1" value={form.experienceYears} onChange={updateField} required />
            </label>
            <label>
              Service area
              <input name="serviceArea" value={form.serviceArea} onChange={updateField} maxLength={255} placeholder="City or neighborhood" />
            </label>
            <label>
              Availability
              <select name="availability" value={form.availability} onChange={updateField}>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            {error && <p className="form-message error-message" role="alert">{error}</p>}
            {notice && <p className="form-message success-message" role="status">{notice}</p>}
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
          </form>
        )}
        {!loading && !profile && !error && <p className="catalog-message">No worker profile is linked to this account.</p>}
        <p className="account-email">Signed in as {user.email}</p>
        {profile && (
          <div className="worker-tasks">
            <section>
              <div className="worker-section-heading"><h2>Assigned bookings</h2><span>{bookings.length}</span></div>
              {bookings.length === 0 && <p className="catalog-message">No assigned bookings yet.</p>}
              {bookings.map((booking) => {
                const nextStatus = { pending: 'confirmed', confirmed: 'in_progress', in_progress: 'completed' }[booking.status];
                const nextLabel = { pending: 'Accept booking', confirmed: 'Start service', in_progress: 'Mark complete' }[booking.status];
                return (
                  <article className="worker-booking-row" key={booking.id}>
                    <div className="booking-card-heading">
                      <div><p className="service-category">{booking.serviceName}</p><h3>Booking #{booking.id}</h3></div>
                      <span className={`booking-status ${booking.status}`}>{booking.status.replace('_', ' ')}</span>
                    </div>
                    <p className="worker-booking-info">{booking.serviceAddress}</p>
                    <p className="worker-booking-info">{new Date(booking.scheduledAt).toLocaleString()}</p>
                    {nextStatus && <button className="filter-submit" type="button" onClick={() => updateBookingStatus(booking.id, nextStatus)}>{nextLabel}</button>}
                  </article>
                );
              })}
            </section>
          </div>
        )}
      </section>
      <footer className="page-footer"><span>© HelpHub</span><span>Home services, with care.</span></footer>
    </main>
  );
}
