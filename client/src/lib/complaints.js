import { apiUrl } from './api';
import { readStoredSession } from './auth';

export const COMPLAINT_COMMENT_MIN = 20;

export const COMPLAINT_REASON_OPTIONS = [
  {
    id: 'invalid_phone',
    label: 'Falsche oder ungültige Telefonnummer',
    hint: 'Die Nummer ist falsch, unvollständig oder dauerhaft nicht erreichbar.',
    placeholder: 'z. B. Nummer nicht vergeben, Ansage „kein Anschluss unter dieser Nummer“…',
  },
  {
    id: 'wrong_person',
    label: 'Falsche Person oder falsche Kontaktdaten',
    hint: 'Name, Adresse oder Kontakt gehören zu einer anderen Person.',
    placeholder: 'z. B. Person kennt die Anfrage nicht, Name oder Adresse gehören zu jemand anderem…',
  },
  {
    id: 'duplicate',
    label: 'Doppelte Übermittlung desselben Leads',
    hint: 'Derselbe Lead wurde bereits an Sie oder einen anderen Berater übermittelt.',
    placeholder: 'z. B. gleicher Kontakt schon am … erhalten, gleiche Telefonnummer im Bestand…',
  },
  {
    id: 'wrong_info',
    label: 'Wesentlich falsche Angaben zur beruflichen Situation oder zum Versicherungsstatus',
    hint: 'Beruf oder Versicherungsstatus weichen wesentlich von den übermittelten Daten ab.',
    placeholder: 'z. B. angeblich angestellt, tatsächlich selbstständig — oder PKV statt GKV…',
  },
  {
    id: 'missing_fields',
    label: 'Fehlende Pflichtangaben',
    hint: 'Wesentliche Informationen fehlen, sodass eine sinnvolle Beratung nicht möglich ist.',
    placeholder: 'z. B. keine Erreichbarkeit, fehlende Angaben zu Beruf oder Versicherung…',
  },
  {
    id: 'exclusivity',
    label: 'Verstoß gegen Exklusivität oder Sperrlisten',
    hint: 'Kontakt verstößt gegen Exklusivitätsregeln oder steht auf einer Sperrliste.',
    placeholder: 'z. B. Bestandskunde, bereits bei einem anderen Berater in Beratung…',
  },
  {
    id: 'tech_error',
    label: 'Technischer Übertragungsfehler',
    hint: 'Daten wurden durch einen Übertragungs- oder Systemfehler beschädigt.',
    placeholder: 'z. B. abgeschnittene Nummer, unlesbare Adresse, doppelte/fehlende Felder…',
  },
];

const LEGACY_REASON_LABELS = {
  invalid: 'Falscher / ungültiger Lead',
  contact: 'Falsche Kontaktdaten',
  requirements: 'Erfüllt nicht die Anforderungen',
  cancelled: 'Lead hat storniert',
  other: 'Sonstiges',
};

export const COMPLAINT_STATUS_OPTIONS = [
  { id: 'pending', label: 'In Prüfung' },
  { id: 'approved', label: 'Gutschrift vollständig' },
  { id: 'partial', label: 'Gutschrift teilweise' },
  { id: 'declined', label: 'Reklamation abgelehnt' },
  { id: 'info_needed', label: 'Weitere Informationen erforderlich' },
];

const CONTACT_STATUS_LABELS = {
  neu: 'Noch kein Kontakt',
  kontaktiert: 'Kontaktiert',
  termin: 'Termin vereinbart',
  wiedervorlage: 'Wiedervorlage',
  abgeschlossen: 'Abgeschlossen',
};

export function complaintReasonLabel(id) {
  return COMPLAINT_REASON_OPTIONS.find((option) => option.id === id)?.label
    || LEGACY_REASON_LABELS[id]
    || id
    || '—';
}

export function complaintStatusLabel(id) {
  if (id === 'rejected') return 'Reklamation abgelehnt';
  if (id === 'refunded') return 'Gutschrift vollständig';
  if (id === 'teilweise') return 'Gutschrift teilweise';
  if (id === 'infos_noetig') return 'Weitere Informationen erforderlich';
  return COMPLAINT_STATUS_OPTIONS.find((option) => option.id === id)?.label || id || '—';
}

export function complaintStatusTone(id) {
  if (id === 'approved' || id === 'refunded' || id === 'partial' || id === 'teilweise') return 'ok';
  if (id === 'pending') return 'warn';
  if (id === 'info_needed' || id === 'infos_noetig') return 'warn';
  if (id === 'declined' || id === 'rejected') return 'danger';
  return 'muted';
}

export function isOpenComplaint(complaint) {
  return complaint?.status === 'pending';
}

export function canAmendComplaint(complaint) {
  const status = complaint?.status;
  return status === 'info_needed' || status === 'infos_noetig' || status === 'declined' || status === 'rejected';
}

export function contactStatusLabel(id) {
  return CONTACT_STATUS_LABELS[id] || id || '—';
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

export async function reviewComplaint(id, { status, note, replaceLeadId, refundCents } = {}) {
  const response = await fetch(apiUrl(`/api/complaints/${id}`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({ status, note, replaceLeadId, refundCents }),
  });
  return parseResponse(response);
}

export async function sendComplaintReplacement(id, replaceLeadId) {
  const response = await fetch(apiUrl(`/api/complaints/${id}/replacement`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ replaceLeadId }),
  });
  return parseResponse(response);
}

export async function markComplaintsSeen() {
  const response = await fetch(apiUrl('/api/complaints/seen'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({}),
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
