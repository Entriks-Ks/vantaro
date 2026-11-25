import { apiUrl } from './api';
import { readStoredSession } from './auth';
import { L } from './i18n';

export const LEAD_TYPE_OPTIONS = [
  { id: 'PKV', label: 'PKV' },
  { id: 'bAV', label: 'bAV' },
  { id: 'BU', label: 'BU' },
  { id: 'PV_LEAD', label: L('Photovoltaik-Lead', 'Solar PV lead') },
  { id: 'PV_APPOINTMENT', label: L('Photovoltaik-Termin', 'Solar PV appointment') },
  { id: 'HP_LEAD', label: L('Wärmepumpen-Lead', 'Heat pump lead') },
  { id: 'HP_APPOINTMENT', label: L('Wärmepumpen-Termin', 'Heat pump appointment') },
];

export const REQUEST_STATUS_OPTIONS = [
  { id: 'active', label: L('Aktiv', 'Active') },
  { id: 'cancelled', label: L('Pausiert', 'Paused') },
  { id: 'completed', label: L('Erfüllt', 'Fulfilled') },
  { id: 'rejected', label: L('Abgelehnt', 'Rejected') },
  { id: 'pending', label: L('Aktiv', 'Active') },
];

export const FULFILLMENT_MODE_OPTIONS = [
  { id: 'manual', label: L('Manuell', 'Manual') },
  { id: 'auto', label: L('Automatisch', 'Automatic') },
];

export function requestStatusLabel(id) {
  return REQUEST_STATUS_OPTIONS.find((option) => option.id === id)?.label || id || L('Kein Auftrag', 'No order');
}

export function fulfillmentModeLabel(id) {
  return FULFILLMENT_MODE_OPTIONS.find((option) => option.id === id)?.label || L('Manuell', 'Manual');
}

export function isAutoFulfillment(request) {
  return String(request?.fulfillmentMode || 'manual') === 'auto';
}

export function requestStatusTone(id) {
  if (id === 'active' || id === 'pending') return 'ok';
  if (id === 'cancelled') return 'warn';
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
    throw new Error(payload.error || L('Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.', 'Something went wrong. Please try again.'));
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

export async function markRequestSeen(requestId) {
  const response = await fetch(apiUrl(`/api/requests/${requestId}/seen`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({}),
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

export async function autoFillBeraterRequest(requestId) {
  const response = await fetch(apiUrl(`/api/berater/requests/${requestId}/auto-fill`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({}),
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
