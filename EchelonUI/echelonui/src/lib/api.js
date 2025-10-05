// This constant will be used by your components to make API calls.
// In development, the Vite proxy will handle this.
// In production, your Node server will handle requests to '/api'.
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function api(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.error || data?.message || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export const generateWorkout = (text, userId = 'anon') =>
  api('/generate-and-save', { method: 'POST', body: { text, userId } });

export const listWorkouts = (userId = 'anon') =>
  api(`/workouts?userId=${encodeURIComponent(userId)}`);

export const getWorkout = (id) => api(`/workouts/${encodeURIComponent(id)}`);
export const getHealth = () => api('/health');
export const listModels = () => api('/models');