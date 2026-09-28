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

export const ENERGY_ROLE_LABELS = {
  main: 'Hauptfirma',
  dispatcher: 'Dispatcher',
  sub_partner: 'Untervertriebspartner',
  field_rep: 'Außendienst',
};

export const ENERGY_PAGE_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'leads', label: 'Meine Leads' },
  { id: 'kalender', label: 'Kalender' },
  { id: 'paket', label: 'Meine Pakete' },
  { id: 'academy', label: 'Akademie' },
  { id: 'support', label: 'Support' },
];

export const ENERGY_PAGE_IDS = ENERGY_PAGE_OPTIONS.map((item) => item.id);

/** Default access for new Unterpartner — Meine Pakete is off until granted. */
export const ENERGY_DEFAULT_PAGE_IDS = ENERGY_PAGE_IDS.filter((id) => id !== 'paket');

export const ENERGY_STATUS_LABELS = {
  NEW: 'Neu',
  ASSIGNED: 'Zugewiesen',
  CALENDAR_PENDING: 'Kalender ausstehend',
  CALENDAR_SYNCED: 'Im Kalender',
  CONFIRMED: 'Gestartet',
  RESCHEDULE_REQUESTED: 'Verschiebung angefragt',
  RESCHEDULED: 'Verschoben',
  CANCELLED: 'Abgesagt',
  NO_SHOW: 'Nicht erschienen',
  COMPLAINT_OPENED: 'Reklamation offen',
  COMPLETED: 'Abgeschlossen',
  FOLLOW_UP: 'Wiedervorlage',
};

export const ENERGY_COMPLAINT_REASONS = [
  {
    id: 'invalid_phone',
    label: 'Telefon ungültig oder nicht erreichbar',
    hint: 'Die Nummer ist falsch, unvollständig oder dauerhaft nicht erreichbar.',
    placeholder: 'z. B. Nummer nicht vergeben, Ansage „kein Anschluss unter dieser Nummer“…',
  },
  {
    id: 'wrong_territory',
    label: 'Adresse außerhalb des Gebiets',
    hint: 'Die Adresse liegt nicht im gebuchten Gebiet.',
    placeholder: 'z. B. PLZ gehört nicht zum bestellten Gebiet…',
  },
  {
    id: 'customer_unaware',
    label: 'Kunde weiß von nichts',
    hint: 'Die Person kennt die Anfrage oder den Termin nicht.',
    placeholder: 'z. B. Person kennt die Anfrage nicht, kein Einverständnis…',
  },
  {
    id: 'duplicate',
    label: 'Doppelt',
    hint: 'Derselbe Kontakt wurde bereits geliefert.',
    placeholder: 'z. B. gleicher Kontakt schon am … erhalten, gleiche Telefonnummer…',
  },
  {
    id: 'appointment_not_attended',
    label: 'Termin nicht wahrgenommen',
    hint: 'Der feste Termin wurde nicht eingehalten.',
    placeholder: 'z. B. Kunde war nicht vor Ort, Termin wurde nicht wahrgenommen…',
  },
];

export const ENERGY_COMPLAINT_STATUS = {
  pending: 'In Prüfung',
  approved: 'Gutschrift vollständig',
  partial: 'Gutschrift teilweise',
  rejected: 'Reklamation abgelehnt',
  replacement: 'Ersatzlieferung',
};

export async function fetchEnergyPartners() {
  return parse(await fetch(apiUrl('/api/energy/partners'), { headers: authHeaders() }));
}

export async function createEnergyPartner(payload) {
  return parse(await fetch(apiUrl('/api/energy/partners'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  }));
}

export async function updateEnergyPartner(partnerId, payload) {
  return parse(await fetch(apiUrl(`/api/energy/partners/${partnerId}`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  }));
}

export async function assignEnergyHolder(leadId, holderId) {
  return parse(await fetch(apiUrl(`/api/energy/leads/${leadId}/assign`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ holderId }),
  }));
}

export async function setEnergyOutcome(leadId, payload) {
  return parse(await fetch(apiUrl(`/api/energy/leads/${leadId}/outcome`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  }));
}

export async function fetchEnergyBilling(companyId) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return parse(await fetch(apiUrl(`/api/energy/billing${query}`), { headers: authHeaders() }));
}

export async function saveEnergyBilling(companyId, payload) {
  return parse(await fetch(apiUrl(`/api/energy/billing/${companyId}`), {
    method: 'PUT',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  }));
}

export async function invoiceEnergyLines(companyId, invoiceId) {
  return parse(await fetch(apiUrl(`/api/energy/billing/${companyId}/invoice`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ invoiceId }),
  }));
}

export async function fetchEnergyComplaints() {
  return parse(await fetch(apiUrl('/api/energy/complaints'), { headers: authHeaders() }));
}

export async function openEnergyComplaint(leadId, payload) {
  return parse(await fetch(apiUrl(`/api/energy/leads/${leadId}/complaints`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  }));
}

export async function decideEnergyComplaint(id, status) {
  return parse(await fetch(apiUrl(`/api/energy/complaints/${id}/decide`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ status }),
  }));
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
