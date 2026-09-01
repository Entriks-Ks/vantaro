import { supabase, supabaseConfig } from './supabase.js';
import { ROLES } from './roles.js';
import { listDirectoryUsers } from './users.js';
import { tableMissing } from './leads.js';
import { createLeadRequest } from './leadRequests.js';
import { MIN_LEAD_PACK, packageById, packTotalCents } from './packages.js';

const TAX_RATE = 0.19;
const TEST_SUCCESS_CARDS = new Set([
  '4242424242424242',
  '5555555555554444',
  '4000000000000000',
]);
const TEST_DECLINE_CARDS = new Set([
  '4000000000000002',
]);

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

export function paymentTableMissing(error) {
  const message = String(error?.message || error?.code || '');
  return tableMissing(error)
    || /lead_payments/i.test(message)
    || /invoice_number/i.test(message)
    || /card_last4/i.test(message);
}

export function toPublicPayment(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    beraterId: row.berater_id,
    requestId: row.request_id || null,
    packageId: row.package_id,
    packageLabel: row.package_label,
    scope: row.scope,
    leadType: row.lead_type || 'PKV',
    leadCount: Number(row.lead_count) || 0,
    netCents: Number(row.net_cents) || 0,
    taxCents: Number(row.tax_cents) || 0,
    grossCents: Number(row.gross_cents) || 0,
    invoiceNumber: row.invoice_number,
    status: row.status || 'paid',
    method: row.method || 'card',
    cardBrand: row.card_brand || null,
    cardLast4: row.card_last4 || null,
    cardHolder: row.card_holder || null,
    cardExpMonth: row.card_exp_month || null,
    cardExpYear: row.card_exp_year || null,
    billingName: row.billing_name || null,
    billingEmail: row.billing_email || null,
    billingCompany: row.billing_company || null,
    testMode: row.test_mode !== false,
    paidAt: row.paid_at || row.created_at,
    createdAt: row.created_at,
    ...extras,
  };
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function luhnOk(number) {
  let sum = 0;
  let alt = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let n = Number(number[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function cardBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'American Express';
  return 'Karte';
}

function parseCard(input = {}) {
  const holder = String(input.holder || input.name || '').trim();
  const number = digits(input.number);
  const cvc = digits(input.cvc || input.cvv);
  const expMonth = Number(input.expMonth ?? input.exp_month ?? String(input.expiry || '').split('/')[0]);
  let expYear = Number(input.expYear ?? input.exp_year ?? String(input.expiry || '').split('/')[1]);
  if (expYear > 0 && expYear < 100) expYear += 2000;

  if (holder.length < 3) throw fail('Bitte den Namen auf der Karte angeben.');
  if (number.length < 13 || number.length > 19 || !luhnOk(number)) {
    throw fail('Kartennummer ist ungültig. Im Testbetrieb z. B. 4242 4242 4242 4242 verwenden.');
  }
  if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) {
    throw fail('Ablaufmonat ist ungültig.');
  }
  if (!Number.isInteger(expYear) || expYear < 2000) {
    throw fail('Ablaufjahr ist ungültig.');
  }
  const now = new Date();
  const expDate = new Date(expYear, expMonth, 0, 23, 59, 59);
  if (expDate < now) throw fail('Die Karte ist abgelaufen.');
  if (cvc.length < 3 || cvc.length > 4) throw fail('CVC ist ungültig.');
  if (TEST_DECLINE_CARDS.has(number)) {
    throw fail('Zahlung abgelehnt (Testdaten). Bitte 4242 4242 4242 4242 verwenden.');
  }
  if (!TEST_SUCCESS_CARDS.has(number) && number.length !== 16) {
    throw fail('Im Testbetrieb bitte eine Testkarte verwenden, z. B. 4242 4242 4242 4242.');
  }

  return {
    holder,
    last4: number.slice(-4),
    brand: cardBrand(number),
    expMonth,
    expYear,
  };
}

function makeInvoiceNumber(at = new Date()) {
  const d = new Date(at);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const suffix = String(d.getTime()).slice(-4);
  return `RE-${stamp}-${suffix}`;
}

async function paymentsByRequestId(ids) {
  const map = new Map();
  const requestIds = [...new Set((ids || []).filter(Boolean))];
  if (!requestIds.length) return map;
  const { data, error } = await supabase
    .from('lead_payments')
    .select('*')
    .in('request_id', requestIds)
    .order('created_at', { ascending: false });
  if (error) {
    if (paymentTableMissing(error)) return map;
    throw error;
  }
  for (const row of data || []) {
    if (!map.has(row.request_id)) map.set(row.request_id, toPublicPayment(row));
  }
  return map;
}

export async function attachPaymentsToRequests(requests) {
  const list = Array.isArray(requests) ? requests : [];
  const map = await paymentsByRequestId(list.map((entry) => entry?.id));
  return list.map((entry) => (
    entry ? { ...entry, payment: map.get(entry.id) || entry.payment || null } : entry
  ));
}

export async function attachPaymentsToPipelines(beraters) {
  const list = Array.isArray(beraters) ? beraters : [];
  const nested = list.flatMap((entry) => entry?.requests || []);
  const mapped = await attachPaymentsToRequests(nested);
  const byId = new Map(mapped.filter(Boolean).map((entry) => [entry.id, entry]));
  return list.map((berater) => ({
    ...berater,
    requests: (berater.requests || []).map((entry) => byId.get(entry.id) || entry),
    request: berater.request ? (byId.get(berater.request.id) || berater.request) : null,
  }));
}

export async function listMyPayments(beraterId) {
  requireDb();
  const { data, error } = await supabase
    .from('lead_payments')
    .select('*')
    .eq('berater_id', beraterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => toPublicPayment(row));
}

export async function listAllPayments() {
  requireDb();
  const directory = await listDirectoryUsers();
  const users = new Map(directory.users.map((user) => [user.id, user]));
  const { data, error } = await supabase
    .from('lead_payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...toPublicPayment(row),
    berater: users.get(row.berater_id) || null,
  }));
}

export async function checkoutLeadPackage(user, {
  packageId,
  requestedCount,
  card,
} = {}) {
  requireDb();
  if (user?.role !== ROLES.BERATER) {
    throw fail('Nur Berater können Leads kaufen.', 403);
  }

  const pkg = packageById(packageId);
  if (!pkg) throw fail('Paket wurde nicht gefunden.');

  const count = Number(requestedCount);
  if (!Number.isInteger(count) || count < pkg.minLeads || count % MIN_LEAD_PACK !== 0) {
    throw fail(`Mindestabnahme ${MIN_LEAD_PACK} Leads, in 10er-Schritten.`);
  }

  const parsedCard = parseCard(card);
  const netCents = packTotalCents(pkg, count);
  const taxCents = Math.round(netCents * TAX_RATE);
  const grossCents = netCents + taxCents;
  const now = new Date().toISOString();
  const invoiceNumber = makeInvoiceNumber();

  const request = await createLeadRequest(user.id, {
    requestedCount: count,
    leadType: pkg.leadType,
    scope: pkg.scope,
    notes: `${pkg.label} · Testzahlung ${invoiceNumber}`,
    createdBy: user.id,
  });

  const billingName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    || user.fullName
    || parsedCard.holder;

  const { data, error } = await supabase
    .from('lead_payments')
    .insert({
      berater_id: user.id,
      request_id: request.id,
      package_id: pkg.id,
      package_label: pkg.label,
      scope: pkg.scope,
      lead_type: pkg.leadType,
      lead_count: count,
      net_cents: netCents,
      tax_cents: taxCents,
      gross_cents: grossCents,
      invoice_number: invoiceNumber,
      status: 'paid',
      method: 'card',
      card_brand: parsedCard.brand,
      card_last4: parsedCard.last4,
      card_holder: parsedCard.holder,
      card_exp_month: parsedCard.expMonth,
      card_exp_year: parsedCard.expYear,
      billing_name: billingName,
      billing_email: user.email || null,
      billing_company: user.profile?.company || null,
      test_mode: true,
      paid_at: now,
    })
    .select('*')
    .single();

  if (error) {
    if (request?.id) {
      await supabase.from('lead_requests').update({
        status: 'cancelled',
        cancelled_at: now,
      }).eq('id', request.id);
    }
    throw error;
  }

  return {
    payment: toPublicPayment(data),
    request: { ...request, payment: toPublicPayment(data) },
  };
}
