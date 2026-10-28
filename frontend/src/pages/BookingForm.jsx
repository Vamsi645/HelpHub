import { useEffect, useState } from 'react';
import DateTimeField from '../components/DateTimeField.jsx';
import { apiRequest } from '../services/api.js';

function localDateTimeMinimum() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

export default function BookingForm({ service, onBack, onCreated }) {
  const [workers, setWorkers] = useState([]);
  const [form, setForm] = useState({ workerId: '', serviceAddress: '', scheduledAt: '' });
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    apiRequest('/workers?availability=available')
      .then((result) => { if (current) setWorkers(result.workers); })
      .catch((requestError) => { if (current) setError(requestError.message); })
      .finally(() => { if (current) setLoadingWorkers(false); });
    return () => { current = false; };
  }, []);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitBooking(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/bookings', {
        method: 'POST',
        body: {
          serviceId: service.id,
          workerId: form.workerId || null,
          serviceAddress: form.serviceAddress,
          scheduledAt: form.scheduledAt
        }
      });
      onCreated(result.booking);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="worker-dashboard-page">
      <header className="topbar catalog-topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }} aria-label="Back to services"><span className="brand-mark">H</span>HelpHub</a>
        <span className="topbar-note">BOOK A SERVICE</span>
      </header>
      <section className="worker-dashboard-content">
        <button className="back-link" type="button" onClick={onBack}>← Back to services</button>
        <p className="eyebrow">NEW BOOKING</p>
        <h1>{service.name}</h1>
        <p className="profile-intro">Starting at ₹{Number(service.base_price).toFixed(0)} · {service.category_name}</p>
        <form className="profile-form" onSubmit={submitBooking}>
          <label>
            Available worker (optional)
            <select name="workerId" value={form.workerId} onChange={updateField}>
              <option value="">Let HelpHub assign later</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} · {worker.experienceYears} years · {worker.serviceArea || 'Area not provided'}
                </option>
              ))}
            </select>
          </label>
          {loadingWorkers && <p className="form-hint">Loading available workers...</p>}
          <label>
            Service address
            <textarea name="serviceAddress" value={form.serviceAddress} onChange={updateField} maxLength={500} required rows="3" />
          </label>
          <label>
            Preferred date and time
            <DateTimeField name="scheduledAt" min={localDateTimeMinimum()} value={form.scheduledAt} onChange={updateField} required />
          </label>
          {error && <p className="form-message error-message" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Creating booking...' : 'Request booking'}</button>
        </form>
      </section>
      <footer className="page-footer"><span>© HelpHub</span><span>Home services, with care.</span></footer>
    </main>
  );
}
