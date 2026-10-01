import { apiUrl } from './api';
import { readStoredSession } from './auth';

function authHeaders(json = false) {
  const session = readStoredSession();
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

async function parse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Etwas ist schiefgelaufen.');
  return payload;
}

export async function fetchCalendarStatus() {
  return parse(await fetch(apiUrl('/api/energy/calendar/status'), { headers: authHeaders() }));
}

export async function connectEnergyCalendar() {
  return parse(await fetch(apiUrl('/api/energy/calendar/connect'), {
    method: 'POST',
    headers: authHeaders(true),
    body: '{}',
  }));
}

export async function disconnectEnergyCalendar() {
  return parse(await fetch(apiUrl('/api/energy/calendar/disconnect'), {
    method: 'POST',
    headers: authHeaders(true),
    body: '{}',
  }));
}
