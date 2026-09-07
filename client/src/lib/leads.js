import Papa from 'papaparse';
import { apiUrl } from './api';
import { readStoredSession } from './auth';

export const EMPLOYMENT_OPTIONS = [
  { id: 'selbststaendig', label: 'hauptberuflich selbstständig' },
  { id: 'zusaetzlich_angestellt', label: 'zusätzlich angestellt' },
  { id: 'sonstiges', label: 'sonstiges' },
];

export const INSURANCE_OPTIONS = [
  { id: 'gkv', label: 'GKV' },
  { id: 'pkv_voll', label: 'PKV-Vollversicherung' },
  { id: 'zusatz', label: 'Zusatzversicherung' },
  { id: 'unbekannt', label: 'unbekannt' },
];

export const COVERAGE_OPTIONS = [
  { id: 'allein', label: 'allein versichert' },
  { id: 'partner', label: 'Partner' },
  { id: 'kinder', label: 'Kinder' },
  { id: 'familie', label: 'Familie' },
];

export const CONCERN_OPTIONS = [
  { id: 'beitrag', label: 'Beitrag' },
  { id: 'leistungen', label: 'Leistungen' },
  { id: 'krankentagegeld', label: 'Krankentagegeld' },
  { id: 'check', label: 'allgemeiner Check' },
];

export const STATUS_OPTIONS = [
  { id: 'neu', label: 'Neu' },
  { id: 'zugewiesen', label: 'Zugewiesen' },
  { id: 'erledigt', label: 'Erledigt' },
];

export const CSV_COLUMNS = [
  { header: 'Vorname', key: 'firstName' },
  { header: 'Nachname', key: 'lastName' },
  { header: 'Geburtsdatum', key: 'dateOfBirth' },
  { header: 'Berufliche Situation', key: 'employmentStatus' },
  { header: 'Berufliche Situation sonstiges', key: 'employmentOther' },
  { header: 'E-Mail', key: 'email' },
  { header: 'Mobilnummer', key: 'phone' },
  { header: 'Versicherungsstatus', key: 'insuranceStatus' },
  { header: 'Aktuelle Gesellschaft', key: 'currentInsurer' },
  { header: 'Monatlicher Beitrag', key: 'monthlyPremium' },
  { header: 'Personenkreis', key: 'coverageCircle' },
  { header: 'Hauptanliegen', key: 'mainConcerns' },
  { header: 'PLZ', key: 'zip' },
  { header: 'Ort', key: 'city' },
  { header: 'Straße', key: 'street' },
  { header: 'Paket', key: 'scope' },
  { header: 'Gesprächsnotizen', key: 'notes' },
];

const LABEL_MAPS = {
  employment: Object.fromEntries(EMPLOYMENT_OPTIONS.map((item) => [item.id, item.label])),
  insurance: Object.fromEntries(INSURANCE_OPTIONS.map((item) => [item.id, item.label])),
  coverage: Object.fromEntries(COVERAGE_OPTIONS.map((item) => [item.id, item.label])),
  concern: Object.fromEntries(CONCERN_OPTIONS.map((item) => [item.id, item.label])),
  status: {
    ...Object.fromEntries(STATUS_OPTIONS.map((item) => [item.id, item.label])),
    in_bearbeitung: 'In Bearbeitung',
  },
};

function optionLabel(map, id) {
  return map[id] || id || '—';
}

export function employmentLabel(id) {
  return optionLabel(LABEL_MAPS.employment, id);
}

export function statusLabel(id) {
  return optionLabel(LABEL_MAPS.status, id);
}

export function listLabels(ids, type) {
  const map = LABEL_MAPS[type] || {};
  const values = Array.isArray(ids) ? ids : [];
  if (!values.length) return '—';
  return values.map((id) => map[id] || id).join(', ');
}

export function formatLeadDate(value) {
  if (!value) return '—';
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split('-');
  if (year && month && day) return `${day}.${month}.${year}`;
  return '—';
}

export function formatLeadAddress(lead) {
  const street = String(lead?.street || '').trim();
  const zip = String(lead?.zip || '').trim();
  const city = String(lead?.city || '').trim();
  const locality = [zip, city].filter(Boolean).join(' ');
  return [street, locality].filter(Boolean).join(', ') || '—';
}

export function formatPremium(value) {
  if (value == null || value === '') return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function presentLabel(value) {
  const text = String(value || '').trim();
  return !text || text === '—' ? '' : text;
}

export function leadAgeLabel(value) {
  const iso = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday = now.getMonth() + 1 < month
    || (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  if (age < 16 || age > 99) return '';
  return `${age} Jahre`;
}

export function leadBriefing(lead) {
  const employment = lead?.employmentStatus === 'sonstiges' && lead?.employmentOther
    ? lead.employmentOther
    : employmentLabel(lead?.employmentStatus);

  return {
    employment: presentLabel(employment),
    insurance: presentLabel(listLabels(lead?.insuranceStatus, 'insurance')),
    coverage: presentLabel(listLabels(lead?.coverageCircle, 'coverage')),
    concerns: presentLabel(listLabels(lead?.mainConcerns, 'concern')),
    premium: presentLabel(formatPremium(lead?.monthlyPremium)),
    insurer: presentLabel(lead?.currentInsurer),
    age: leadAgeLabel(lead?.dateOfBirth),
  };
}

export function emptyLeadForm() {
  return {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    employmentStatus: '',
    employmentOther: '',
    email: '',
    phone: '',
    insuranceStatus: [],
    currentInsurer: '',
    monthlyPremium: '',
    coverageCircle: [],
    mainConcerns: [],
    zip: '',
    city: '',
    street: '',
    notes: '',
    status: 'neu',
    scope: 'deutschlandweit',
  };
}

export function leadToForm(lead) {
  return {
    ...emptyLeadForm(),
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    dateOfBirth: lead.dateOfBirth ? String(lead.dateOfBirth).slice(0, 10) : '',
    employmentStatus: lead.employmentStatus || '',
    employmentOther: lead.employmentOther || '',
    email: lead.email || '',
    phone: lead.phone || '',
    insuranceStatus: lead.insuranceStatus || [],
    currentInsurer: lead.currentInsurer || '',
    monthlyPremium: lead.monthlyPremium ?? '',
    coverageCircle: lead.coverageCircle || [],
    mainConcerns: lead.mainConcerns || [],
    zip: lead.zip || '',
    city: lead.city || '',
    street: lead.street || '',
    notes: lead.notes || '',
    status: lead.status || 'neu',
    scope: lead.scope || 'deutschlandweit',
  };
}

export function formToPayload(form) {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    dateOfBirth: form.dateOfBirth || null,
    employmentStatus: form.employmentStatus || null,
    employmentOther: form.employmentOther || null,
    email: form.email || null,
    phone: form.phone || null,
    insuranceStatus: form.insuranceStatus || [],
    currentInsurer: form.currentInsurer || null,
    monthlyPremium: form.monthlyPremium === '' ? null : form.monthlyPremium,
    coverageCircle: form.coverageCircle || [],
    mainConcerns: form.mainConcerns || [],
    zip: form.zip || null,
    city: form.city || null,
    street: form.street || null,
    notes: form.notes || null,
    status: form.status || 'neu',
    scope: form.scope || 'deutschlandweit',
  };
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

export async function fetchLeads(params = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.assignedTo) search.set('assignedTo', params.assignedTo);
  if (params.search) search.set('q', params.search);
  if (params.scope) search.set('scope', params.scope);
  const suffix = search.toString() ? `?${search}` : '';
  const response = await fetch(apiUrl(`/api/leads${suffix}`), { headers: authHeaders() });
  return parseResponse(response);
}

export async function fetchMyLeads() {
  const response = await fetch(apiUrl('/api/leads/mine'), { headers: authHeaders() });
  return parseResponse(response);
}

export async function fetchLead(id) {
  const response = await fetch(apiUrl(`/api/leads/${id}`), { headers: authHeaders() });
  return parseResponse(response);
}

export async function createLead(payload) {
  const response = await fetch(apiUrl('/api/leads'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function updateLead(id, payload) {
  const response = await fetch(apiUrl(`/api/leads/${id}`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function assignLead(id, assignedTo, { requestId } = {}) {
  const response = await fetch(apiUrl(`/api/leads/${id}/assign`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({
      assignedTo,
      requestId: requestId === undefined ? undefined : requestId,
    }),
  });
  return parseResponse(response);
}

export async function restoreRejectedLead(id) {
  const response = await fetch(apiUrl(`/api/leads/${id}/restore`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export async function deleteLead(id) {
  const response = await fetch(apiUrl(`/api/leads/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function importLeads(rows) {
  const response = await fetch(apiUrl('/api/leads/import'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ rows }),
  });
  return parseResponse(response);
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/strasse/g, 'straße');
}

const CSV_HEADER_LOOKUP = {
  ...Object.fromEntries(CSV_COLUMNS.map((column) => [normalizeHeader(column.header), column.key])),
  vorname: 'firstName',
  nachname: 'lastName',
  'first name': 'firstName',
  'last name': 'lastName',
  email: 'email',
  'e-mail': 'email',
  telefon: 'phone',
  mobilnummer: 'phone',
  phone: 'phone',
  plz: 'zip',
  ort: 'city',
  stadt: 'city',
  strasse: 'street',
  street: 'street',
  paket: 'scope',
  package: 'scope',
  scope: 'scope',
  typ: 'scope',
  art: 'scope',
  pakettyp: 'scope',
  exclusive: 'scope',
  exclusiv: 'scope',
  exklusiv: 'scope',
  regional: 'scope',
  notizen: 'notes',
  notes: 'notes',
  gespraechsnotizen: 'notes',
  personenkreis: 'coverageCircle',
  coverage: 'coverageCircle',
  hauptanliegen: 'mainConcerns',
};

function detectCsvDelimiter(text) {
  const line = String(text || '').split(/\r?\n/).find((entry) => entry.trim()) || '';
  const counts = [
    ['\t', (line.match(/\t/g) || []).length],
    [';', (line.match(/;/g) || []).length],
    [',', (line.match(/,/g) || []).length],
  ].sort((left, right) => right[1] - left[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

function cleanCsvRow(row) {
  const cleaned = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (!key || key.startsWith('_')) continue;
    cleaned[key] = typeof value === 'string' ? value.trim() : value;
  }
  const scope = String(cleaned.scope || '').trim();
  const notes = String(cleaned.notes || '').trim();
  if (scope && !notes && (/\s/.test(scope) || scope.length > 24)) {
    const known = /^(deutschlandweit|regional|exklusiv|exclusive|exclusiv|bundesweit)$/i.test(scope);
    if (!known) {
      cleaned.notes = scope;
      cleaned.scope = '';
    }
  }
  return cleaned;
}

export function parseLeadCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('CSV konnte nicht gelesen werden.'));
    reader.onload = () => {
      const text = String(reader.result || '').replace(/^\uFEFF/, '');
      Papa.parse(text, {
        header: true,
        skipEmptyLines: 'greedy',
        delimiter: detectCsvDelimiter(text),
        transformHeader: (header) => CSV_HEADER_LOOKUP[normalizeHeader(header)] || header.trim(),
        complete(result) {
          if (result.errors?.length && !result.data?.length) {
            reject(new Error(result.errors[0].message || 'CSV konnte nicht gelesen werden.'));
            return;
          }
          resolve((result.data || []).map(cleanCsvRow));
        },
        error(error) {
          reject(error);
        },
      });
    };
    reader.readAsText(file);
  });
}

export function downloadLeadCsvTemplate() {
  const headers = CSV_COLUMNS.map((column) => column.header);
  const example = [
    'Max',
    'Mustermann',
    '12.03.1985',
    'hauptberuflich selbstständig',
    '',
    'max.mustermann@example.de',
    '+4915112345678',
    'GKV',
    'Techniker Krankenkasse',
    '420',
    'allein versichert',
    'Beitrag',
    '10115',
    'Berlin',
    'Invalidenstraße 12',
    'deutschlandweit',
    'Erstgespräch vereinbart',
  ];
  const regional = [
    'Anna',
    'Schulz',
    '04.07.1988',
    'zusätzlich angestellt',
    '',
    'anna.schulz@example.de',
    '+491701234567',
    'PKV-Vollversicherung',
    'Continentale',
    '580',
    'Familie',
    'Beitrag',
    '34117',
    'Kassel',
    'Obere Königsstraße 22',
    'regional',
    'Regionaler Familientarif prüfen',
  ];
  const csv = Papa.unparse({ fields: headers, data: [example, regional] });
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vantaro-leads-vorlage.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function toggleListValue(list, value) {
  const current = Array.isArray(list) ? list : [];
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}
