import { apiUrl } from './api';
import { readStoredSession } from './auth';

export const REQUEST_STATUS_OPTIONS = [
  { id: 'angefragt', label: 'Angefragt' },
  { id: 'aktiv', label: 'Aktiv' },
  { id: 'pausiert', label: 'Pausiert' },
  { id: 'erledigt', label: 'Erfüllt' },
];

export function requestStatusLabel(id) {
  return REQUEST_STATUS_OPTIONS.find((option) => option.id === id)?.label || id || 'Kein Auftrag';
}

export function requestStatusTone(id) {
  if (id === 'aktiv') return 'ok';
  if (id === 'angefragt') return 'warn';
  if (id === 'pausiert') return 'muted';
  if (id === 'erledigt') return 'new';
  return 'muted';
}

function authHeaders(json = false) {
  const session = readStoredSession();
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.');
  }
  return payload;
}

export async function fetchBeraterPipelines() {
  const response = await fetch(apiUrl('/api/berater'), { headers: authHeaders() });
  return parseResponse(response);
}

export async function fetchBeraterPipeline(id) {
  const response = await fetch(apiUrl(`/api/berater/${id}`), { headers: authHeaders() });
  return parseResponse(response);
}

export async function createBeraterRequest(beraterId, payload) {
  const response = await fetch(apiUrl(`/api/berater/${beraterId}/requests`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function updateBeraterRequest(requestId, payload) {
  const response = await fetch(apiUrl(`/api/berater/requests/${requestId}`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function sendBeraterLeads(requestId, leadIds) {
  const response = await fetch(apiUrl(`/api/berater/requests/${requestId}/send`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ leadIds }),
  });
  return parseResponse(response);
}

export async function recallBeraterLead(requestId, leadId) {
  const response = await fetch(apiUrl(`/api/berater/requests/${requestId}/recall`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ leadId }),
  });
  return parseResponse(response);
}
