import crypto from 'node:crypto';
import { supabase, supabaseConfig } from './supabase.js';
import { publicUser } from './auth.js';
import { ROLES } from './roles.js';
import { listDirectoryUsers } from './users.js';
import { tableMissing } from './leads.js';
import { createLeadRequest } from './leadRequests.js';
import { MIN_LEAD_PACK, packageById, packTotalCents } from './packages.js';
import { getClientOrigin, getApiOrigin } from './clientOrigin.js';
import {
  classifyOrderStatus,
  createPurchaseOrder,
  getOrderDetails,
  getProcreditConfig,
} from './procredit.js';

const TAX_RATE = 0;

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
    || /card_last4/i.test(message)
    || /pg_order_id/i.test(message)
    || /return_token/i.test(message);
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
    status: row.status || 'pending',
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
    pgStatus: row.pg_status || null,
    paidAt: row.paid_at || (row.status === 'paid' ? row.created_at : null),
    createdAt: row.created_at,
    ...extras,
  };
}

function makeInvoiceNumber(at = new Date()) {
  const d = new Date(at);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const suffix = String(d.getTime()).slice(-4);
  return `RE-${stamp}-${suffix}`;
}

function clientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req?.ip || req?.socket?.remoteAddress || '127.0.0.1';
}

function browserFromRequest(req, browser = {}) {
  return {
    javaEnabled: Boolean(browser.javaEnabled),
    jsEnabled: browser.jsEnabled !== false,
    acceptHeader: browser.acceptHeader || req?.headers?.accept || 'application/json,text/html;q=0.9,*/*;q=0.8',
    ip: browser.ip || clientIp(req),
    colorDepth: browser.colorDepth || '24',
    screenW: browser.screenW || '1920',
    screenH: browser.screenH || '1080',
    tzOffset: browser.tzOffset ?? '0',
    language: browser.language || req?.headers?.['accept-language']?.split(',')[0] || 'de-DE',
    userAgent: browser.userAgent || req?.headers?.['user-agent'] || 'Mozilla/5.0',
  };
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

function invoicePartyFromUser(user) {
  const profile = user?.profile || {};
  const address = profile.billingAddress || profile.businessAddress || {};
  return {
    customerNumber: user?.customerNumber || '',
    billingName: [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
      || user?.fullName
      || '',
    billingEmail: user?.email || '',
    billingCompany: profile.company || '',
    billingStreet: address.street || '',
    billingZip: address.zip || '',
    billingCity: address.city || '',
  };
}

async function loadInvoiceParty(user, beraterId, isOwner) {
  if (isOwner) return invoicePartyFromUser(user);
  try {
    const { data, error } = await supabase.auth.admin.getUserById(beraterId);
    if (error || !data?.user) return {};
    return invoicePartyFromUser(publicUser(data.user));
  } catch {
    return {};
  }
}

export async function getPaymentForViewer(user, paymentId) {
  requireDb();
  const row = await loadPaymentById(paymentId);
  if (!row) throw fail('Rechnung nicht gefunden.', 404);
  const isOwner = row.berater_id === user?.id;
  const isAdmin = user?.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) throw fail('Rechnung nicht gefunden.', 404);
  const payment = toPublicPayment(row);
  const party = await loadInvoiceParty(user, row.berater_id, isOwner);
  return {
    ...payment,
    customerNumber: party.customerNumber || payment.customerNumber || '',
    billingName: payment.billingName || party.billingName || '',
    billingEmail: payment.billingEmail || party.billingEmail || '',
    billingCompany: payment.billingCompany || party.billingCompany || '',
    billingStreet: party.billingStreet || '',
    billingZip: party.billingZip || '',
    billingCity: party.billingCity || '',
  };
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

async function loadPaymentById(paymentId) {
  const { data, error } = await supabase
    .from('lead_payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function loadPaymentByReturnToken(token) {
  const { data, error } = await supabase
    .from('lead_payments')
    .select('*')
    .eq('return_token', token)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function extractCardHints(order) {
  const card = order?.card || order?.panMask || order?.source || order?.token || {};
  const last4 = String(card.last4 || card.panLast4 || card.maskedPan || '')
    .replace(/\D/g, '')
    .slice(-4) || null;
  const brand = card.brand || card.paymentSystem || card.system || null;
  const holder = card.holder || card.cardHolder || card.name || null;
  return { last4, brand, holder };
}

/**
 * Sync payment status with ProCredit Get Order Details.
 * Creates the lead_request only when the order is paid.
 */
export async function finalizePaymentFromGateway(row, { beraterUser = null } = {}) {
  requireDb();
  if (!row) throw fail('Zahlung nicht gefunden.', 404);
  if (row.status === 'paid') {
    return { payment: toPublicPayment(row), outcome: 'paid', alreadyFinalized: true };
  }
  if (row.status === 'refunded') {
    return { payment: toPublicPayment(row), outcome: 'refunded', alreadyFinalized: true };
  }
  if (!row.pg_order_id || !row.pg_order_password) {
    throw fail('Für diese Zahlung fehlt die ProCredit-Order-Referenz.', 409);
  }

  const order = await getOrderDetails(row.pg_order_id, row.pg_order_password);
  const outcome = classifyOrderStatus(order);
  const now = new Date().toISOString();
  const cardHints = extractCardHints(order);
  const pgStatus = order?.status ? String(order.status) : outcome;

  if (outcome === 'paid') {
    const request = await createLeadRequest(row.berater_id, {
      requestedCount: row.lead_count,
      leadType: row.lead_type || 'PKV',
      scope: row.scope,
      notes: `${row.package_label} · ${row.invoice_number}`,
      createdBy: beraterUser?.id || row.berater_id,
      notifyAdmins: true,
    });

    const { data, error } = await supabase
      .from('lead_payments')
      .update({
        status: 'paid',
        request_id: request.id,
        pg_status: pgStatus,
        card_brand: cardHints.brand || row.card_brand,
        card_last4: cardHints.last4 || row.card_last4,
        card_holder: cardHints.holder || row.card_holder,
        paid_at: now,
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    if (error) {
      await supabase.from('lead_requests').update({
        status: 'cancelled',
        cancelled_at: now,
      }).eq('id', request.id);
      throw error;
    }

    if (!data) {
      await supabase.from('lead_requests').update({
        status: 'cancelled',
        cancelled_at: now,
      }).eq('id', request.id);
      const latest = await loadPaymentById(row.id);
      return {
        payment: toPublicPayment(latest || row),
        outcome: latest?.status === 'paid' ? 'paid' : (latest?.status || 'pending'),
        alreadyFinalized: true,
      };
    }

    return {
      payment: toPublicPayment(data),
      request: { ...request, payment: toPublicPayment(data) },
      outcome: 'paid',
      alreadyFinalized: false,
    };
  }

  if (outcome === 'failed') {
    const { data, error } = await supabase
      .from('lead_payments')
      .update({
        status: 'failed',
        pg_status: pgStatus,
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const latest = await loadPaymentById(row.id);
      return {
        payment: toPublicPayment(latest || row),
        outcome: latest?.status || 'failed',
        alreadyFinalized: true,
      };
    }
    return { payment: toPublicPayment(data), outcome: 'failed', alreadyFinalized: false };
  }

  const { data, error } = await supabase
    .from('lead_payments')
    .update({ pg_status: pgStatus })
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) throw error;
  return { payment: toPublicPayment(data), outcome: 'pending', alreadyFinalized: false };
}

export async function checkoutLeadPackage(user, {
  packageId,
  requestedCount,
  browser,
} = {}, req = null) {
  requireDb();
  if (user?.role !== ROLES.BERATER) {
    throw fail('Nur Berater können Leads kaufen.', 403);
  }

  const config = getProcreditConfig();
  if (!config.configured) {
    const missing = config.missing.length
      ? ` Fehlt noch: ${config.missing.join(', ')}.`
      : '';
    throw fail(
      `ProCredit-Zahlung ist noch nicht vollständig konfiguriert.${missing}`,
      503,
    );
  }

  const pkg = packageById(packageId);
  if (!pkg) throw fail('Paket wurde nicht gefunden.');

  const count = Number(requestedCount);
  if (!Number.isInteger(count) || count < MIN_LEAD_PACK || count % 5 !== 0) {
    throw fail(`Mindestabnahme ${MIN_LEAD_PACK} Leads (in 5er-Schritten: 10, 15, 20, …).`);
  }

  const netCents = packTotalCents(pkg, count);
  const taxCents = 0;
  const grossCents = netCents;
  const invoiceNumber = makeInvoiceNumber();
  const returnToken = crypto.randomBytes(24).toString('hex');
  const billingName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    || user.fullName
    || null;

  const { data: pending, error: insertError } = await supabase
    .from('lead_payments')
    .insert({
      berater_id: user.id,
      request_id: null,
      package_id: pkg.id,
      package_label: pkg.label,
      scope: pkg.scope,
      lead_type: pkg.leadType,
      lead_count: count,
      net_cents: netCents,
      tax_cents: taxCents,
      gross_cents: grossCents,
      invoice_number: invoiceNumber,
      status: 'pending',
      method: 'card',
      billing_name: billingName,
      billing_email: user.email || null,
      billing_company: user.profile?.company || null,
      test_mode: config.testMode,
      return_token: returnToken,
      paid_at: null,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  const apiOrigin = getApiOrigin();
  const hppRedirectUrl = `${apiOrigin}/api/payments/return?token=${encodeURIComponent(returnToken)}`;

  try {
    const order = await createPurchaseOrder({
      amountCents: netCents,
      description: `Lead package ${pkg.scope} x${count}`,
      hppRedirectUrl,
      browser: browserFromRequest(req, browser),
    });

    const { data: updated, error: updateError } = await supabase
      .from('lead_payments')
      .update({
        pg_order_id: order.orderId,
        pg_order_password: order.password,
        pg_status: order.status,
        hpp_url: order.hppUrl,
      })
      .eq('id', pending.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return {
      payment: toPublicPayment(updated),
      paymentId: updated.id,
      redirectUrl: order.redirectUrl,
    };
  } catch (error) {
    await supabase
      .from('lead_payments')
      .update({
        status: 'failed',
        pg_status: 'create_order_failed',
      })
      .eq('id', pending.id);
    throw error;
  }
}

export async function syncMyPayment(user, paymentId) {
  requireDb();
  if (user?.role !== ROLES.BERATER) {
    throw fail('Nur Berater können Zahlungen prüfen.', 403);
  }
  const row = await loadPaymentById(paymentId);
  if (!row || row.berater_id !== user.id) {
    throw fail('Zahlung nicht gefunden.', 404);
  }
  return finalizePaymentFromGateway(row, { beraterUser: user });
}

export async function completePaymentReturn({ token, paymentId } = {}) {
  requireDb();
  let row = null;
  if (token) row = await loadPaymentByReturnToken(token);
  else if (paymentId) row = await loadPaymentById(paymentId);
  if (!row) throw fail('Zahlung nicht gefunden.', 404);

  const result = await finalizePaymentFromGateway(row);
  const frontend = getClientOrigin().replace(/\/$/, '');
  const status = result.outcome === 'paid'
    ? 'success'
    : result.outcome === 'failed'
      ? 'failed'
      : 'pending';
  const redirectTo = `${frontend}/dashboard/paket?payment=${status}&invoice=${encodeURIComponent(row.invoice_number || '')}`;
  return { ...result, redirectTo };
}
