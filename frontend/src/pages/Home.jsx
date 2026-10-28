import { useEffect, useState } from 'react';
import ServiceCard from '../components/ServiceCard.jsx';
import { apiRequest } from '../services/api.js';

export default function Home({ user, onSignIn, onSignOut, onManageProfile, onViewBookings, onOpenAdmin, onBook }) {
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    apiRequest(`/services${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then((result) => { if (current) setServices(result.services); })
      .catch((requestError) => { if (current) setError(requestError.message); })
      .finally(() => { if (current) setLoading(false); });

    return () => { current = false; };
  }, [search]);

  function searchServices(event) {
    event.preventDefault();
    setSearch(searchDraft.trim());
  }

  return (
    <main className="catalog-page">
      <header className="topbar catalog-topbar">
        <a className="brand" href="/" aria-label="HelpHub home"><span className="brand-mark">H</span>HelpHub</a>
        <nav className="catalog-nav" aria-label="Main navigation">
          <a className="active" href="#services">Services</a>
          {user ? (
            <div className="nav-account">
              <span>{user.name} · {user.role}</span>
              {user.role === 'worker' && <button onClick={onManageProfile}>My profile</button>}
              {user.role === 'customer' && <button onClick={onViewBookings}>My bookings</button>}
              {user.role === 'admin' && <button onClick={onOpenAdmin}>Admin dashboard</button>}
              <button onClick={onSignOut}>Sign out</button>
            </div>
          ) : (
            <button className="nav-signin" onClick={onSignIn}>Sign in</button>
          )}
        </nav>
      </header>

      <section className="catalog-hero">
        <div className="hero-copy">
          <p className="eyebrow">A-Z HOME SERVICES</p>
          <h1>Good help.<br /><span>Right at home.</span></h1>
          <p>Find practical help for the repairs and routines that keep your home in shape.</p>
          <a className="hero-link" href="#services">Explore services <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-image" role="img" aria-label="A bright, cared-for home interior" />
      </section>

      <section className="services-section" id="services" aria-labelledby="services-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE SERVICE DIRECTORY</p>
            <h2 id="services-title">Find the right help</h2>
          </div>
          <p className="result-count" aria-live="polite">{loading ? 'Loading services…' : `${services.length} ${services.length === 1 ? 'service' : 'services'}`}</p>
        </div>

        <form className="service-filters simple-service-search" onSubmit={searchServices}>
          <label className="search-field">
            <span>Search services</span>
            <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Try cleaning or plumbing" maxLength={100} />
          </label>
          <div className="filter-actions">
            <button className="filter-submit" type="submit">Search</button>
            <button className="filter-clear" type="button" onClick={() => { setSearchDraft(''); setSearch(''); }}>Clear</button>
          </div>
        </form>

        {error && <p className="catalog-message error-message" role="alert">{error}</p>}
        {!loading && !error && services.length === 0 && (
          <div className="catalog-empty">
            <h3>No matching services</h3>
            <p>Try another search or clear the search field.</p>
          </div>
        )}
        {loading && <p className="catalog-message">Loading the service directory…</p>}
        {!loading && services.length > 0 && (
          <div className="service-grid">
            {services.map((service) => <ServiceCard key={service.id} service={service} user={user} onBook={user ? () => onBook(service) : onSignIn} />)}
          </div>
        )}
      </section>

      <footer className="page-footer"><span>© HelpHub</span><span>Home services, with care.</span></footer>
    </main>
  );
}
