import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  checkoutLeadPackage,
  completePaymentReturn,
  getPaymentForViewer,
  listAllPayments,
  listMyPayments,
  paymentTableMissing,
  syncMyPayment,
} from '../lib/payments.js';
import { buildInvoicePdf, invoiceDownloadName } from '../lib/invoice.js';
import { handleLeadError, tableMissingResponse } from '../lib/leads.js';
import { isMockPayments } from '../lib/paymentGateway.js';
import { decideMockOrder, getMockOrder } from '../lib/mockGateway.js';

const router = Router();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fake Hosted Payment Page — only when PAYMENT_PROVIDER=mock outside production. */
router.get('/mock-hpp', (req, res) => {
  if (!isMockPayments()) return res.status(404).send('Not found');
  const id = String(req.query?.id || '');
  const password = String(req.query?.password || '');
  const order = getMockOrder(id, password);
  if (!order) return res.status(404).send('Mock-Order nicht gefunden (Server neu gestartet?). Bitte Checkout neu starten.');

  const amount = (order.amountCents / 100).toFixed(2).replace('.', ',');
  const link = (outcome) => {
    const params = new URLSearchParams({ id, password, outcome });
    return `/api/payments/mock-hpp/decide?${params.toString()}`;
  };

  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Mock-Zahlung</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f4f5f7;display:flex;justify-content:center;padding:60px 16px;margin:0}
  .card{background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08);padding:32px;max-width:420px;width:100%}
  .badge{display:inline-block;background:#fff3cd;color:#8a6d00;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600}
  .amount{font-size:32px;font-weight:700;margin:16px 0 4px}
  .desc{color:#555;margin-bottom:24px}
  a{display:block;text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:10px}
  .pay{background:#16a34a;color:#fff}.fail{background:#dc2626;color:#fff}.cancel{background:#e5e7eb;color:#111}
</style></head>
<body><div class="card">
  <span class="badge">TESTMODUS — keine echte Zahlung</span>
  <div class="amount">${escapeHtml(amount)} €</div>
  <div class="desc">${escapeHtml(order.description)}</div>
  <a class="pay" href="${escapeHtml(link('paid'))}">Zahlung erfolgreich</a>
  <a class="fail" href="${escapeHtml(link('failed'))}">Zahlung abgelehnt</a>
  <a class="cancel" href="${escapeHtml(link('cancel'))}">Abbrechen</a>
</div></body></html>`);
});

router.get('/mock-hpp/decide', (req, res) => {
  if (!isMockPayments()) return res.status(404).send('Not found');
  const back = decideMockOrder(req.query?.id, req.query?.password, String(req.query?.outcome || ''));
  if (!back) return res.status(404).send('Mock-Order nicht gefunden. Bitte Checkout neu starten.');
  res.redirect(303, back);
});

function handleError(res, error) {
  if (paymentTableMissing(error)) {
    return tableMissingResponse(
      res,
      'Zahlungen fehlen. Bitte server/supabase/lead_payments.sql und lead_payments_procredit.sql im Supabase SQL Editor ausführen.',
    );
  }
  return handleLeadError(res, error);
}

/** Bank HPP return — no session; identified by return_token. */
router.get('/return', async (req, res) => {
  try {
    const result = await completePaymentReturn({
      token: req.query?.token,
      paymentId: req.query?.paymentId || req.query?.payment_id,
    });
    res.redirect(303, result.redirectTo);
  } catch (error) {
    const frontend = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'https://www.vantaro.io')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    const message = encodeURIComponent(error.message || 'Zahlung konnte nicht bestätigt werden.');
    res.redirect(303, `${frontend}/dashboard/paket?payment=failed&error=${message}`);
  }
});

router.use(requireAuth);

router.get('/', requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const payments = await listAllPayments();
    res.json({ payments });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/mine', async (req, res) => {
  try {
    if (req.user.role !== ROLES.BERATER) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    const payments = await listMyPayments(req.user.id);
    res.json({ payments });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id/invoice', async (req, res) => {
  try {
    const payment = await getPaymentForViewer(req.user, req.params.id);
    const download = ['1', 'true', 'download'].includes(String(req.query.download || '').toLowerCase());
    const filename = invoiceDownloadName(payment);
    const pdf = buildInvoicePdf(payment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const result = await checkoutLeadPackage(
      req.user,
      {
        packageId: req.body?.packageId ?? req.body?.package_id,
        requestedCount: req.body?.requestedCount ?? req.body?.requested_count,
        territory: req.body?.territory,
        desiredTimeframe: req.body?.desiredTimeframe ?? req.body?.desired_timeframe,
        browser: req.body?.browser,
        useOneTimeId: req.body?.useOneTimeId ?? req.body?.use_one_time_id ?? req.body?.useOneTimeDiscountId,
      },
      req,
    );
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/sync', async (req, res) => {
  try {
    const result = await syncMyPayment(req.user, req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
