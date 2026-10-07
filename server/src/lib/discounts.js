import crypto from 'node:crypto';
import { supabase, supabaseConfig } from './supabase.js';
import { publicUser } from './auth.js';
import { ROLES, getUserRole } from './roles.js';
import { tableMissing } from './leads.js';
import {
  DISCOUNT_APPLIES_TO,
  DISCOUNT_KINDS,
  DISCOUNT_VALUE_TYPES,
  isDiscountLive,
  matchingOneTimes,
  quoteDiscounts,
  snapshotFromQuote,
} from './discountMath.js';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireDb() {
  if (!supabaseConfig.configured || !supabase) {
    throw fail('Supabase ist nicht konfiguriert.', 503);
  }
}

export function discountTableMissing(error) {
  const message = String(error?.message || error?.code || '');
  return tableMissing(error)
    || /berater_discounts/i.test(message)
    || /discount_snapshot/i.test(message)
    || /list_cents/i.test(message)
    || /expires_at/i.test(message);
}

function makeCode() {
  return `VAN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function normalizeCode(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '');
  return raw.slice(0, 40);
}

export function toPublicDiscount(row, { includeNote = true } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    beraterId: row.berater_id,
    kind: row.kind,
    code: row.code,
    valueType: row.value_type,
    value: Number(row.value) || 0,
    appliesTo: row.applies_to || 'all',
    status: row.status || 'active',
    note: includeNote ? (row.note || '') : undefined,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    revokedAt: row.revoked_at || null,
    revokedBy: row.revoked_by || null,
    reservedPaymentId: row.reserved_payment_id || null,
    consumedPaymentId: row.consumed_payment_id || null,
    consumedAt: row.consumed_at || null,
    expiresAt: row.expires_at || null,
  };
}

function emptyQuote(listCents) {
  const list = Math.max(0, Math.round(Number(listCents) || 0));
  return {
    listCents: list,
    discountCents: 0,
    netCents: list,
    standing: null,
    oneTime: null,
    lines: [],
    snapshot: { standing: null, oneTime: null },
  };
}

async function loadBeraterUser(beraterId) {
  const { data, error } = await supabase.auth.admin.getUserById(beraterId);
  if (error || !data?.user) throw fail('Berater wurde nicht gefunden.', 404);
  const user = publicUser(data.user);
  const role = getUserRole(data.user);
  if (role !== ROLES.BERATER) throw fail('Rabatte können nur für Berater angelegt werden.');
  return user;
}

export async function listDiscountsForBerater(beraterId, { includeNote = true } = {}) {
  requireDb();
  const { data, error } = await supabase
    .from('berater_discounts')
    .select('*')
    .eq('berater_id', beraterId)
    .order('created_at', { ascending: false });
  if (error) {
    if (discountTableMissing(error)) return [];
    throw error;
  }
  return (data || []).map((row) => toPublicDiscount(row, { includeNote }));
}

export async function paidUnitCount(beraterId) {
  requireDb();
  const { data, error } = await supabase
    .from('lead_payments')
    .select('lead_count')
    .eq('berater_id', beraterId)
    .eq('status', 'paid');
  if (error) {
    if (discountTableMissing(error)) return 0;
    throw error;
  }
  return (data || []).reduce((sum, row) => sum + (Number(row.lead_count) || 0), 0);
}

export async function listMineDiscounts(beraterId) {
  const all = await listDiscountsForBerater(beraterId, { includeNote: false });
  const standing = all.find((entry) => entry.kind === 'standing' && isDiscountLive(entry)) || null;
  const oneTimes = all.filter((entry) => entry.kind === 'one_time' && isDiscountLive(entry));
  return { standing, oneTimes };
}

function parseExpiresAt(value, { requireFuture = true } = {}) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail('Ablaufdatum ist ungültig.');
  if (requireFuture && date.getTime() <= Date.now()) throw fail('Ablaufdatum muss in der Zukunft liegen.');
  return date.toISOString();
}

function parseDiscountValue(payload) {
  const valueType = String(payload.valueType || payload.value_type || '').trim();
  if (!DISCOUNT_VALUE_TYPES.includes(valueType)) throw fail('Rabatt-Typ ist ungültig.');
  let value = Number(payload.value);
  if (valueType === 'fixed_cents' && payload.valueCents == null && payload.euros != null) {
    value = Math.round(Number(payload.euros) * 100);
  }
  if (valueType === 'fixed_cents' && Number.isFinite(Number(payload.valueCents))) {
    value = Math.round(Number(payload.valueCents));
  }
  if (!Number.isInteger(value) || value <= 0) throw fail('Rabatt-Wert ist ungültig.');
  if (valueType === 'percent' && (value < 1 || value > 100)) {
    throw fail('Prozent muss zwischen 1 und 100 liegen.');
  }
  return { valueType, value };
}

function parseAppliesTo(payload) {
  const appliesTo = String(payload.appliesTo || payload.applies_to || 'all').trim();
  if (!DISCOUNT_APPLIES_TO.includes(appliesTo)) throw fail('Geltungsbereich ist ungültig.');
  return appliesTo;
}

export async function quoteCheckoutDiscounts({
  beraterId,
  packageId,
  leadType,
  count,
  listCents,
  useOneTimeId = null,
} = {}) {
  const list = Math.max(0, Math.round(Number(listCents) || 0));
  const selectedId = String(useOneTimeId || '').trim();
  try {
    const { standing, oneTimes } = await listMineDiscounts(beraterId);
    if (selectedId) {
      const usable = matchingOneTimes(oneTimes, packageId, leadType)
        .find((entry) => entry.id === selectedId);
      if (!usable) {
        throw fail('Dieser Einmal-Rabatt gilt nicht für dieses Paket oder ist abgelaufen.');
      }
    }
    const quote = quoteDiscounts({
      listCents: list,
      count,
      packageId,
      leadType,
      standing,
      oneTimes,
      useOneTimeId: selectedId || null,
    });
    return { ...quote, snapshot: snapshotFromQuote(quote) };
  } catch (error) {
    if (discountTableMissing(error)) return { ...emptyQuote(list), snapshot: { standing: null, oneTime: null } };
    throw error;
  }
}

export async function reserveOneTimeForPayment(discountId, paymentId) {
  if (!discountId || !paymentId) return null;
  const { data: current, error: loadError } = await supabase
    .from('berater_discounts')
    .select('*')
    .eq('id', discountId)
    .eq('kind', 'one_time')
    .eq('status', 'active')
    .maybeSingle();
  if (loadError) {
    if (discountTableMissing(loadError)) return null;
    throw loadError;
  }
  if (!current || isDiscountExpired(toPublicDiscount(current))) return null;

  const { data, error } = await supabase
    .from('berater_discounts')
    .update({
      status: 'reserved',
      reserved_payment_id: paymentId,
    })
    .eq('id', discountId)
    .eq('kind', 'one_time')
    .eq('status', 'active')
    .select('*')
    .maybeSingle();
  if (error) {
    if (discountTableMissing(error)) return null;
    throw error;
  }
  return data ? toPublicDiscount(data) : null;
}

export async function consumeReservedForPayment(paymentId) {
  if (!paymentId) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('berater_discounts')
    .update({
      status: 'consumed',
      consumed_payment_id: paymentId,
      consumed_at: now,
    })
    .eq('reserved_payment_id', paymentId)
    .eq('kind', 'one_time')
    .eq('status', 'reserved');
  if (error && !discountTableMissing(error)) throw error;
}

export async function releaseReservedForPayment(paymentId) {
  if (!paymentId) return;
  const { error } = await supabase
    .from('berater_discounts')
    .update({
      status: 'active',
      reserved_payment_id: null,
    })
    .eq('reserved_payment_id', paymentId)
    .eq('kind', 'one_time')
    .eq('status', 'reserved');
  if (error && !discountTableMissing(error)) throw error;
}

async function revokeActiveStanding(beraterId, adminId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('berater_discounts')
    .update({
      status: 'revoked',
      revoked_at: now,
      revoked_by: adminId || null,
    })
    .eq('berater_id', beraterId)
    .eq('kind', 'standing')
    .eq('status', 'active');
  if (error) throw error;
}

export async function createDiscount(admin, payload = {}) {
  requireDb();
  const beraterId = String(payload.beraterId || payload.berater_id || '').trim();
  if (!beraterId) throw fail('Berater ist erforderlich.');
  await loadBeraterUser(beraterId);

  const kind = String(payload.kind || '').trim();
  if (!DISCOUNT_KINDS.includes(kind)) throw fail('Art des Rabatts ist ungültig.');

  const { valueType, value } = parseDiscountValue(payload);
  const appliesTo = parseAppliesTo(payload);

  const note = String(payload.note || '').trim().slice(0, 500) || null;
  const requestedCode = normalizeCode(payload.code);
  const code = requestedCode || makeCode();
  const expiresAt = parseExpiresAt(payload.expiresAt ?? payload.expires_at);

  if (kind === 'standing') {
    await revokeActiveStanding(beraterId, admin?.id);
  }

  const insertRow = {
    berater_id: beraterId,
    kind,
    code,
    value_type: valueType,
    value,
    applies_to: appliesTo,
    status: 'active',
    note,
    created_by: admin?.id || null,
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from('berater_discounts')
    .insert(insertRow)
    .select('*')
    .single();

  if (error) {
    if (/berater_discounts_code_idx|duplicate key/i.test(String(error.message || ''))) {
      if (!requestedCode) {
        insertRow.code = makeCode();
        const retry = await supabase.from('berater_discounts').insert(insertRow).select('*').single();
        if (retry.error) throw retry.error;
        return toPublicDiscount(retry.data);
      }
      throw fail('Dieser Code ist bereits vergeben.');
    }
    if (/expires_at/i.test(String(error.message || ''))) {
      delete insertRow.expires_at;
      const retry = await supabase.from('berater_discounts').insert(insertRow).select('*').single();
      if (retry.error) throw retry.error;
      return toPublicDiscount(retry.data);
    }
    throw error;
  }
  return toPublicDiscount(data);
}

export async function revokeDiscount(admin, discountId) {
  requireDb();
  const { data: row, error: loadError } = await supabase
    .from('berater_discounts')
    .select('*')
    .eq('id', discountId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!row) throw fail('Rabatt wurde nicht gefunden.', 404);
  if (row.status === 'consumed') throw fail('Ein eingelöster Rabatt kann nicht entzogen werden.');
  if (row.status === 'revoked') return toPublicDiscount(row);
  if (row.status === 'reserved') {
    throw fail('Dieser Einmal-Rabatt ist an eine offene Zahlung gebunden und kann erst danach entzogen werden.');
  }

  const { data, error } = await supabase
    .from('berater_discounts')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: admin?.id || null,
    })
    .eq('id', discountId)
    .eq('status', 'active')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw fail('Rabatt wurde nicht gefunden.', 404);
  return toPublicDiscount(data);
}

export async function updateDiscount(admin, discountId, payload = {}) {
  requireDb();
  const { data: row, error: loadError } = await supabase
    .from('berater_discounts')
    .select('*')
    .eq('id', discountId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!row) throw fail('Rabatt wurde nicht gefunden.', 404);
  if (row.status === 'consumed') throw fail('Ein eingelöster Rabatt kann nicht mehr geändert werden.');
  if (row.status === 'revoked') throw fail('Ein entzogener Rabatt kann nicht mehr geändert werden.');
  if (row.status === 'reserved') {
    throw fail('Dieser Einmal-Rabatt ist an eine offene Zahlung gebunden und kann erst danach geändert werden.');
  }

  const { valueType, value } = parseDiscountValue({ ...row, ...payload, value_type: payload.valueType || payload.value_type || row.value_type });
  const appliesTo = parseAppliesTo({ appliesTo: payload.appliesTo ?? payload.applies_to ?? row.applies_to });
  const note = payload.note !== undefined || payload.note === ''
    ? (String(payload.note || '').trim().slice(0, 500) || null)
    : row.note;
  const requestedCode = payload.code !== undefined ? normalizeCode(payload.code) : '';
  const code = requestedCode || row.code;
  const expiresProvided = payload.expiresAt !== undefined || payload.expires_at !== undefined;
  const expiresAt = expiresProvided
    ? parseExpiresAt(payload.expiresAt ?? payload.expires_at, { requireFuture: false })
    : row.expires_at;

  const patch = {
    value_type: valueType,
    value,
    applies_to: appliesTo,
    note: payload.note !== undefined ? note : row.note,
    code,
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from('berater_discounts')
    .update(patch)
    .eq('id', discountId)
    .eq('status', 'active')
    .select('*')
    .maybeSingle();
  if (error) {
    if (/berater_discounts_code_idx|duplicate key/i.test(String(error.message || ''))) {
      throw fail('Dieser Code ist bereits vergeben.');
    }
    throw error;
  }
  if (!data) throw fail('Rabatt wurde nicht gefunden.', 404);
  return toPublicDiscount(data);
}

export async function deleteDiscount(discountId) {
  requireDb();
  const { data: row, error: loadError } = await supabase
    .from('berater_discounts')
    .select('*')
    .eq('id', discountId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!row) throw fail('Rabatt wurde nicht gefunden.', 404);
  if (row.status === 'reserved') {
    throw fail('Dieser Einmal-Rabatt ist an eine offene Zahlung gebunden und kann erst danach gelöscht werden.');
  }
  const { error } = await supabase
    .from('berater_discounts')
    .delete()
    .eq('id', discountId);
  if (error) throw error;
  return { id: discountId, deleted: true };
}
