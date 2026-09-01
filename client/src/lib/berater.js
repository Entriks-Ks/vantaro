import { apiUrl } from './api';
import { readStoredSession } from './auth';

export const LEAD_TYPE_OPTIONS = [
  { id: 'PKV', label: 'PKV' },
  { id: 'bAV', label: 'bAV' },
  { id: 'BU', label: 'BU' },
];

export const REQUEST_STATUS_OPTIONS = [
  { id: 'pending', label: 'Ausstehend' },
  { id: 'active', label: 'Aktiv' },
  { id: 'completed', label: 'Erfüllt' },
  { id: 'rejected', label: 'Abgelehnt' },
  { id: 'cancelled', label: 'Storniert' },
];

export function requestStatusLabel(id) {
  return REQUEST_STATUS_OPTIONS.find((option) => option.id === id)?.label || id || 'Kein Auftrag';
}

export function requestStatusTone(id) {
  if (id === 'active') return 'ok';
  if (id === 'pending') return 'warn';
  if (id === 'completed') return 'new';
  if (id === 'rejected') return 'danger';
  return 'muted';
}

export function leadTypeLabel(id) {
  return LEAD_TYPE_OPTIONS.find((option) => option.id === id)?.label || id || '—';
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

export async function fetchAllRequests() {
  const response = await fetch(apiUrl('/api/requests'), { headers: authHeaders() });
  return parseResponse(response);
}

export async function fetchMyRequests() {
  const response = await fetch(apiUrl('/api/requests/mine'), { headers: authHeaders() });
  return parseResponse(response);
}

export async function createMyRequest(payload) {
  const response = await fetch(apiUrl('/api/requests'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function cancelMyRequest(id) {
  const response = await fetch(apiUrl(`/api/requests/${id}/cancel`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({}),
  });
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
