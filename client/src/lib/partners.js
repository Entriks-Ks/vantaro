import { apiUrl } from './api';
import { readStoredSession } from './auth';

function authHeaders(json = false) {
  const session = readStoredSession();
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

function mapPartner(partner) {
  if (!partner) return partner;
  return {
    ...partner,
    partnerRole: partner.partnerRole || partner.energyRole,
    pages: partner.pages || partner.energyPages,
  };
}

function withRoleFields(payload) {
  const role = payload?.partnerRole || payload?.energyRole;
  return { ...payload, partnerRole: role, energyRole: role };
}

async function parse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Etwas ist schiefgelaufen.');
  if (Array.isArray(payload.partners)) payload.partners = payload.partners.map(mapPartner);
  if (payload.partner) payload.partner = mapPartner(payload.partner);
  if (payload.user) payload.user = mapPartner(payload.user);
  return payload;
}

const PARTNERS_API = '/api/energy/partners';

const ROLE_OPTIONS = {
  energy: [
    { id: 'dispatcher', title: 'Dispatcher', hint: 'Zuweisung und Koordination' },
    { id: 'sub_partner', title: 'Untervertriebspartner', hint: 'Verkauf und Betreuung' },
    { id: 'field_rep', title: 'Außendienst', hint: 'Termine vor Ort' },
  ],
  insurance: [
    { id: 'dispatcher', title: 'Dispatcher', hint: 'Sieht alle Leads und weist zu' },
    { id: 'sub_partner', title: 'Untervermittler', hint: 'Bearbeitet zugewiesene Leads' },
  ],
};

const PAGE_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'leads', label: 'Meine Leads' },
  { id: 'kalender', label: 'Kalender' },
  { id: 'paket', label: 'Meine Pakete' },
  { id: 'academy', label: 'Akademie' },
  { id: 'support', label: 'Support' },
];

/** Default access for new partners — Meine Pakete is off until granted. */
export const DEFAULT_PARTNER_PAGE_IDS = PAGE_OPTIONS.map((item) => item.id).filter((id) => id !== 'paket');

function verticalKey(vertical) {
  return vertical === 'energy' ? 'energy' : 'insurance';
}

export function partnerRoleOptions(vertical) {
  return ROLE_OPTIONS[verticalKey(vertical)];
}

export function partnerRoleLabel(vertical, role) {
  if (role === 'main') return 'Hauptfirma';
  return partnerRoleOptions(vertical).find((option) => option.id === role)?.title || role;
}

/** Insurance partners cannot buy packages, so Meine Pakete is not grantable there. */
export function partnerPageOptions(vertical) {
  return verticalKey(vertical) === 'energy' ? PAGE_OPTIONS : PAGE_OPTIONS.filter((item) => item.id !== 'paket');
}

/** Pages a logged-in partner may open, or null for a main company account. */
export function allowedPartnerPages(user) {
  if (!user || (user.partnerRole || 'main') === 'main') return null;
  const allowed = partnerPageOptions(user.vertical).map((item) => item.id);
  const pages = (Array.isArray(user.partnerPages) ? user.partnerPages : DEFAULT_PARTNER_PAGE_IDS)
    .filter((id) => allowed.includes(id));
  return pages.length ? pages : DEFAULT_PARTNER_PAGE_IDS;
}

export async function fetchPartners() {
  return parse(await fetch(apiUrl(PARTNERS_API), { headers: authHeaders() }));
}

export async function createPartner(payload) {
  return parse(await fetch(apiUrl(PARTNERS_API), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(withRoleFields(payload)),
  }));
}

export async function updatePartner(partnerId, payload) {
  return parse(await fetch(apiUrl(`${PARTNERS_API}/${partnerId}`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(withRoleFields(payload)),
  }));
}

export async function sendPartnerPasswordLink(partnerId) {
  return parse(await fetch(apiUrl(`${PARTNERS_API}/${partnerId}/password-link`), {
    method: 'POST',
    headers: authHeaders(),
  }));
}

export async function resetPartnerPassword(partnerId) {
  return parse(await fetch(apiUrl(`${PARTNERS_API}/${partnerId}/password`), {
    method: 'POST',
    headers: authHeaders(),
  }));
}

export async function deletePartner(partnerId) {
  return parse(await fetch(apiUrl(`${PARTNERS_API}/${partnerId}`), {
    method: 'DELETE',
    headers: authHeaders(),
  }));
}

export async function assignLeadHolder(leadId, holderId) {
  return parse(await fetch(apiUrl(`/api/energy/leads/${leadId}/assign`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ holderId }),
  }));
}
