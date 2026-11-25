import { apiUrl } from './api';
import { readStoredSession } from './auth';
import { L } from './i18n';

export const COMPLAINT_COMMENT_MIN = 20;

export const COMPLAINT_REASON_OPTIONS = [
  {
    id: 'invalid_phone',
    label: L('Falsche oder ungültige Telefonnummer', 'Wrong or invalid phone number'),
    hint: L('Die Nummer ist falsch, unvollständig oder dauerhaft nicht erreichbar.', 'The number is wrong, incomplete or permanently unreachable.'),
    placeholder: L('z. B. Nummer nicht vergeben, Ansage „kein Anschluss unter dieser Nummer“…', 'e.g. number not assigned, announcement “this number is not in service”…'),
  },
  {
    id: 'wrong_person',
    label: L('Falsche Person oder falsche Kontaktdaten', 'Wrong person or wrong contact details'),
    hint: L('Name, Adresse oder Kontakt gehören zu einer anderen Person.', 'Name, address or contact details belong to someone else.'),
    placeholder: L('z. B. Person kennt die Anfrage nicht, Name oder Adresse gehören zu jemand anderem…', 'e.g. person doesn\'t know about the request, name or address belongs to someone else…'),
  },
  {
    id: 'duplicate',
    label: L('Doppelte Übermittlung desselben Leads', 'Duplicate delivery of the same lead'),
    hint: L('Derselbe Lead wurde bereits an Sie oder einen anderen Berater übermittelt.', 'The same lead was already delivered to you or another advisor.'),
    placeholder: L('z. B. gleicher Kontakt schon am … erhalten, gleiche Telefonnummer im Bestand…', 'e.g. same contact already received on …, same phone number already on file…'),
  },
  {
    id: 'wrong_info',
    label: L('Wesentlich falsche Angaben zur beruflichen Situation oder zum Versicherungsstatus', 'Materially incorrect information on employment or insurance status'),
    hint: L('Beruf oder Versicherungsstatus weichen wesentlich von den übermittelten Daten ab.', 'Occupation or insurance status differ materially from the data provided.'),
    placeholder: L('z. B. angeblich angestellt, tatsächlich selbstständig — oder PKV statt GKV…', 'e.g. supposedly employed, actually self-employed — or PKV instead of GKV…'),
  },
  {
    id: 'missing_fields',
    label: L('Fehlende Pflichtangaben', 'Missing required information'),
    hint: L('Wesentliche Informationen fehlen, sodass eine sinnvolle Beratung nicht möglich ist.', 'Essential information is missing, so meaningful advice is not possible.'),
    placeholder: L('z. B. keine Erreichbarkeit, fehlende Angaben zu Beruf oder Versicherung…', 'e.g. unreachable, missing details on occupation or insurance…'),
  },
  {
    id: 'exclusivity',
    label: L('Verstoß gegen Exklusivität oder Sperrlisten', 'Breach of exclusivity or blocklists'),
    hint: L('Kontakt verstößt gegen Exklusivitätsregeln oder steht auf einer Sperrliste.', 'Contact breaches exclusivity rules or is on a blocklist.'),
    placeholder: L('z. B. Bestandskunde, bereits bei einem anderen Berater in Beratung…', 'e.g. existing customer, already being advised by another advisor…'),
  },
  {
    id: 'tech_error',
    label: L('Technischer Übertragungsfehler', 'Technical transmission error'),
    hint: L('Daten wurden durch einen Übertragungs- oder Systemfehler beschädigt.', 'Data was corrupted by a transmission or system error.'),
    placeholder: L('z. B. abgeschnittene Nummer, unlesbare Adresse, doppelte/fehlende Felder…', 'e.g. truncated number, unreadable address, duplicate/missing fields…'),
  },
];

export const ENERGY_COMPLAINT_REASONS = [
  {
    id: 'invalid_phone',
    label: L('Telefon ungültig oder nicht erreichbar', 'Phone invalid or unreachable'),
    hint: L('Die Nummer ist falsch, unvollständig oder dauerhaft nicht erreichbar.', 'The number is wrong, incomplete or permanently unreachable.'),
    placeholder: L('z. B. Nummer nicht vergeben, Ansage „kein Anschluss unter dieser Nummer“…', 'e.g. number not assigned, announcement “this number is not in service”…'),
  },
  {
    id: 'wrong_territory',
    label: L('Adresse außerhalb des Gebiets', 'Address outside the area'),
    hint: L('Die Adresse liegt nicht im gebuchten Gebiet.', 'The address is not in the booked area.'),
    placeholder: L('z. B. PLZ gehört nicht zum bestellten Gebiet…', 'e.g. postcode is not part of the ordered area…'),
  },
  {
    id: 'customer_unaware',
    label: L('Kunde weiß von nichts', 'Customer knows nothing about it'),
    hint: L('Die Person kennt die Anfrage oder den Termin nicht.', 'The person doesn\'t know about the request or the appointment.'),
    placeholder: L('z. B. Person kennt die Anfrage nicht, kein Einverständnis…', 'e.g. person doesn\'t know about the request, no consent…'),
  },
  {
    id: 'duplicate',
    label: L('Doppelte Übermittlung desselben Leads', 'Duplicate delivery of the same lead'),
    hint: L('Derselbe Kontakt wurde bereits geliefert.', 'The same contact was already delivered.'),
    placeholder: L('z. B. gleicher Kontakt schon am … erhalten, gleiche Telefonnummer…', 'e.g. same contact already received on …, same phone number…'),
  },
  {
    id: 'appointment_not_attended',
    label: L('Termin nicht wahrgenommen', 'Appointment not attended'),
    hint: L('Der feste Termin wurde nicht eingehalten.', 'The fixed appointment was not kept.'),
    placeholder: L('z. B. Kunde war nicht vor Ort, Termin wurde nicht wahrgenommen…', 'e.g. customer was not on site, appointment was not attended…'),
  },
];

export function complaintReasonsFor(vertical) {
  return vertical === 'energy' ? ENERGY_COMPLAINT_REASONS : COMPLAINT_REASON_OPTIONS;
}

const LEGACY_REASON_LABELS = {
  invalid: L('Falscher / ungültiger Lead', 'Wrong / invalid lead'),
  contact: L('Falsche Kontaktdaten', 'Wrong contact details'),
  requirements: L('Erfüllt nicht die Anforderungen', 'Does not meet the requirements'),
  cancelled: L('Lead hat storniert', 'Lead cancelled'),
  other: L('Sonstiges', 'Other'),
};

export const COMPLAINT_STATUS_OPTIONS = [
  { id: 'pending', label: L('In Prüfung', 'Under review') },
  { id: 'approved', label: L('Gutschrift vollständig', 'Full credit') },
  { id: 'partial', label: L('Gutschrift teilweise', 'Partial credit') },
  { id: 'declined', label: L('Reklamation abgelehnt', 'Complaint rejected') },
  { id: 'info_needed', label: L('Weitere Informationen erforderlich', 'More information required') },
];

const CONTACT_STATUS_LABELS = {
  neu: L('Noch kein Kontakt', 'No contact yet'),
  kontaktiert: L('Kontaktiert', 'Contacted'),
  termin: L('Termin vereinbart', 'Appointment scheduled'),
  wiedervorlage: L('Wiedervorlage', 'Follow-up'),
  abgeschlossen: L('Abgeschlossen', 'Closed'),
};

export function complaintReasonLabel(id, vertical) {
  return complaintReasonsFor(vertical).find((option) => option.id === id)?.label
    || COMPLAINT_REASON_OPTIONS.find((option) => option.id === id)?.label
    || ENERGY_COMPLAINT_REASONS.find((option) => option.id === id)?.label
    || LEGACY_REASON_LABELS[id]
    || id
    || '—';
}

export function complaintStatusLabel(id) {
  if (id === 'rejected') return L('Reklamation abgelehnt', 'Complaint rejected');
  if (id === 'refunded') return L('Gutschrift vollständig', 'Full credit');
  if (id === 'teilweise') return L('Gutschrift teilweise', 'Partial credit');
  if (id === 'infos_noetig') return L('Weitere Informationen erforderlich', 'More information required');
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

export function isCreditedComplaint(complaint) {
  const status = complaint?.status;
  return status === 'approved' || status === 'partial' || status === 'refunded' || status === 'teilweise';
}

export function isComplaintBlockedLead(lead) {
  return Boolean(lead?.refundedAt) || isCreditedComplaint(lead?.complaint);
}

export function isReplacementPending(complaint) {
  return isCreditedComplaint(complaint)
    && !complaint?.replacementLeadId
    && !complaint?.replacementLead;
}

export function creditedComplaintBeraterNote(complaint) {
  if (!isCreditedComplaint(complaint)) return '';
  if (isReplacementPending(complaint)) {
    return L('Reklamation akzeptiert. Dieser Lead ist gesperrt. Ein Ersatz wird zugestellt.', 'Complaint accepted. This lead is locked. A replacement will be delivered.');
  }
  return L('Reklamation akzeptiert. Dieser Lead ist gesperrt. Ein Ersatz wurde zugestellt.', 'Complaint accepted. This lead is locked. A replacement has been delivered.');
}

export function complaintReplacementPath(complaint) {
  if (!complaint?.id) return '/dashboard/leads';
  const type = String(complaint.request?.leadType || '');
  const appointment = complaint.lead?.deliveryType === 'appointment' || type.includes('APPOINTMENT');
  const base = appointment ? '/dashboard/termine' : '/dashboard/leads';
  return `${base}?replacementFor=${complaint.id}`;
}

export function complaintReplacementVertical(complaint) {
  const vertical = complaint?.lead?.vertical || complaint?.request?.vertical || complaint?.snapshot?.vertical;
  return vertical === 'energy' ? 'energy' : 'insurance';
}

export function canAmendComplaint(complaint) {
  const status = complaint?.status;
  return status === 'info_needed' || status === 'infos_noetig' || status === 'declined' || status === 'rejected';
}

export function complaintNeedsInfo(complaint) {
  const status = complaint?.status;
  return status === 'info_needed' || status === 'infos_noetig';
}

/** Declined complaints return the lead to the normal pipeline. Refunded stays blocked on the berater. */
export function isComplaintFlowLead(lead) {
  if (lead?.refundedAt) return true;
  const status = lead?.complaint?.status;
  return Boolean(status) && status !== 'declined' && status !== 'rejected';
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
    throw new Error(payload.error || L('Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.', 'Something went wrong. Please try again.'));
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
