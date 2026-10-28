const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const token = sessionStorage.getItem('helphub-token');
  const headers = {};

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) sessionStorage.removeItem('helphub-token');
    throw new Error(result.message || `Request failed with status ${response.status}.`);
  }
  return result;
}
