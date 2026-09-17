const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('railway_token') : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

// Auth
export const authAPI = {
  register: (body: { name: string; email: string; phone: string; password: string }) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => apiFetch('/auth/me'),
};

// Stations
export const stationAPI = {
  getAll: () => apiFetch('/stations'),
  add: (body: { code: string; name: string; city: string }) =>
    apiFetch('/stations', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: number) =>
    apiFetch(`/stations/${id}`, { method: 'DELETE' }),
};

// Trains
export const trainAPI = {
  search: (from: string, to: string, date: string) =>
    apiFetch(`/trains/search?from=${from}&to=${to}&date=${date}`),
  getAll: () => apiFetch('/trains/all'),
  getById: (id: number) => apiFetch(`/trains/${id}`),
  add: (body: Record<string, unknown>) =>
    apiFetch('/trains', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Record<string, unknown>) =>
    apiFetch(`/trains/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) =>
    apiFetch(`/trains/${id}`, { method: 'DELETE' }),
};

// Bookings
export const bookingAPI = {
  create: (body: Record<string, unknown>) =>
    apiFetch('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  getMyBookings: () => apiFetch('/bookings'),
  getPNR: (pnr: string) => apiFetch(`/bookings/pnr/${pnr}`),
  cancel: (id: number) =>
    apiFetch(`/bookings/${id}/cancel`, { method: 'POST' }),
};

// Admin
export const adminAPI = {
  dashboard: () => apiFetch('/admin/dashboard'),
  bookings: () => apiFetch('/admin/bookings'),
  users: () => apiFetch('/admin/users'),
};
