import { Router } from 'express';
import { supabase } from '../../lib/supabase.js';
import { isUuid } from '../../lib/leads.js';
import { finalizePaymentFromGateway, toPublicPayment } from '../../lib/payments.js';
import { classifyOrderStatus, getOrderDetails } from '../../lib/paymentGateway.js';
import { decryptSecret } from '../../lib/paymentCrypto.js';
import { logPaymentEvent } from '../../lib/paymentAudit.js';
import { releaseReservedForPayment } from '../../lib/discounts.js';
import { SUPPORT_CANCELLED_STATUS } from '../../lib/paymentSecurity.js';
import { createLeadRequest } from '../../lib/leadRequests.js';
import { listDirectoryUsers } from '../../lib/users.js';
import { listActivityFor, logItAction } from '../../lib/itSupportAudit.js';
import { PAYMENT_CHECKS, paymentCheck, STALE_PAYMENT_MINUTES } from '../../lib/itSupportChecks.js';
import { fail, optionalReason, pageParams, requireDb, requireReason, route, searchTerm } from './common.js';
import { both, tr, translateMessage, langOf } from './i18n.js';

const router = Router();

function paymentFlags(payment) {
  const flags = [];
  const ageMin = (Date.now() - new Date(payment.createdAt).getTime()) / 60000;
  if (payment.status === 'pending' && ageMin > STALE_PAYMENT_MINUTES) flags.push('pending_stale');
  if (payment.status === 'paid' && !payment.requestId) flags.push('paid_without_request');
  return flags;
}

function consolePayment(row, berater = null) {
  const payment = toPublicPayment(row, { berater });
  return {
    ...payment,
    hasGatewayOrder: Boolean(row.pg_order_id && row.pg_order_password),
    flags: paymentFlags(payment),
  };
}

async function loadPayment(req) {
  const t = tr(req);
  if (!isUuid(req.params.id)) throw fail(t('Zahlung wurde nicht gefunden.', 'Payment not found.'), 404);
  const { data, error } = await supabase.from('lead_payments').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) throw fail(t('Zahlung wurde nicht gefunden.', 'Payment not found.'), 404);
  return data;
}

function paymentLabel(row) {
  return `${row.invoice_number || row.id} · ${(Number(row.gross_cents || 0) / 100).toFixed(2)} EUR`;
}

router.get('/', route(async (req, res) => {
  requireDb(req);
  const { limit, page, from, to } = pageParams(req, { def: 25, max: 100 });
  const directory = await listDirectoryUsers();
  const users = new Map(directory.users.map((user) => [user.id, user]));

  let query = supabase.from('lead_payments').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  const status = String(req.query.status || '');
  if (['pending', 'paid', 'failed', 'refunded'].includes(status)) query = query.eq('status', status);
  const check = paymentCheck(String(req.query.problem || ''));
  if (check) query = check.apply(query);
  if (isUuid(req.query.beraterId)) query = query.eq('berater_id', req.query.beraterId);

  const q = searchTerm(req.query.q);
  if (q) {
    const lower = q.toLowerCase();
    const matchingUsers = directory.users
      .filter((user) => [user.email, user.fullName, user.company, user.customerNumber].some((value) => String(value || '').toLowerCase().includes(lower)))
      .map((user) => user.id)
      .slice(0, 50);
    const parts = [`invoice_number.ilike."%${q}%"`, `pg_order_id.ilike."%${q}%"`, `billing_email.ilike."%${q}%"`, `billing_name.ilike."%${q}%"`];
    if (isUuid(q)) parts.push(`id.eq.${q}`);
    if (matchingUsers.length) parts.push(`berater_id.in.(${matchingUsers.join(',')})`);
    query = query.or(parts.join(','));
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  const counts = {};
  await Promise.all([
    ...['pending', 'paid', 'failed', 'refunded'].map(async (key) => {
      const result = await supabase.from('lead_payments').select('id', { count: 'exact', head: true }).eq('status', key);
      counts[key] = result.count || 0;
    }),
    ...PAYMENT_CHECKS.map(async (entry) => {
      const result = await entry.apply(supabase.from('lead_payments').select('id', { count: 'exact', head: true }));
      counts[entry.id] = result.count || 0;
    }),
  ]);

  res.json({
    payments: (data || []).map((row) => consolePayment(row, users.get(row.berater_id) || null)),
    total: count || 0,
    page,
    limit,
    counts,
  });
}));

router.get('/audit', route(async (req, res) => {
  requireDb(req);
  const { limit, page, from, to } = pageParams(req, { def: 50, max: 200 });
  let query = supabase.from('payment_audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  const event = String(req.query.event || '');
  if (event) query = query.eq('event', event);
  if (isUuid(req.query.userId)) query = query.eq('user_id', req.query.userId);
  if (isUuid(req.query.paymentId)) query = query.eq('payment_id', req.query.paymentId);
  const { data, count, error } = await query.range(from, to);
  if (error) throw error;
  res.json({ events: data || [], total: count || 0, page, limit });
}));

router.get('/:id', route(async (req, res) => {
  requireDb(req);
  const row = await loadPayment(req);
  const [{ data: beraterData }, events, activity, request] = await Promise.all([
    supabase.auth.admin.getUserById(row.berater_id).catch(() => ({ data: null })),
    supabase.from('payment_audit_log').select('*').eq('payment_id', row.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => (error ? [] : data || [])),
    listActivityFor('payment', row.id),
    row.request_id
      ? supabase.from('lead_requests').select('id, code, status, requested_count, created_at').eq('id', row.request_id).maybeSingle()
        .then(({ data }) => data || null, () => null)
      : Promise.resolve(null),
  ]);
  const berater = beraterData?.user
    ? { id: beraterData.user.id, email: beraterData.user.email, fullName: beraterData.user.user_metadata?.full_name || '' }
    : null;
  res.json({
    payment: consolePayment(row, berater),
    events,
    activity,
    request,
    technical: {
      pgOrderId: row.pg_order_id || null,
      pgStatus: row.pg_status || null,
      hasOrderPassword: Boolean(row.pg_order_password),
      hasReturnToken: Boolean(row.return_token),
      confirmationSentAt: row.confirmation_sent_at || null,
      testMode: row.test_mode !== false,
      requestId: row.request_id || null,
    },
  });
}));

router.post('/:id/sync', route(async (req, res) => {
  requireDb(req);
  const row = await loadPayment(req);
  if (row.status !== 'pending') {
    throw fail(tr(req)('Nur offene Zahlungen können mit der Bank abgeglichen werden.', 'Only open payments can be checked with the bank.'));
  }
  const result = await finalizePaymentFromGateway(row, { req });
  logPaymentEvent('payment_synced', {
    userId: row.berater_id,
    paymentId: row.id,
    req,
    metadata: { outcome: result.outcome, by: 'it_support', actorId: req.user.id },
  });
  await logItAction(req, {
    action: 'payment.sync',
    targetType: 'payment',
    targetId: row.id,
    targetLabel: paymentLabel(row),
    reason: optionalReason(req),
    summary: both(`Mit ProCredit abgeglichen: Ergebnis „${result.outcome}“`, `Checked with ProCredit: result "${result.outcome}"`),
    before: { status: row.status, pgStatus: row.pg_status },
    after: { status: result.payment?.status, pgStatus: result.payment?.pgStatus },
  });
  const fresh = await loadPayment(req);
  res.json({ outcome: result.outcome, payment: consolePayment(fresh) });
}));

router.post('/:id/mark-failed', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const reason = requireReason(req);
  const row = await loadPayment(req);
  if (row.status !== 'pending') throw fail(t('Nur offene Zahlungen können als abgebrochen markiert werden.', 'Only open payments can be marked as cancelled.'));

  // Never close a checkout the customer actually paid: ask the bank first.
  let bankOutcome = 'unknown';
  if (row.pg_order_id && row.pg_order_password) {
    try {
      const order = await getOrderDetails(row.pg_order_id, decryptSecret(row.pg_order_password));
      bankOutcome = classifyOrderStatus(order);
    } catch (error) {
      bankOutcome = 'unreachable';
      if (req.body?.force !== true) {
        const detail = translateMessage(error.message, langOf(req));
        throw fail(t(
          `Die Bank konnte nicht abgefragt werden (${detail}). Nur fortfahren, wenn sicher ist, dass nicht bezahlt wurde.`,
          `The bank could not be reached (${detail}). Only continue if you are sure nothing was paid.`,
        ), 409, { code: 'bank_unreachable' });
      }
    }
  }
  if (bankOutcome === 'paid') {
    throw fail(t(
      'Die Bank meldet diese Zahlung als bezahlt. Bitte „Mit Bank abgleichen“ verwenden, damit der Auftrag angelegt wird.',
      'The bank reports this payment as paid. Please use "Check with bank" so the order gets created.',
    ), 409);
  }

  const { data, error } = await supabase
    .from('lead_payments')
    .update({ status: 'failed', pg_status: SUPPORT_CANCELLED_STATUS })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw fail(t('Die Zahlung wurde inzwischen verändert. Bitte neu laden.', 'The payment has changed in the meantime. Please reload.'), 409);
  await releaseReservedForPayment(row.id).catch((releaseError) => {
    console.error('IT support: discount reservation could not be released:', releaseError.message);
  });
  logPaymentEvent('payment_failed', {
    userId: row.berater_id,
    paymentId: row.id,
    req,
    metadata: { reason: SUPPORT_CANCELLED_STATUS, bankOutcome, actorId: req.user.id },
  });
  await logItAction(req, {
    action: 'payment.mark_failed',
    targetType: 'payment',
    targetId: row.id,
    targetLabel: paymentLabel(row),
    reason,
    summary: both(
      `Offene Zahlung als abgebrochen markiert (Bankstatus: ${bankOutcome})`,
      `Open payment marked as cancelled (bank status: ${bankOutcome})`,
    ),
    before: { status: row.status, pgStatus: row.pg_status },
    after: { status: 'failed', pgStatus: SUPPORT_CANCELLED_STATUS },
  });
  res.json({ payment: consolePayment(data) });
}));

router.post('/:id/repair-request', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const reason = requireReason(req);
  const row = await loadPayment(req);
  if (row.status !== 'paid') throw fail(t('Nur bezahlte Zahlungen erhalten einen Auftrag.', 'Only paid payments get an order.'));
  if (row.request_id) throw fail(t('Für diese Zahlung existiert bereits ein Auftrag.', 'An order already exists for this payment.'), 409);

  const request = await createLeadRequest(row.berater_id, {
    requestedCount: row.lead_count,
    leadType: row.lead_type || 'PKV',
    scope: row.scope,
    territory: row.territory || undefined,
    desiredTimeframe: row.desired_timeframe || undefined,
    notes: `${row.package_label} · ${row.invoice_number} (nachträglich angelegt durch IT-Support)`,
    createdBy: req.user.id,
    notifyAdmins: true,
  });
  const { data, error } = await supabase
    .from('lead_payments')
    .update({ request_id: request.id })
    .eq('id', row.id)
    .is('request_id', null)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    await supabase.from('lead_requests').update({ status: 'cancelled' }).eq('id', request.id);
    throw fail(t('Die Zahlung wurde inzwischen verändert. Bitte neu laden.', 'The payment has changed in the meantime. Please reload.'), 409);
  }
  const code = request.code || request.id;
  await logItAction(req, {
    action: 'payment.repair_request',
    targetType: 'payment',
    targetId: row.id,
    targetLabel: paymentLabel(row),
    reason,
    summary: both(
      `Fehlenden Lead-Auftrag angelegt (${code}, ${row.lead_count} Leads)`,
      `Missing lead order created (${code}, ${row.lead_count} leads)`,
    ),
    before: { requestId: null },
    after: { requestId: request.id, requestCode: request.code || null },
  });
  res.json({ payment: consolePayment(data), request });
}));

export default router;
