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
