import { apiUrl } from '../../lib/api';
import { readStoredSession, restoreSession } from '../../lib/auth';
import { getLang, L } from './i18n';

const BASE = '/api/it-support';

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function send(method, path, { params, body } = {}, retried = false) {
  const session = readStoredSession();
  // The console API answers in the console language (Accept-Language is CORS-safelisted).
  const headers = { 'Accept-Language': getLang() };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(apiUrl(`${BASE}${path}${query(params)}`), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Access tokens expire after an hour: refresh once, then retry.
  if (response.status === 401 && !retried) {
    const next = await restoreSession().catch(() => null);
    if (next?.access_token) return send(method, path, { params, body }, true);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || L(`Anfrage fehlgeschlagen (HTTP ${response.status}).`, `Request failed (HTTP ${response.status}).`));
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload;
}

export const api = {
  get: (path, params) => send('GET', path, { params }),
  post: (path, body = {}) => send('POST', path, { body }),
  patch: (path, body = {}) => send('PATCH', path, { body }),
  del: (path, body = {}) => send('DELETE', path, { body }),
};
