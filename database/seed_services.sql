INSERT INTO service_categories (name, description) VALUES
  ('Cleaning', 'Home cleaning and upkeep'),
  ('Plumbing', 'Repairs and fixture installation'),
  ('Electrical', 'Lighting, wiring, and electrical repairs'),
  ('Appliance Repair', 'Diagnosis and repair for home appliances')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO services (category_id, name, description, image_url, base_price)
SELECT categories.id, items.name, items.description, items.image_url, items.base_price
FROM service_categories AS categories
INNER JOIN (
  SELECT 'Cleaning' AS category_name, 'Home Cleaning' AS name,
    'A thorough clean for kitchens, bathrooms, living spaces, and bedrooms.' AS description,
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&q=85' AS image_url,
    750.00 AS base_price
  UNION ALL SELECT 'Plumbing', 'Plumbing Repair',
    'Help with leaks, faucets, drains, and common household plumbing repairs.',
    'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1000&q=85',
    750.00
  UNION ALL SELECT 'Electrical', 'Electrical Service',
    'Troubleshooting for outlets, switches, fixtures, and small electrical repairs.',
    'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1000&q=85',
    800.00
  UNION ALL SELECT 'Appliance Repair', 'Appliance Diagnosis',
    'A diagnostic visit for common washer, dryer, refrigerator, and oven problems.',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=85',
    650.00
) AS items ON items.category_name = categories.name
WHERE NOT EXISTS (
  SELECT 1 FROM services AS existing
  WHERE existing.category_id = categories.id AND existing.name = items.name
);
