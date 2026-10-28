const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

export default function ServiceCard({ service, user, onBook }) {
  return (
    <article className="service-card">
      {service.image_url ? (
        <img className="service-image" src={service.image_url} alt={service.name} loading="lazy" />
      ) : (
        <div className="service-image-placeholder" aria-hidden="true">{service.category_name}</div>
      )}
      <div className="service-card-content">
        <p className="service-category">{service.category_name}</p>
        <h3>{service.name}</h3>
        <p className="service-description">{service.description || 'Home service from a local professional.'}</p>
        <div className="service-card-footer">
          <span className="service-price">{priceFormatter.format(Number(service.base_price))}</span>
          <span className="price-note">starting price</span>
        </div>
        {user?.role === 'customer' && <button className="service-book-button" type="button" onClick={() => onBook(service)}>Book service</button>}
        {!user && <button className="service-book-button" type="button" onClick={onBook}>Sign in to book</button>}
      </div>
    </article>
  );
}
