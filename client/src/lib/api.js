/**
 * Same pattern as entriks-hr:
 * - Local: leave VITE_API_URL empty → Vite proxies `/api`
 * - Production (Vercel): set VITE_API_URL to the Render API URL
 */
const envOrigin = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const API_URL = envOrigin || (import.meta.env.DEV ? '' : 'https://vantaro.onrender.com');

/** Build a full API path, e.g. `apiUrl('/api/auth/login')`. */
export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalized}`;
}
