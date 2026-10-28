import { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CustomerBookings({ onBack, initialNotice = '' }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice);

  async function loadBookings() {
    const result = await apiRequest('/bookings/mine');
    setBookings(result.bookings);
  }

  useEffect(() => {
    loadBookings()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  async function cancelBooking(bookingId) {
    setBusyId(bookingId);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/bookings/${bookingId}/cancel`, { method: 'POST' });
      await loadBookings();
      setNotice(`Booking #${bookingId} cancelled.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="worker-dashboard-page">
      <header className="topbar catalog-topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }} aria-label="Back to services"><span className="brand-mark">H</span>HelpHub</a>
        <span className="topbar-note">MY BOOKINGS</span>
      </header>
      <section className="booking-dashboard-content">
        <button className="back-link" type="button" onClick={onBack}>← Back to services</button>
        <p className="eyebrow">CUSTOMER ACCOUNT</p>
        <div className="section-heading"><h1>My bookings</h1><p className="result-count">{bookings.length} total</p></div>
        {error && <p className="form-message error-message" role="alert">{error}</p>}
        {notice && <p className="form-message success-message" role="status">{notice}</p>}
        {loading && <p className="catalog-message">Loading bookings...</p>}
        {!loading && bookings.length === 0 && <div className="catalog-empty"><h3>No bookings yet</h3><p>Your service requests will appear here.</p></div>}
        <div className="booking-list">
          {bookings.map((booking) => (
            <article className="booking-card" key={booking.id}>
              <div className="booking-card-heading">
                <div><p className="service-category">{booking.serviceName}</p><h2>Booking #{booking.id}</h2></div>
                <span className={`booking-status ${booking.status}`}>{booking.status.replace('_', ' ')}</span>
              </div>
              <dl className="booking-details">
                <div><dt>Scheduled</dt><dd>{formatDate(booking.scheduledAt)}</dd></div>
                <div><dt>Address</dt><dd>{booking.serviceAddress}</dd></div>
                <div><dt>Worker</dt><dd>{booking.workerName || 'Awaiting assignment'}</dd></div>
                <div><dt>Price</dt><dd>₹{Number(booking.priceAtBooking).toFixed(2)}</dd></div>
              </dl>
              {['pending', 'confirmed'].includes(booking.status) && (
                <button className="secondary-action danger-action" type="button" onClick={() => cancelBooking(booking.id)} disabled={busyId === booking.id}>
                  {busyId === booking.id ? 'Cancelling...' : 'Cancel booking'}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
      <footer className="page-footer"><span>© HelpHub</span><span>Home services, with care.</span></footer>
    </main>
  );
}
