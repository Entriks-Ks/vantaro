import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import { isUuid, handleLeadError, tableMissingResponse } from '../lib/leads.js';
import {
  createDiscount,
  deleteDiscount,
  discountTableMissing,
  listDiscountsForBerater,
  listMineDiscounts,
  paidUnitCount,
  revokeDiscount,
  updateDiscount,
} from '../lib/discounts.js';

const router = Router();

function handleError(res, error) {
  if (discountTableMissing(error)) {
    return tableMissingResponse(
      res,
      'Rabatte fehlen. Bitte server/supabase/berater_discounts.sql im Supabase SQL Editor ausführen.',
    );
  }
  return handleLeadError(res, error);
}

router.use(requireAuth);

router.get('/mine', async (req, res) => {
  try {
    if (req.user.role !== ROLES.BERATER) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    const payload = await listMineDiscounts(req.user.id);
    res.json(payload);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const beraterId = String(req.query.beraterId || req.query.berater_id || '').trim();
    if (!isUuid(beraterId)) {
      return res.status(400).json({ error: 'Berater wurde nicht gefunden.' });
    }
    const [discounts, paidUnits] = await Promise.all([
      listDiscountsForBerater(beraterId),
      paidUnitCount(beraterId),
    ]);
    res.json({ discounts, paidUnits });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const discount = await createDiscount(req.user, req.body || {});
    res.status(201).json({ discount });
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Rabatt wurde nicht gefunden.' });
    }
    const status = String(req.body?.status || '').trim();
    if (status === 'revoked') {
      const discount = await revokeDiscount(req.user, req.params.id);
      return res.json({ discount });
    }
    const discount = await updateDiscount(req.user, req.params.id, req.body || {});
    res.json({ discount });
  } catch (error) {
    handleError(res, error);
  }
});

router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Rabatt wurde nicht gefunden.' });
    }
    const result = await deleteDiscount(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
