import { supabase, supabaseConfig } from './supabase.js';
import { ROLES, getUserRole } from './roles.js';
import { toDirectoryUser } from './users.js';
import { DEFAULT_LEAD_SCOPE, LEAD_SCOPES, leadScopeOrDefault, normalizeLeadScope } from './scopes.js';
import {
  ENERGY_DELIVERY_TYPES,
  ENERGY_PRODUCTS,
  ENERGY_STATES,
  EXISTING_PV,
  energySchemaMissing,
  normalizeVertical,
  verticalColumnMissing,
  verticalOrInsurance,
} from './vertical.js';

export const EMPLOYMENT_STATUSES = ['selbststaendig', 'zusaetzlich_angestellt', 'sonstiges'];
export const INSURANCE_STATUSES = ['gkv', 'pkv_voll', 'zusatz', 'unbekannt'];
export const COVERAGE_CIRCLES = ['allein', 'partner', 'kinder', 'familie'];
export const MAIN_CONCERNS = ['beitrag', 'leistungen', 'krankentagegeld', 'check'];
export const LEAD_STATUSES = ['neu', 'in_bearbeitung', 'zugewiesen', 'erledigt'];
export const CONTACT_STATUSES = ['neu', 'kontaktiert', 'termin', 'wiedervorlage', 'abgeschlossen'];
export const CLOSE_OUTCOMES = ['erfolgreich', 'fehlgeschlagen'];
export const LEAD_SOURCES = ['csv', 'manual', 'api'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}$/;

/** Assigned and not refunded via Reklamation — immutable until complaint parking. */
export function isLeadDeliveryLocked(row) {
  if (!row) return false;
  return Boolean(row.assigned_to || row.assignedTo) && !(row.refunded_at || row.refundedAt);
}

function trim(value) {
  if (value == null) return '';
  return String(value).trim();
}

function fold(value) {
  return trim(value)
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function aliasMap(pairs) {
  const map = {};
  for (const [target, keys] of Object.entries(pairs)) {
    for (const key of keys) map[fold(key)] = target;
  }
  return map;
}

const EMPLOYMENT_ALIASES = aliasMap({
  selbststaendig: [
    'selbststaendig',
    'selbstständig',
    'hauptberuflich selbststaendig',
    'hauptberuflich selbstständig',
    'self-employed',
    'self employed',
    'freelancer',
    'freiberuflich',
  ],
  zusaetzlich_angestellt: [
    'zusaetzlich_angestellt',
    'zusaetzlich angestellt',
    'zusätzlich angestellt',
    'angestellt',
    'employed',
  ],
  sonstiges: ['sonstiges', 'other', 'sonstige'],
});

const INSURANCE_ALIASES = aliasMap({
  gkv: ['gkv', 'gesetzlich', 'gesetzliche krankenversicherung'],
  pkv_voll: [
    'pkv_voll',
    'pkv-vollversicherung',
    'pkv vollversicherung',
    'pkv',
    'privat',
    'privatversichert',
    'private krankenversicherung',
  ],
  zusatz: ['zusatz', 'zusatzversicherung'],
  unbekannt: ['unbekannt', 'unknown', 'k.a.', 'ka'],
});

const COVERAGE_ALIASES = aliasMap({
  allein: ['allein', 'allein versichert', 'single', 'alone', 'selbst'],
  partner: ['partner', 'partnerin', 'ehepartner', 'spouse'],
  kinder: ['kinder', 'kind', 'child', 'children', 'kids'],
  familie: ['familie', 'family', 'families', 'famile', 'familien'],
});

const CONCERN_ALIASES = aliasMap({
  beitrag: ['beitrag', 'beitraege', 'premium', 'contribution'],
  leistungen: ['leistungen', 'leistung', 'benefits'],
  krankentagegeld: ['krankentagegeld'],
  check: ['check', 'allgemeiner check', 'pruefung', 'prüfung'],
});

export function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function emptyToNull(value) {
  const text = trim(value);
  return text || null;
}

function parseIsoTimestamp(value, label) {
  if (value == null || value === '') return { value: null };
  const raw = trim(value);
  if (!/^\d{1,2}\.\d{1,2}\./.test(raw)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime()) && /\d{4}/.test(raw)) {
      return { value: date.toISOString() };
    }
  }
  let dateText = raw;
  let timeText = '';
  const combined = raw.match(/^(\d{1,2}\.\d{1,2}\.\d{2,4})[\sT]+(\d{1,2}[:.]\d{2})/);
  const isoDay = raw.match(/^(\d{4}-\d{1,2}-\d{1,2})[\sT]+(\d{1,2}[:.]\d{2})/);
  if (combined) [, dateText, timeText] = combined;
  else if (isoDay) [, dateText, timeText] = isoDay;
  const german = dateText.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  const iso = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const clock = timeText.match(/^(\d{1,2})(?:[:.](\d{2}))?/);
  if ((german || iso) && clock) {
    const [day, month, year] = german
      ? [Number(german[1]), Number(german[2]), Number(german[3].length === 2 ? `20${german[3]}` : german[3])]
      : [Number(iso[3]), Number(iso[2]), Number(iso[1])];
    const at = new Date(year, month - 1, day, Number(clock[1]), Number(clock[2] || 0));
    if (!Number.isNaN(at.getTime()) && at.getDate() === day && at.getMonth() === month - 1) {
      return { value: at.toISOString() };
    }
  }
  return { error: `${label} ist ungültig.` };
}

function uniqueAllowed(values, allowed) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!allowed.includes(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => trim(entry)).filter(Boolean);
  }
  return trim(value)
    .split(/[;|,]/)
    .map((entry) => trim(entry))
    .filter(Boolean);
}

function mapAlias(value, aliases) {
  const key = fold(value);
  return aliases[key] || null;
}

export function parseDateOfBirth(value) {
  const text = trim(value);
  if (!text) return null;

  let year;
  let month;
  let day;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const de = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (de) {
    day = Number(de[1]);
    month = Number(de[2]);
    year = Number(de[3]);
  } else {
    return { error: 'Geburtsdatum muss TT.MM.JJJJ sein.' };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return { error: 'Geburtsdatum ist ungültig.' };
  }
  if (year < 1900 || date.getTime() > Date.now()) {
    return { error: 'Geburtsdatum ist ungültig.' };
  }

  return { value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

export function parseMonthlyPremium(value) {
  if (value == null || value === '') return { value: null };
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return { error: 'Monatlicher Beitrag ist ungültig.' };
    return { value: Math.round(value * 100) / 100 };
  }

  let text = trim(value).replace(/\s*€|\s*euro/gi, '').trim();
  if (!text) return { value: null };

  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: 'Monatlicher Beitrag ist ungültig.' };
  }
  return { value: Math.round(amount * 100) / 100 };
}

function parseEmployment(raw, { lenient = false } = {}) {
  const text = trim(raw);
  if (!text) return { value: null };
  const mapped = mapAlias(text, EMPLOYMENT_ALIASES);
  if (!mapped) {
    return lenient ? { value: null } : { error: 'Berufliche Situation ist ungültig.' };
  }
  return { value: mapped };
}

function parseEnumList(raw, aliases, allowed, label, { lenient = false } = {}) {
  const items = splitList(raw);
  if (!items.length) return { value: [] };
  const mapped = [];
  for (const item of items) {
    const value = mapAlias(item, aliases);
    if (!value) {
      if (lenient) continue;
      return { error: `${label} enthält einen ungültigen Wert: ${item}` };
    }
    mapped.push(value);
  }
  return { value: uniqueAllowed(mapped, allowed) };
}

function looksLikeNotes(value) {
  const text = trim(value);
  if (!text) return false;
  if (normalizeLeadScope(text)) return false;
  return /\s/.test(text) || text.length > 24;
}

function isTruthyFlag(value) {
  return /^(1|true|yes|ja|y|regional)$/i.test(trim(value));
}

export function inferImportScope(input = {}) {
  const direct = normalizeLeadScope(input.scope ?? input.package ?? input.paket);
  if (direct) return direct;

  for (const [key, value] of Object.entries(input)) {
    const header = fold(key);
    const mapped = normalizeLeadScope(value);
    if (mapped) return mapped;
    if ((header === 'regional' || header === 'region') && isTruthyFlag(value)) {
      return 'regional';
    }
    if ((header === 'exklusiv' || header === 'exclusive') && isTruthyFlag(value)) {
      return 'deutschlandweit';
    }
  }

  const zip = trim(input.zip).replace(/\D/g, '');
  if (zip.length === 5) {
    return Number(zip[zip.length - 1]) >= 5 ? 'regional' : 'deutschlandweit';
  }
  return '';
}

export function recoverImportFields(input = {}) {
  const next = { ...input };
  const rawScope = next.scope ?? next.package ?? next.paket;
  if (looksLikeNotes(rawScope) && !trim(next.notes)) {
    next.notes = trim(rawScope);
    next.scope = '';
    next.package = '';
    next.paket = '';
  }
  const inferred = inferImportScope(next);
  if (inferred) next.scope = inferred;
  return next;
}

export function tableMissing(error) {
  const message = String(error?.message || error?.code || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /could not find the table/i.test(message)
    || /relation .* does not exist/i.test(message)
    || /schema cache/i.test(message);
}

export function tableMissingResponse(res, message) {
  return res.status(503).json({
    error: message || 'Lead-Tabelle fehlt. Bitte server/supabase/leads.sql im Supabase SQL Editor ausführen.',
  });
}

export function toPublicLead(row, assignee = null) {
  if (!row) return null;
  const firstName = row.first_name || '';
  const lastName = row.last_name || '';
  return {
    id: row.id,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    dateOfBirth: row.date_of_birth || null,
    employmentStatus: row.employment_status || null,
    employmentOther: row.employment_other || null,
    email: row.email || null,
    phone: row.phone || null,
    insuranceStatus: row.insurance_status || [],
    currentInsurer: row.current_insurer || null,
    monthlyPremium: row.monthly_premium == null ? null : Number(row.monthly_premium),
    coverageCircle: row.coverage_circle || [],
    mainConcerns: row.main_concerns || [],
    zip: row.zip || null,
    city: row.city || null,
    street: row.street || null,
    notes: row.notes || null,
    brokerNotes: row.broker_notes || null,
    contactStatus: CONTACT_STATUSES.includes(row.contact_status) ? row.contact_status : null,
    closeOutcome: CLOSE_OUTCOMES.includes(row.close_outcome) ? row.close_outcome : null,
    appointmentAt: row.appointment_at || null,
    followUpAt: row.follow_up_at || null,
    followUpRemindedAt: row.follow_up_reminded_at || null,
    followUpSoonRemindedAt: row.follow_up_soon_reminded_at || null,
    appointmentRemindedAt: row.appointment_reminded_at || null,
    appointmentSoonRemindedAt: row.appointment_soon_reminded_at || null,
    status: row.status,
    scope: leadScopeOrDefault(row.scope),
    assignedTo: row.assigned_to || null,
    assignedToName: assignee?.fullName || null,
    assignedToEmail: assignee?.email || null,
    assignedAt: row.assigned_at || null,
    requestId: row.request_id || null,
    refundedAt: row.refunded_at || null,
    reportedAt: row.reported_at || null,
    source: row.source,
    vertical: verticalOrInsurance(row.vertical),
    houseNumber: row.house_number || null,
    state: row.state || null,
    energyProduct: row.energy_product || null,
    deliveryType: row.delivery_type || 'lead',
    energyHolderId: row.energy_holder_id || null,
    calendarSyncStatus: row.calendar_sync_status || null,
    ownerStatus: row.owner_status || null,
    energyNeed: row.energy_need || null,
    timeframe: row.timeframe || null,
    callSummary: row.call_summary || null,
    consentStatus: row.consent_status || null,
    evidenceSource: row.evidence_source || null,
    annualConsumption: row.annual_consumption || null,
    existingPv: row.existing_pv || null,
    roofNotes: row.roof_notes || null,
    heatingSystem: row.heating_system || null,
    energySource: row.energy_source || null,
    constructionYear: row.construction_year || null,
    replacementTimeframe: row.replacement_timeframe || null,
    externalSource: row.external_source || null,
    externalId: row.external_id || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hasField(body, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

export function parseLeadInput(body = {}, { partial = false, lenient = false } = {}) {
  const errors = [];
  const row = {};

  if (!partial || hasField(body, 'firstName', 'first_name')) {
    const firstName = emptyToNull(body.firstName ?? body.first_name);
    if (!firstName) errors.push('Vorname ist erforderlich.');
    else row.first_name = firstName;
  }

  if (!partial || hasField(body, 'lastName', 'last_name')) {
    const lastName = emptyToNull(body.lastName ?? body.last_name);
    if (!lastName) errors.push('Nachname ist erforderlich.');
    else row.last_name = lastName;
  }

  const hasDob = 'dateOfBirth' in body || 'date_of_birth' in body;
  if (!partial || hasDob) {
    const dob = parseDateOfBirth(body.dateOfBirth ?? body.date_of_birth);
    if (dob?.error) errors.push(dob.error);
    else if (!partial || hasDob) row.date_of_birth = dob?.value || null;
  }

  const hasEmployment = 'employmentStatus' in body || 'employment_status' in body;
  if (!partial || hasEmployment) {
    const employment = parseEmployment(body.employmentStatus ?? body.employment_status, { lenient });
    if (employment.error) errors.push(employment.error);
    else if (!partial || hasEmployment) row.employment_status = employment.value;
  }

  const hasEmploymentOther = 'employmentOther' in body || 'employment_other' in body;
  if (!partial || hasEmploymentOther) {
    row.employment_other = emptyToNull(body.employmentOther ?? body.employment_other);
  }

  const hasEmail = 'email' in body;
  if (!partial || hasEmail) {
    const email = emptyToNull(body.email)?.toLowerCase() || null;
    if (email && !EMAIL_RE.test(email)) errors.push('E-Mail-Adresse ist ungültig.');
    else if (!partial || hasEmail) row.email = email;
  }

  const hasPhone = 'phone' in body;
  if (!partial || hasPhone) {
    row.phone = emptyToNull(body.phone);
  }

  const hasInsurance = 'insuranceStatus' in body || 'insurance_status' in body;
  if (!partial || hasInsurance) {
    const insurance = parseEnumList(
      body.insuranceStatus ?? body.insurance_status,
      INSURANCE_ALIASES,
      INSURANCE_STATUSES,
      'Versicherungsstatus',
      { lenient },
    );
    if (insurance.error) errors.push(insurance.error);
    else if (!partial || hasInsurance) row.insurance_status = insurance.value;
  }

  const hasInsurer = 'currentInsurer' in body || 'current_insurer' in body;
  if (!partial || hasInsurer) {
    row.current_insurer = emptyToNull(body.currentInsurer ?? body.current_insurer);
  }

  const hasPremium = 'monthlyPremium' in body || 'monthly_premium' in body;
  if (!partial || hasPremium) {
    const premium = parseMonthlyPremium(body.monthlyPremium ?? body.monthly_premium);
    if (premium.error) errors.push(premium.error);
    else if (!partial || hasPremium) row.monthly_premium = premium.value;
  }

  const hasCoverage = 'coverageCircle' in body || 'coverage_circle' in body;
  if (!partial || hasCoverage) {
    const coverage = parseEnumList(
      body.coverageCircle ?? body.coverage_circle,
      COVERAGE_ALIASES,
      COVERAGE_CIRCLES,
      'Personenkreis',
      { lenient },
    );
    if (coverage.error) errors.push(coverage.error);
    else if (!partial || hasCoverage) row.coverage_circle = coverage.value;
  }

  const hasConcerns = 'mainConcerns' in body || 'main_concerns' in body;
  if (!partial || hasConcerns) {
    const concerns = parseEnumList(
      body.mainConcerns ?? body.main_concerns,
      CONCERN_ALIASES,
      MAIN_CONCERNS,
      'Hauptanliegen',
      { lenient },
    );
    if (concerns.error) errors.push(concerns.error);
    else if (!partial || hasConcerns) row.main_concerns = concerns.value;
  }

  const hasZip = 'zip' in body;
  if (!partial || hasZip) {
    const zip = emptyToNull(body.zip);
    if (zip && !ZIP_RE.test(zip)) errors.push('PLZ muss 5 Ziffern haben.');
    else if (!partial || hasZip) row.zip = zip;
  }

  const hasCity = 'city' in body;
  if (!partial || hasCity) row.city = emptyToNull(body.city);

  const hasStreet = 'street' in body;
  if (!partial || hasStreet) row.street = emptyToNull(body.street);

  const hasScope = hasField(body, 'scope', 'package', 'paket');
  if (!partial || hasScope) {
    const raw = body.scope ?? body.package ?? body.paket;
    const scope = normalizeLeadScope(raw);
    if (trim(raw) && !scope) {
      if (lenient) row.scope = DEFAULT_LEAD_SCOPE;
      else errors.push('Paket muss deutschlandweit oder regional sein.');
    } else {
      row.scope = scope || DEFAULT_LEAD_SCOPE;
    }
  }

  const hasNotes = 'notes' in body;
  if (!partial || hasNotes) row.notes = emptyToNull(body.notes);

  const hasBrokerNotes = hasField(body, 'brokerNotes', 'broker_notes');
  if (hasBrokerNotes) row.broker_notes = emptyToNull(body.brokerNotes ?? body.broker_notes);

  const hasContact = hasField(body, 'contactStatus', 'contact_status');
  if (hasContact) {
    const contact = trim(body.contactStatus ?? body.contact_status);
    if (contact && !CONTACT_STATUSES.includes(contact)) errors.push('Gesprächsstatus ist ungültig.');
    else row.contact_status = contact || null;
  }

  const hasCloseOutcome = hasField(body, 'closeOutcome', 'close_outcome');
  if (hasCloseOutcome) {
    const outcome = trim(body.closeOutcome ?? body.close_outcome);
    if (outcome && !CLOSE_OUTCOMES.includes(outcome)) {
      errors.push('Abschluss-Ergebnis ist ungültig.');
    } else {
      row.close_outcome = outcome || null;
    }
  }

  if (hasContact && row.contact_status === 'abgeschlossen') {
    if (!hasCloseOutcome || !row.close_outcome) {
      errors.push('Bitte wählen Sie, ob der Lead erfolgreich oder nicht erfolgreich war.');
    }
  } else if (hasContact && row.contact_status !== 'abgeschlossen') {
    row.close_outcome = null;
  }

  const hasFollowUp = hasField(body, 'followUpAt', 'follow_up_at');
  if (hasFollowUp) {
    const followUp = parseIsoTimestamp(body.followUpAt ?? body.follow_up_at, 'Wiedervorlage');
    if (followUp.error) errors.push(followUp.error);
    else {
      row.follow_up_at = followUp.value;
      row.follow_up_reminded_at = null;
      row.follow_up_soon_reminded_at = null;
    }
  }

  const hasAppointment = hasField(body, 'appointmentAt', 'appointment_at');
  if (hasAppointment) {
    const appointment = parseIsoTimestamp(body.appointmentAt ?? body.appointment_at, 'Termin');
    if (appointment.error) errors.push(appointment.error);
    else {
      row.appointment_at = appointment.value;
      row.appointment_reminded_at = null;
      row.appointment_soon_reminded_at = null;
    }
  }

  if (row.contact_status === 'wiedervorlage') {
    if (!hasAppointment) {
      row.appointment_at = null;
      row.appointment_reminded_at = null;
      row.appointment_soon_reminded_at = null;
    }
  } else if (row.contact_status === 'termin') {
    if (!hasFollowUp) {
      row.follow_up_at = null;
      row.follow_up_reminded_at = null;
      row.follow_up_soon_reminded_at = null;
    }
  } else if (hasContact && row.contact_status && row.contact_status !== 'wiedervorlage' && row.contact_status !== 'termin') {
    if (!hasFollowUp) {
      row.follow_up_at = null;
      row.follow_up_reminded_at = null;
      row.follow_up_soon_reminded_at = null;
    }
    if (!hasAppointment) {
      row.appointment_at = null;
      row.appointment_reminded_at = null;
      row.appointment_soon_reminded_at = null;
    }
  }

  const hasStatus = 'status' in body;
  if (hasStatus) {
    const status = trim(body.status);
    if (!LEAD_STATUSES.includes(status)) errors.push('Status ist ungültig.');
    else row.status = status;
  }

  const hasSource = 'source' in body;
  if (!partial && hasSource) {
    const source = trim(body.source);
    if (source && !LEAD_SOURCES.includes(source)) errors.push('Quelle ist ungültig.');
    else if (source) row.source = source;
  }

  if (row.employment_status !== 'sonstiges') {
    if (!partial || hasEmployment || hasEmploymentOther) {
      if (row.employment_status && row.employment_status !== 'sonstiges') {
        row.employment_other = null;
      }
    }
  }

  applyEnergyFields(body, row, errors, { partial });

  return { row, errors };
}

function textField(body, ...keys) {
  const key = keys.find((item) => Object.prototype.hasOwnProperty.call(body, item));
  if (!key) return undefined;
  return emptyToNull(body[key]);
}

function applyEnergyFields(body, row, errors, { partial }) {
  const requested = normalizeVertical(body.vertical);
  if (!partial && Object.prototype.hasOwnProperty.call(body, 'vertical') && body.vertical && !requested) {
    errors.push('Bereich ist ungültig.');
  }
  if (!partial) row.vertical = requested || 'insurance';

  const isEnergy = (partial ? false : row.vertical === 'energy')
    || (partial && requested === 'energy');
  if (!isEnergy) return;

  const product = body.energyProduct ?? body.energy_product;
  const delivery = body.deliveryType ?? body.delivery_type;
  const hasProduct = product !== undefined;
  const hasDelivery = delivery !== undefined;

  if (!partial || hasProduct) {
    const value = String(product || '').trim();
    if (!ENERGY_PRODUCTS.includes(value)) errors.push('Produkt muss Photovoltaik oder Wärmepumpe sein.');
    else row.energy_product = value;
  }
  if (!partial || hasDelivery) {
    const value = String(delivery || '').trim();
    if (!ENERGY_DELIVERY_TYPES.includes(value)) errors.push('Lieferart muss Lead oder fester Termin sein.');
    else row.delivery_type = value;
  }

  const required = [
    ['houseNumber', 'house_number', 'house_number', 'Hausnummer ist erforderlich.'],
    ['state', 'state', 'state', 'Bundesland ist erforderlich.'],
    ['ownerStatus', 'owner_status', 'owner_status', 'Eigentümerstatus ist erforderlich.'],
    ['energyNeed', 'energy_need', 'energy_need', 'Bedarf ist erforderlich.'],
    ['timeframe', 'timeframe', 'timeframe', 'Zeitrahmen ist erforderlich.'],
    ['callSummary', 'call_summary', 'call_summary', 'Gesprächszusammenfassung ist erforderlich.'],
    ['consentStatus', 'consent_status', 'consent_status', 'Einwilligungsstatus ist erforderlich.'],
    ['evidenceSource', 'evidence_source', 'evidence_source', 'Quelle ist erforderlich.'],
  ];

  required.forEach(([camel, snake, column, message]) => {
    const present = camel in body || snake in body;
    if (!partial || present) {
      const value = textField(body, camel, snake);
      if (!value) errors.push(message);
      else row[column] = value;
    }
  });

  if (row.state && !ENERGY_STATES.includes(row.state)) {
    errors.push('Bundesland ist ungültig.');
  }

  if (!partial || 'street' in body) {
    if (!row.street) errors.push('Straße ist erforderlich.');
  }
  if (!partial || 'zip' in body) {
    if (!row.zip) errors.push('PLZ ist erforderlich.');
  }
  if (!partial || 'city' in body) {
    if (!row.city) errors.push('Ort ist erforderlich.');
  }
  if (!partial || 'phone' in body) {
    if (!row.phone) errors.push('Telefonnummer ist erforderlich.');
  }

  const optional = [
    ['annualConsumption', 'annual_consumption', 'annual_consumption'],
    ['roofNotes', 'roof_notes', 'roof_notes'],
    ['heatingSystem', 'heating_system', 'heating_system'],
    ['energySource', 'energy_source', 'energy_source'],
    ['constructionYear', 'construction_year', 'construction_year'],
    ['replacementTimeframe', 'replacement_timeframe', 'replacement_timeframe'],
  ];
  optional.forEach(([camel, snake, column]) => {
    if (camel in body || snake in body) row[column] = textField(body, camel, snake);
  });

  const existing = body.existingPv ?? body.existing_pv;
  if (existing !== undefined) {
    const value = String(existing || '').trim();
    if (value && !EXISTING_PV.includes(value)) errors.push('Bestehende PV-Anlage muss ja, nein oder unbekannt sein.');
    else row.existing_pv = value || null;
  }

  const productValue = row.energy_product;
  const deliveryValue = row.delivery_type;
  if (!partial && productValue === 'photovoltaic' && !EXISTING_PV.includes(row.existing_pv)) {
    errors.push('Bestehende PV-Anlage muss ja, nein oder unbekannt sein.');
  }
  if (!partial && productValue === 'heat_pump') {
    if (!row.heating_system) errors.push('Aktuelle Heizung ist erforderlich.');
    if (!row.energy_source) errors.push('Energieträger ist erforderlich.');
    if (!row.replacement_timeframe) errors.push('Gewünschter Austauschzeitraum ist erforderlich.');
  }
  if (!partial && deliveryValue === 'appointment' && !row.appointment_at) {
    errors.push('Fester Termin braucht Datum und Uhrzeit.');
  }

  if (!partial && productValue === 'photovoltaic') {
    row.heating_system = null;
    row.energy_source = null;
    row.construction_year = null;
    row.replacement_timeframe = null;
  }
  if (!partial && productValue === 'heat_pump') {
    row.annual_consumption = null;
    row.existing_pv = null;
    row.roof_notes = null;
  }
}

async function getAssigneeMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const map = new Map();
  if (!unique.length || !supabase) return map;

  await Promise.all(unique.map(async (id) => {
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error || !data?.user) return;
    map.set(id, toDirectoryUser(data.user));
  }));

  return map;
}

export async function withAssignees(rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  const map = await getAssigneeMap(list.map((row) => row?.assigned_to));
  return list.map((row) => toPublicLead(row, map.get(row.assigned_to) || null));
}

export async function withAssignee(row) {
  const [lead] = await withAssignees([row]);
  return lead;
}

function sanitizeSearch(value) {
  return trim(value).replace(/[%_,()"\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function energySchemaError() {
  const error = new Error('Energie-Bereich fehlt. Bitte server/supabase/vertical.sql im Supabase SQL Editor ausführen.');
  error.status = 503;
  return error;
}

export async function listLeads({ status, assignedTo, search, scope, vertical } = {}) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const wanted = normalizeVertical(vertical);
  let query = supabase.from('leads').select('*').order('created_at', { ascending: false });

  if (status && LEAD_STATUSES.includes(status)) {
    query = query.eq('status', status);
  }

  if (scope && LEAD_SCOPES.includes(scope)) {
    query = query.eq('scope', scope);
  }

  if (wanted) query = query.eq('vertical', wanted);

  if (assignedTo === 'rejected') {
    query = query.not('refunded_at', 'is', null);
  } else if (assignedTo === 'unassigned') {
    query = query.is('assigned_to', null).is('refunded_at', null);
  } else if (assignedTo && isUuid(assignedTo)) {
    query = query.eq('assigned_to', assignedTo);
  } else {
    query = query.is('refunded_at', null);
  }

  const q = sanitizeSearch(search);
  if (q) {
    const pattern = `"%${q}%"`;
    query = query.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern},zip.ilike.${pattern},phone.ilike.${pattern}`,
    );
  }

  let { data, error } = await query;
  if (error && verticalColumnMissing(error)) {
    if (wanted === 'energy') throw energySchemaError();
    if (wanted === 'insurance') {
      query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (status && LEAD_STATUSES.includes(status)) query = query.eq('status', status);
      if (scope && LEAD_SCOPES.includes(scope)) query = query.eq('scope', scope);
      if (assignedTo === 'rejected') query = query.not('refunded_at', 'is', null);
      else if (assignedTo === 'unassigned') query = query.is('assigned_to', null).is('refunded_at', null);
      else if (assignedTo && isUuid(assignedTo)) query = query.eq('assigned_to', assignedTo);
      else query = query.is('refunded_at', null);
      const q = sanitizeSearch(search);
      if (q) {
        const pattern = `"%${q}%"`;
        query = query.or(
          `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern},zip.ilike.${pattern},phone.ilike.${pattern}`,
        );
      }
      ({ data, error } = await query);
    }
  }
  if (error) throw error;
  return withAssignees(data || []);
}

export async function listMyLeads(userId, { vertical } = {}) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const wanted = normalizeVertical(vertical) || 'insurance';
  let { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', userId)
    .eq('vertical', wanted)
    .order('assigned_at', { ascending: false });

  if (error && verticalColumnMissing(error)) {
    if (wanted === 'energy') throw energySchemaError();
    ({ data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', userId)
      .order('assigned_at', { ascending: false }));
  }

  if (error) throw error;
  return withAssignees(data || []);
}

export async function getLeadById(id) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findLeadByExternalId(externalSource, externalId) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const source = emptyToNull(externalSource);
  const id = emptyToNull(externalId);
  if (!source || !id) return null;

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('external_source', source)
    .eq('external_id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function schedulePoolAutoFill(reason) {
  import('./leadRequests.js')
    .then(({ autoFillOpenAutoRequests }) => autoFillOpenAutoRequests())
    .catch((err) => {
      console.warn(`Auto-fill after ${reason} skipped:`, err?.message || err);
    });
}

export async function createLead(input, {
  createdBy,
  source = 'manual',
  externalSource,
  externalId,
  lenient = false,
} = {}) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const parsed = parseLeadInput(input, { lenient });
  if (parsed.errors.length) {
    const error = new Error(parsed.errors[0]);
    error.status = 400;
    error.details = parsed.errors;
    throw error;
  }

  const payload = {
    ...parsed.row,
    // CSV / TC-Dial / manual create always enter the pool as new
    status: 'neu',
    source: LEAD_SOURCES.includes(source) ? source : 'manual',
    created_by: createdBy || null,
  };

  const extSource = emptyToNull(externalSource ?? input.externalSource ?? input.external_source);
  const extId = emptyToNull(externalId ?? input.externalId ?? input.external_id);
  if (extSource && extId) {
    payload.external_source = extSource;
    payload.external_id = extId;
  }

  let { data, error } = await supabase.from('leads').insert(payload).select('*').single();
  if (error && verticalColumnMissing(error) && payload.vertical !== 'energy') {
    const retryPayload = { ...payload };
    delete retryPayload.vertical;
    ({ data, error } = await supabase.from('leads').insert(retryPayload).select('*').single());
  }
  if (error && payload.vertical === 'energy' && (verticalColumnMissing(error) || energySchemaMissing(error))) {
    throw energySchemaError();
  }
  if (error) throw error;
  const lead = await withAssignee(data);
  schedulePoolAutoFill('createLead');
  return lead;
}

export async function importLeads(rows, { createdBy } = {}) {
  const created = [];
  const errors = [];

  (rows || []).forEach((input, index) => {
    const sheetRow = index + 2;
    const empty = !trim(input?.firstName || input?.first_name)
      && !trim(input?.lastName || input?.last_name)
      && !trim(input?.email)
      && !trim(input?.phone);
    if (empty) return;

    const parsed = parseLeadInput(recoverImportFields(input), { lenient: true });
    if (parsed.errors.length) {
      errors.push({ row: sheetRow, message: parsed.errors[0] });
      return;
    }
    created.push({
      ...parsed.row,
      status: 'neu',
      source: 'csv',
      created_by: createdBy || null,
    });
  });

  if (!created.length) {
    return { created: [], errors };
  }

  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  let { data, error } = await supabase.from('leads').insert(created).select('*');
  if (error && verticalColumnMissing(error)) {
    const retryRows = created.map((row) => {
      const next = { ...row };
      delete next.vertical;
      return next;
    });
    ({ data, error } = await supabase.from('leads').insert(retryRows).select('*'));
  }
  if (error && created.some((row) => row.vertical === 'energy')
    && (verticalColumnMissing(error) || energySchemaMissing(error))) {
    throw energySchemaError();
  }
  if (error) throw error;

  const leads = await withAssignees(data || []);
  if (leads.length) schedulePoolAutoFill('importLeads');
  return {
    created: leads,
    errors,
  };
}

export async function updateLead(id, input, { bypassDeliveryLock = false } = {}) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const current = await getLeadById(id);
  if (!current) return null;
  if (!bypassDeliveryLock && isLeadDeliveryLocked(current)) {
    const error = new Error(
      'Dieser Lead ist bereits zugestellt und kann nicht bearbeitet werden. Änderungen sind erst nach einer Reklamation wieder möglich.',
    );
    error.status = 400;
    throw error;
  }

  const parsed = parseLeadInput(input, { partial: true });
  if (parsed.errors.length) {
    const error = new Error(parsed.errors[0]);
    error.status = 400;
    error.details = parsed.errors;
    throw error;
  }

  if (!Object.keys(parsed.row).length) {
    return withAssignee(current);
  }

  if (Object.prototype.hasOwnProperty.call(parsed.row, 'close_outcome')) {
    const nextContact = Object.prototype.hasOwnProperty.call(parsed.row, 'contact_status')
      ? parsed.row.contact_status
      : current.contact_status;
    if (parsed.row.close_outcome && nextContact !== 'abgeschlossen') {
      const error = new Error('Abschluss-Ergebnis nur bei Status Abgeschlossen.');
      error.status = 400;
      throw error;
    }
    if (!parsed.row.close_outcome && nextContact === 'abgeschlossen') {
      const error = new Error('Bitte wählen Sie, ob der Lead erfolgreich oder nicht erfolgreich war.');
      error.status = 400;
      throw error;
    }
  }

  if (parsed.row.status === 'zugewiesen' && !current.assigned_to) {
    const error = new Error('Bitte zuerst einen Berater zuweisen.');
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from('leads')
    .update(parsed.row)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data ? withAssignee(data) : null;
}

export async function assignLead(id, beraterId, { requestId } = {}) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const current = await getLeadById(id);
  if (!current) return null;

  if (isLeadDeliveryLocked(current)) {
    const sameBerater = beraterId && beraterId === current.assigned_to;
    const sameRequest = !requestId || requestId === current.request_id;
    if (sameBerater && sameRequest) {
      return withAssignee(current);
    }
    const error = new Error(
      beraterId
        ? 'Dieser Lead ist bereits zugestellt und kann nicht neu zugewiesen werden. Rückgabe nur über eine Reklamation.'
        : 'Zugestellte Leads können nicht manuell zurückgenommen werden. Rückgabe nur über eine Reklamation.',
    );
    error.status = 400;
    throw error;
  }

  if (beraterId && current.refunded_at) {
    const error = new Error('Erstattete Leads können nicht erneut zugewiesen werden.');
    error.status = 400;
    throw error;
  }

  try {
    const { leadHasOpenComplaint } = await import('./complaints.js');
    if (await leadHasOpenComplaint(id)) {
      const error = new Error(
        beraterId
          ? 'Dieser Lead hat eine offene Reklamation und kann nicht zugewiesen werden.'
          : 'Dieser Lead hat eine offene Reklamation und kann nicht zurückgenommen werden.',
      );
      error.status = 400;
      throw error;
    }
  } catch (err) {
    if (err?.status === 400) throw err;
    const { complaintTableMissing } = await import('./complaints.js');
    if (!complaintTableMissing(err)) throw err;
  }

  if (!beraterId) {
    const nextStatus = current.status === 'zugewiesen' ? 'neu' : current.status;
    const { data, error } = await supabase
      .from('leads')
      .update({
        assigned_to: null,
        assigned_at: null,
        request_id: null,
        status: nextStatus,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const lead = await withAssignee(data);
    schedulePoolAutoFill('unassignLead');
    return lead;
  }

  if (!isUuid(beraterId)) {
    const error = new Error('Berater ist ungültig.');
    error.status = 400;
    throw error;
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(beraterId);
  if (userError || !userData?.user) {
    const error = new Error('Berater wurde nicht gefunden.');
    error.status = 400;
    throw error;
  }
  if (getUserRole(userData.user) !== ROLES.BERATER) {
    const error = new Error('Nur Berater können Leads zugewiesen bekommen.');
    error.status = 400;
    throw error;
  }

  const leadVertical = verticalOrInsurance(current.vertical);
  const beraterMetadata = userData.user.user_metadata || {};
  if (verticalOrInsurance(beraterMetadata.vertical) !== leadVertical) {
    const error = new Error(
      leadVertical === 'energy'
        ? 'Energie-Leads können nur Berater im Bereich Energie erhalten.'
        : 'Versicherungs-Leads können nur Berater im Bereich Versicherung erhalten.',
    );
    error.status = 400;
    throw error;
  }
  if (
    leadVertical === 'energy'
    && beraterMetadata.energy_company_id
    && beraterMetadata.energy_company_id !== beraterId
  ) {
    const error = new Error('Unterpartner erhalten Leads über ihre Hauptfirma.');
    error.status = 400;
    throw error;
  }

  const { data: requestRows, error: activeError } = await supabase
    .from('lead_requests')
    .select('id, berater_id, status, code, vertical')
    .eq('berater_id', beraterId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (activeError) throw activeError;
  const activeRequests = (requestRows || []).filter(
    (entry) => verticalOrInsurance(entry.vertical) === leadVertical,
  );
  if (!activeRequests.length) {
    const error = new Error('Nur Berater mit aktivem Auftrag in diesem Bereich können Leads erhalten.');
    error.status = 400;
    throw error;
  }

  let resolvedRequestId = requestId;
  if (resolvedRequestId) {
    if (!isUuid(resolvedRequestId)) {
      const error = new Error('Anforderung ist ungültig.');
      error.status = 400;
      throw error;
    }
    const matched = activeRequests.find((entry) => entry.id === resolvedRequestId);
    if (!matched) {
      const error = new Error('Die gewählte Anforderung ist nicht aktiv oder gehört nicht zu diesem Berater.');
      error.status = 400;
      throw error;
    }
  } else if (resolvedRequestId === null) {
    resolvedRequestId = null;
  } else {
    resolvedRequestId = activeRequests[0].id;
  }

  const patch = {
    assigned_to: beraterId,
    assigned_at: new Date().toISOString(),
    status: 'zugewiesen',
    request_id: resolvedRequestId,
  };

  if (!current.contact_status) {
    patch.contact_status = current.delivery_type === 'appointment' ? 'termin' : 'neu';
  }

  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return withAssignee(data);
}

export async function restoreRejectedLead(id) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const current = await getLeadById(id);
  if (!current) return null;
  if (!current.refunded_at) {
    const error = new Error('Dieser Lead ist nicht verworfen.');
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from('leads')
    .update({
      assigned_to: null,
      assigned_at: null,
      request_id: null,
      refunded_at: null,
      reported_at: null,
      // Returned to pool after Reklamation + admin check
      status: 'in_bearbeitung',
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const lead = await withAssignee(data);
  schedulePoolAutoFill('restoreRejectedLead');
  return lead;
}

export async function deleteLead(id) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const current = await getLeadById(id);
  if (!current) return false;
  if (isLeadDeliveryLocked(current)) {
    const error = new Error(
      'Zugestellte Leads können nicht gelöscht werden. Rückgabe nur über eine Reklamation.',
    );
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabase.from('leads').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function countLeadStats() {
  if (!supabaseConfig.configured || !supabase) {
    return { total: 0, qualityQueue: 0, unmatched: 0, recent: [] };
  }

  const [totalRes, neuRes, unmatchedRes, recentRes] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'neu'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).is('assigned_to', null).is('refunded_at', null),
    supabase.from('leads').select('*').is('refunded_at', null).order('created_at', { ascending: false }).limit(5),
  ]);

  const firstError = totalRes.error || neuRes.error || unmatchedRes.error || recentRes.error;
  if (firstError) {
    if (tableMissing(firstError)) {
      return { total: 0, qualityQueue: 0, unmatched: 0, recent: [] };
    }
    throw firstError;
  }

  return {
    total: totalRes.count || 0,
    qualityQueue: neuRes.count || 0,
    unmatched: unmatchedRes.count || 0,
    recent: await withAssignees(recentRes.data || []),
  };
}

export function handleLeadError(res, error) {
  if (error?.status) {
    return res.status(error.status).json({
      error: error.message,
      details: error.details,
    });
  }
  if (tableMissing(error)) {
    return tableMissingResponse(res);
  }
  if (/column .*scope/i.test(String(error?.message || ''))) {
    return tableMissingResponse(
      res,
      'Lead-Pakete fehlen. Bitte server/supabase/lead_scope.sql im Supabase SQL Editor ausführen.',
    );
  }
  if (/broker_notes/i.test(String(error?.message || error?.code || ''))) {
    return tableMissingResponse(
      res,
      'Berater-Notizen fehlen. Bitte server/supabase/lead_workflow.sql im Supabase SQL Editor ausführen.',
    );
  }
  if (/contact_status|appointment_at|follow_up_at|follow_up_reminded_at|appointment_reminded_at|follow_up_soon_reminded_at|appointment_soon_reminded_at/i.test(String(error?.message || error?.code || ''))) {
    return tableMissingResponse(
      res,
      'Wiedervorlage fehlt. Bitte server/supabase/lead_follow_up.sql und server/supabase/lead_schedule_remind.sql im Supabase SQL Editor ausführen.',
    );
  }
  if (/close_outcome/i.test(String(error?.message || error?.code || ''))) {
    return tableMissingResponse(
      res,
      'Abschluss-Ergebnis fehlt. Bitte server/supabase/lead_close_outcome.sql im Supabase SQL Editor ausführen.',
    );
  }
  if (verticalColumnMissing(error) || energySchemaMissing(error)) {
    return tableMissingResponse(
      res,
      'Energie-Bereich fehlt. Bitte server/supabase/vertical.sql im Supabase SQL Editor ausführen.',
    );
  }
  if (/external_source|external_id/i.test(String(error?.message || ''))) {
    return tableMissingResponse(
      res,
      'Externe Lead-IDs fehlen. Bitte server/supabase/lead_external_id.sql im Supabase SQL Editor ausführen.',
    );
  }
  console.error('Leads error:', error.message);
  return res.status(500).json({ error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.' });
}
