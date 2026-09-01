import { supabase, supabaseConfig } from './supabase.js';
import { ROLES, getUserRole } from './roles.js';
import { toDirectoryUser } from './users.js';
import { DEFAULT_LEAD_SCOPE, LEAD_SCOPES, leadScopeOrDefault, normalizeLeadScope } from './scopes.js';

export const EMPLOYMENT_STATUSES = ['selbststaendig', 'zusaetzlich_angestellt', 'sonstiges'];
export const INSURANCE_STATUSES = ['gkv', 'pkv_voll', 'zusatz', 'unbekannt'];
export const COVERAGE_CIRCLES = ['allein', 'partner', 'kinder', 'familie'];
export const MAIN_CONCERNS = ['beitrag', 'leistungen', 'krankentagegeld', 'check'];
export const LEAD_STATUSES = ['neu', 'in_bearbeitung', 'zugewiesen', 'erledigt'];
export const LEAD_SOURCES = ['csv', 'manual', 'api'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}$/;

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
  ],
  zusaetzlich_angestellt: [
    'zusaetzlich_angestellt',
    'zusaetzlich angestellt',
    'zusätzlich angestellt',
  ],
  sonstiges: ['sonstiges'],
});

const INSURANCE_ALIASES = aliasMap({
  gkv: ['gkv'],
  pkv_voll: ['pkv_voll', 'pkv-vollversicherung', 'pkv vollversicherung', 'pkv'],
  zusatz: ['zusatz', 'zusatzversicherung'],
  unbekannt: ['unbekannt'],
});

const COVERAGE_ALIASES = aliasMap({
  allein: ['allein', 'allein versichert'],
  partner: ['partner'],
  kinder: ['kinder'],
  familie: ['familie'],
});

const CONCERN_ALIASES = aliasMap({
  beitrag: ['beitrag'],
  leistungen: ['leistungen'],
  krankentagegeld: ['krankentagegeld'],
  check: ['check', 'allgemeiner check'],
});

export function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function emptyToNull(value) {
  const text = trim(value);
  return text || null;
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

function parseEmployment(raw) {
  const text = trim(raw);
  if (!text) return { value: null };
  const mapped = mapAlias(text, EMPLOYMENT_ALIASES);
  if (!mapped) return { error: 'Berufliche Situation ist ungültig.' };
  return { value: mapped };
}

function parseEnumList(raw, aliases, allowed, label) {
  const items = splitList(raw);
  if (!items.length) return { value: [] };
  const mapped = [];
  for (const item of items) {
    const value = mapAlias(item, aliases);
    if (!value) return { error: `${label} enthält einen ungültigen Wert: ${item}` };
    mapped.push(value);
  }
  return { value: uniqueAllowed(mapped, allowed) };
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
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hasField(body, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

export function parseLeadInput(body = {}, { partial = false } = {}) {
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
    const employment = parseEmployment(body.employmentStatus ?? body.employment_status);
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
      errors.push('Paket muss deutschlandweit oder regional sein.');
    } else {
      row.scope = scope || DEFAULT_LEAD_SCOPE;
    }
  }

  const hasNotes = 'notes' in body;
  if (!partial || hasNotes) row.notes = emptyToNull(body.notes);

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

  return { row, errors };
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

export async function listLeads({ status, assignedTo, search, scope } = {}) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  let query = supabase.from('leads').select('*').order('created_at', { ascending: false });

  if (status && LEAD_STATUSES.includes(status)) {
    query = query.eq('status', status);
  }

  if (scope && LEAD_SCOPES.includes(scope)) {
    query = query.eq('scope', scope);
  }

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

  const { data, error } = await query;
  if (error) throw error;
  return withAssignees(data || []);
}

export async function listMyLeads(userId) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', userId)
    .is('refunded_at', null)
    .order('assigned_at', { ascending: false });

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

export async function createLead(input, { createdBy, source = 'manual' } = {}) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const parsed = parseLeadInput(input);
  if (parsed.errors.length) {
    const error = new Error(parsed.errors[0]);
    error.status = 400;
    error.details = parsed.errors;
    throw error;
  }

  const payload = {
    ...parsed.row,
    source: LEAD_SOURCES.includes(source) ? source : 'manual',
    created_by: createdBy || null,
  };

  const { data, error } = await supabase.from('leads').insert(payload).select('*').single();
  if (error) throw error;
  return withAssignee(data);
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

    const parsed = parseLeadInput(input);
    if (parsed.errors.length) {
      errors.push({ row: sheetRow, message: parsed.errors[0] });
      return;
    }
    created.push({
      ...parsed.row,
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

  const { data, error } = await supabase.from('leads').insert(created).select('*');
  if (error) throw error;

  return {
    created: await withAssignees(data || []),
    errors,
  };
}

export async function updateLead(id, input) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
  }

  const parsed = parseLeadInput(input, { partial: true });
  if (parsed.errors.length) {
    const error = new Error(parsed.errors[0]);
    error.status = 400;
    error.details = parsed.errors;
    throw error;
  }

  if (!Object.keys(parsed.row).length) {
    const current = await getLeadById(id);
    return current ? withAssignee(current) : null;
  }

  if (parsed.row.status === 'zugewiesen') {
    const current = await getLeadById(id);
    if (current && !current.assigned_to) {
      const error = new Error('Bitte zuerst einen Berater zuweisen.');
      error.status = 400;
      throw error;
    }
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
  if (beraterId && current.refunded_at) {
    const error = new Error('Erstattete Leads können nicht erneut zugewiesen werden.');
    error.status = 400;
    throw error;
  }

  if (!beraterId) {
    const nextStatus = current.status === 'zugewiesen' ? 'in_bearbeitung' : current.status;
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
    return withAssignee(data);
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

  const patch = {
    assigned_to: beraterId,
    assigned_at: new Date().toISOString(),
    status: 'zugewiesen',
  };
  if (requestId || requestId === null) {
    patch.request_id = requestId;
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
      status: 'neu',
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return withAssignee(data);
}

export async function deleteLead(id) {
  if (!supabaseConfig.configured || !supabase) {
    throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
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
  console.error('Leads error:', error.message);
  return res.status(500).json({ error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.' });
}
