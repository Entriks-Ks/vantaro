import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  checkoutLeadPackage,
  listAllPayments,
  listMyPayments,
  paymentTableMissing,
} from '../lib/payments.js';
import { handleLeadError, tableMissingResponse } from '../lib/leads.js';

const router = Router();
router.use(requireAuth);

function handleError(res, error) {
  if (paymentTableMissing(error)) {
    return tableMissingResponse(
      res,
      'Zahlungen fehlen. Bitte server/supabase/lead_payments.sql im Supabase SQL Editor ausführen.',
    );
  }
  return handleLeadError(res, error);
}

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

router.post('/checkout', async (req, res) => {
  try {
    const result = await checkoutLeadPackage(req.user, {
      packageId: req.body?.packageId ?? req.body?.package_id,
      requestedCount: req.body?.requestedCount ?? req.body?.requested_count,
      card: req.body?.card,
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
