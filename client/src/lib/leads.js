import Papa from 'papaparse';
import { apiUrl } from './api';
import { readStoredSession } from './auth';
import { normalizeState, stateForCity, stateForZip } from './germanRegions';
import { ENERGY_STATES } from './vertical';

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
  { id: 'in_bearbeitung', label: 'Wieder verfügbar' },
  { id: 'zugewiesen', label: 'Zugewiesen' },
  { id: 'erledigt', label: 'Erledigt' },
];

/** Assigned to a berater and not returned via Reklamation — view-only for admins. */
export function isLeadDeliveryLocked(lead) {
  return Boolean(lead?.assignedTo) && !lead?.refundedAt;
}

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
  status: Object.fromEntries(STATUS_OPTIONS.map((item) => [item.id, item.label])),
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
  const street = [lead?.street, lead?.houseNumber].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
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
  if (params.vertical) search.set('vertical', params.vertical);
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

export async function assignLeadToBerater(id, payload) {
  const response = await fetch(apiUrl(`/api/leads/${id}/assign`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
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

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('CSV konnte nicht gelesen werden.'));
    reader.onload = () => resolve(String(reader.result || '').replace(/^\uFEFF/, ''));
    reader.readAsText(file);
  });
}

function parseCsvText(text, headerLookup) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: detectCsvDelimiter(text),
      transformHeader: (header) => headerLookup[normalizeHeader(header)] || header.trim(),
      complete(result) {
        if (result.errors?.length && !result.data?.length) {
          reject(new Error(result.errors[0].message || 'CSV konnte nicht gelesen werden.'));
          return;
        }
        resolve(result.data || []);
      },
      error(error) {
        reject(error);
      },
    });
  });
}

function downloadCsv(filename, fields, data) {
  const csv = Papa.unparse({ fields, data });
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const APPOINTMENT_CSV_COLUMNS = [
  { header: 'Produkt', key: 'energyProduct' },
  { header: 'Termin Datum', key: 'appointmentDate' },
  { header: 'Termin Uhrzeit', key: 'appointmentTime' },
  { header: 'Vorname', key: 'firstName' },
  { header: 'Nachname', key: 'lastName' },
  { header: 'Telefon', key: 'phone' },
  { header: 'E-Mail', key: 'email' },
  { header: 'Straße', key: 'street' },
  { header: 'Hausnummer', key: 'houseNumber' },
  { header: 'PLZ', key: 'zip' },
  { header: 'Ort', key: 'city' },
  { header: 'Bundesland', key: 'state' },
  { header: 'Eigentümerstatus', key: 'ownerStatus' },
  { header: 'Zeitrahmen', key: 'timeframe' },
  { header: 'Bedarf', key: 'energyNeed' },
  { header: 'Gesprächszusammenfassung', key: 'callSummary' },
  { header: 'Einwilligungsstatus', key: 'consentStatus' },
  { header: 'Nachweisquelle', key: 'evidenceSource' },
  { header: 'Jahresstromverbrauch', key: 'annualConsumption' },
  { header: 'Bestehende PV-Anlage', key: 'existingPv' },
  { header: 'Dach- oder Gebäudehinweise', key: 'roofNotes' },
  { header: 'Aktuelle Heizung', key: 'heatingSystem' },
  { header: 'Energieträger', key: 'energySource' },
  { header: 'Baujahr oder Gebäudeinfo', key: 'constructionYear' },
  { header: 'Gewünschter Austauschzeitraum', key: 'replacementTimeframe' },
];

const ENERGY_HEADER_LOOKUP = {
  ...CSV_HEADER_LOOKUP,
  ...Object.fromEntries(APPOINTMENT_CSV_COLUMNS.map((column) => [normalizeHeader(column.header), column.key])),
  product: 'energyProduct',
  energieprodukt: 'energyProduct',
  energyproduct: 'energyProduct',
  energy_product: 'energyProduct',
  lieferart: 'deliveryType',
  deliverytype: 'deliveryType',
  delivery_type: 'deliveryType',
  appointmentat: 'appointmentAt',
  appointment_at: 'appointmentAt',
  termin: 'appointmentDate',
  datum: 'appointmentDate',
  terminzeit: 'appointmentTime',
  uhrzeit: 'appointmentTime',
  zeit: 'appointmentTime',
  bundesland: 'state',
  state: 'state',
  vertical: 'vertical',
  hausnr: 'houseNumber',
  'hausnr.': 'houseNumber',
  hausnummer: 'houseNumber',
  housenumber: 'houseNumber',
  house_number: 'houseNumber',
  stadt: 'city',
};

const ENERGY_HEADER_MARKERS = new Set([
  'energyproduct',
  'produkt',
  'deliverytype',
  'lieferart',
  'appointmentat',
  'termin datum',
  'termin uhrzeit',
  'bundesland',
  'housenumber',
  'hausnummer',
  'ownerstatus',
  'eigentümerstatus',
  'callsummary',
  'gesprächszusammenfassung',
  'vertical',
  'existingpv',
  'heatingsystem',
]);

function csvHeaderKeys(text) {
  const line = String(text || '').split(/\r?\n/).find((entry) => entry.trim()) || '';
  const parsed = Papa.parse(line, { delimiter: detectCsvDelimiter(text), header: false });
  return (parsed.data?.[0] || []).map((header) => String(header || '').trim()).filter(Boolean);
}

function isEnergyCsvText(text) {
  return csvHeaderKeys(text).some((header) => ENERGY_HEADER_MARKERS.has(normalizeHeader(header)));
}

function csvText(value) {
  return String(value ?? '').trim();
}

function csvEnergyProduct(value) {
  const text = csvText(value).toLowerCase();
  if (/^(pv|photovoltaik|photovoltaic|solar)/.test(text)) return 'photovoltaic';
  if (/^(wp|wärmepumpe|waermepumpe|heat[ _-]?pump)/.test(text)) return 'heat_pump';
  return csvText(value);
}

function csvExistingPv(value) {
  const text = csvText(value).toLowerCase();
  if (['ja', 'yes', 'j', 'y'].includes(text)) return 'yes';
  if (['nein', 'no', 'n'].includes(text)) return 'no';
  if (['unbekannt', 'unknown', 'weiß nicht', 'weiss nicht'].includes(text)) return 'unknown';
  return csvText(value);
}

function csvState(value, city, zip) {
  return normalizeState(value)
    || ENERGY_STATES.find((name) => name.toLowerCase() === csvText(value).toLowerCase())
    || stateForCity(city)
    || stateForZip(zip)
    || csvText(value);
}

function splitStreetAndNumber(street, houseNumber) {
  const number = csvText(houseNumber);
  const line = csvText(street);
  if (number) return { street: line, houseNumber: number };
  const match = line.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)$/);
  if (match) return { street: match[1].trim(), houseNumber: match[2] };
  return { street: line, houseNumber: '' };
}

const INVALID_APPOINTMENT = 'ungültig';

function parseLocalAppointment(dateText, timeText) {
  let date = csvText(dateText);
  let time = csvText(timeText);
  if (!date && !time) return null;
  if (!time) {
    const isoStamp = date.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)$/);
    if (isoStamp) {
      const at = new Date(isoStamp[1]);
      return Number.isNaN(at.getTime()) ? INVALID_APPOINTMENT : at.toISOString();
    }
    const combined = date.match(/^(\S+)[\sT]+(\d{1,2}[:.]\d{2})/);
    if (combined) [, date, time] = combined;
  }
  const german = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  const iso = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const clock = time.match(/^(\d{1,2})(?:[:.](\d{2}))?/);
  if (!(german || iso) || !clock) return INVALID_APPOINTMENT;
  const [day, month, year] = german
    ? [Number(german[1]), Number(german[2]), Number(german[3].length === 2 ? `20${german[3]}` : german[3])]
    : [Number(iso[3]), Number(iso[2]), Number(iso[1])];
  const at = new Date(year, month - 1, day, Number(clock[1]), Number(clock[2] || 0));
  if (Number.isNaN(at.getTime()) || at.getDate() !== day || at.getMonth() !== month - 1) {
    return INVALID_APPOINTMENT;
  }
  return at.toISOString();
}

function csvAppointmentAt(row) {
  const direct = parseLocalAppointment(row.appointmentAt, '');
  if (direct) return direct;
  return parseLocalAppointment(row.appointmentDate, row.appointmentTime);
}

function csvDeliveryType(value, appointmentAt) {
  const text = csvText(value).toLowerCase();
  if (['appointment', 'termin', 'fester termin'].includes(text)) return 'appointment';
  if (['lead', 'kontakt'].includes(text)) return 'lead';
  return appointmentAt ? 'appointment' : 'lead';
}

function mapEnergyCsvRow(row) {
  const product = csvEnergyProduct(row.energyProduct);
  const isPv = product === 'photovoltaic';
  const text = (key) => csvText(row[key]);
  const appointmentAt = csvAppointmentAt(row);
  const { street, houseNumber } = splitStreetAndNumber(row.street, row.houseNumber);
  const zip = text('zip');
  const city = text('city');
  return {
    vertical: 'energy',
    deliveryType: csvDeliveryType(row.deliveryType, appointmentAt),
    energyProduct: product,
    appointmentAt,
    firstName: text('firstName'),
    lastName: text('lastName'),
    phone: text('phone'),
    email: text('email'),
    street,
    houseNumber,
    zip,
    city,
    state: csvState(row.state, city, zip),
    ownerStatus: text('ownerStatus'),
    timeframe: text('timeframe'),
    energyNeed: text('energyNeed'),
    callSummary: text('callSummary'),
    consentStatus: text('consentStatus'),
    evidenceSource: text('evidenceSource'),
    notes: text('notes'),
    scope: text('scope'),
    annualConsumption: isPv ? text('annualConsumption') : '',
    existingPv: isPv ? csvExistingPv(row.existingPv) : '',
    roofNotes: isPv ? text('roofNotes') : '',
    heatingSystem: isPv ? '' : text('heatingSystem'),
    energySource: isPv ? '' : text('energySource'),
    constructionYear: isPv ? '' : text('constructionYear'),
    replacementTimeframe: isPv ? '' : text('replacementTimeframe'),
  };
}

export async function parseImportCsv(file) {
  const text = await readFileText(file);
  if (isEnergyCsvText(text)) {
    const rows = (await parseCsvText(text, ENERGY_HEADER_LOOKUP)).map(mapEnergyCsvRow);
    return { kind: 'energy', rows };
  }
  const rows = (await parseCsvText(text, CSV_HEADER_LOOKUP)).map(cleanCsvRow);
  return { kind: 'insurance', rows };
}

export async function parseLeadCsv(file) {
  const parsed = await parseImportCsv(file);
  return parsed.rows;
}

export async function parseAppointmentCsv(file) {
  const parsed = await parseImportCsv(file);
  return parsed.rows.filter((row) => row.deliveryType === 'appointment');
}

function templateDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function downloadAppointmentCsvTemplate() {
  const headers = APPOINTMENT_CSV_COLUMNS.map((column) => column.header);
  const photovoltaic = {
    energyProduct: 'Photovoltaik',
    appointmentDate: templateDate(7),
    appointmentTime: '14:00',
    firstName: 'Max',
    lastName: 'Mustermann',
    phone: '+4915112345678',
    email: 'max.mustermann@example.de',
    street: 'Invalidenstraße',
    houseNumber: '12',
    zip: '10115',
    city: 'Berlin',
    state: 'Berlin',
    ownerStatus: 'Eigentümer',
    timeframe: 'In den nächsten 3 Monaten',
    energyNeed: 'PV-Anlage mit Speicher',
    callSummary: 'Interessiert an PV mit Speicher, Dach nach Süden',
    consentStatus: 'Telefonisch eingewilligt',
    evidenceSource: 'Telefonat',
    annualConsumption: '4500 kWh',
    existingPv: 'nein',
    roofNotes: 'Satteldach, ca. 60 m²',
  };
  const heatPump = {
    energyProduct: 'Wärmepumpe',
    appointmentDate: templateDate(10),
    appointmentTime: '10:30',
    firstName: 'Anna',
    lastName: 'Schulz',
    phone: '+491701234567',
    email: 'anna.schulz@example.de',
    street: 'Obere Königsstraße',
    houseNumber: '22',
    zip: '34117',
    city: 'Kassel',
    state: 'Hessen',
    ownerStatus: 'Eigentümerin',
    timeframe: 'Dieses Jahr',
    energyNeed: 'Gasheizung durch Wärmepumpe ersetzen',
    callSummary: 'Alte Gasheizung, möchte Förderung nutzen',
    consentStatus: 'Telefonisch eingewilligt',
    evidenceSource: 'Telefonat',
    heatingSystem: 'Gasheizung',
    energySource: 'Erdgas',
    constructionYear: '1995',
    replacementTimeframe: 'In 6 Monaten',
  };
  const toRow = (entry) => APPOINTMENT_CSV_COLUMNS.map((column) => entry[column.key] || '');
  downloadCsv('vantaro-termine-vorlage.csv', headers, [toRow(photovoltaic), toRow(heatPump)]);
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
  downloadCsv('vantaro-leads-vorlage.csv', headers, [example, regional]);
}

export function toggleListValue(list, value) {
  const current = Array.isArray(list) ? list : [];
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}
