import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  cancelOwnRequest,
  createLeadRequest,
  listAllRequests,
  listRequestsForBerater,
  pickWorkingRequest,
  requestTableMissing,
  updateLeadRequest,
} from '../lib/leadRequests.js';
import { handleLeadError, isUuid, tableMissingResponse } from '../lib/leads.js';
import { attachPaymentsToRequests } from '../lib/payments.js';

const router = Router();
router.use(requireAuth);

function handleError(res, error) {
  if (requestTableMissing(error)) {
    return tableMissingResponse(
      res,
      'Lead-Anforderungen fehlen. Bitte server/supabase/lead_workflow.sql und lead_request_code.sql im Supabase SQL Editor ausführen.',
    );
  }
  return handleLeadError(res, error);
}

router.get('/', requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const requests = await attachPaymentsToRequests(await listAllRequests());
    res.json({ requests });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/mine', async (req, res) => {
  try {
    const requests = await attachPaymentsToRequests(await listRequestsForBerater(req.user.id));
    res.json({
      request: pickWorkingRequest(requests),
      pending: null,
      requests,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.user.role !== ROLES.BERATER) {
      return res.status(403).json({ error: 'Nur Berater können Leads anfordern.' });
    }
    const request = await createLeadRequest(req.user.id, {
      requestedCount: req.body?.requestedCount ?? req.body?.requested_count,
      leadType: req.body?.leadType ?? req.body?.lead_type,
      scope: req.body?.scope,
      notes: req.body?.notes,
      createdBy: req.user.id,
    });
    res.status(201).json({ request });
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Anforderung wurde nicht gefunden.' });
    }
    const request = await updateLeadRequest(req.params.id, {
      requestedCount: req.body?.requestedCount ?? req.body?.requested_count,
      notes: req.body?.notes,
      status: req.body?.status,
      leadType: req.body?.leadType ?? req.body?.lead_type,
      scope: req.body?.scope,
      replaceOnRefund: req.body?.replaceOnRefund ?? req.body?.replace_on_refund,
    });
    if (!request) {
      return res.status(404).json({ error: 'Anforderung wurde nicht gefunden.' });
    }
    res.json({ request });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Anforderung wurde nicht gefunden.' });
    }
    if (req.user.role !== ROLES.BERATER) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    const request = await cancelOwnRequest(req.params.id, req.user.id);
    if (!request) {
      return res.status(404).json({ error: 'Anforderung wurde nicht gefunden.' });
    }
    res.json({ request });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
