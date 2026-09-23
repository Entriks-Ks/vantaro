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

const router = Router();

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
        browser: req.body?.browser,
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
