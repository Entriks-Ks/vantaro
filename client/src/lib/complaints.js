import { apiUrl } from './api';
import { readStoredSession } from './auth';

export const COMPLAINT_REASON_OPTIONS = [
  { id: 'invalid', label: 'Falscher / ungültiger Lead' },
  { id: 'duplicate', label: 'Doppelter Lead' },
  { id: 'contact', label: 'Falsche Kontaktdaten' },
  { id: 'requirements', label: 'Erfüllt nicht die Anforderungen' },
  { id: 'cancelled', label: 'Lead hat storniert' },
  { id: 'other', label: 'Sonstiges' },
];

export const COMPLAINT_STATUS_OPTIONS = [
  { id: 'pending', label: 'In Prüfung' },
  { id: 'approved', label: 'Erstattet' },
  { id: 'declined', label: 'Abgelehnt' },
];

export function complaintReasonLabel(id) {
  return COMPLAINT_REASON_OPTIONS.find((option) => option.id === id)?.label || id || '—';
}

export function complaintStatusLabel(id) {
  if (id === 'rejected') return 'Abgelehnt';
  if (id === 'refunded') return 'Erstattet';
  return COMPLAINT_STATUS_OPTIONS.find((option) => option.id === id)?.label || id || '—';
}

export function complaintStatusTone(id) {
  if (id === 'approved' || id === 'refunded') return 'ok';
  if (id === 'pending') return 'warn';
  if (id === 'declined' || id === 'rejected') return 'danger';
  return 'muted';
}

export function isOpenComplaint(complaint) {
  return complaint?.status === 'pending';
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

export async function fetchComplaints(status) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(apiUrl(`/api/complaints${suffix}`), { headers: authHeaders() });
  return parseResponse(response);
}

export async function reviewComplaint(id, { status, note, replaceLeadId } = {}) {
  const response = await fetch(apiUrl(`/api/complaints/${id}`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({ status, note, replaceLeadId }),
  });
  return parseResponse(response);
}

export async function reportLead(leadId, payload) {
  const response = await fetch(apiUrl(`/api/leads/${leadId}/report`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}
