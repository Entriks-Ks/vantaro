import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  cancelOwnRequest,
  createLeadRequest,
  listAllRequests,
  listRequestsForBerater,
  requestTableMissing,
  updateLeadRequest,
} from '../lib/leadRequests.js';
import { handleLeadError, isUuid, tableMissingResponse } from '../lib/leads.js';

const router = Router();
router.use(requireAuth);

function handleError(res, error) {
  if (requestTableMissing(error)) {
    return tableMissingResponse(
      res,
      'Lead-Anfragen fehlen. Bitte server/supabase/lead_workflow.sql im Supabase SQL Editor ausführen.',
    );
  }
  return handleLeadError(res, error);
}

router.get('/', requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const requests = await listAllRequests();
    res.json({ requests });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/mine', async (req, res) => {
  try {
    const requests = await listRequestsForBerater(req.user.id);
    const current = requests.find((entry) => entry.status === 'active')
      || requests.find((entry) => entry.status === 'pending')
      || requests[0]
      || null;
    res.json({ request: current, requests });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.user.role !== ROLES.BERATER) {
      return res.status(403).json({ error: 'Nur Berater können Leads anfragen.' });
    }
    const request = await createLeadRequest(req.user.id, {
      requestedCount: req.body?.requestedCount ?? req.body?.requested_count,
      leadType: req.body?.leadType ?? req.body?.lead_type,
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
      return res.status(400).json({ error: 'Anfrage wurde nicht gefunden.' });
    }
    const request = await updateLeadRequest(req.params.id, {
      requestedCount: req.body?.requestedCount ?? req.body?.requested_count,
      notes: req.body?.notes,
      status: req.body?.status,
      leadType: req.body?.leadType ?? req.body?.lead_type,
      replaceOnRefund: req.body?.replaceOnRefund ?? req.body?.replace_on_refund,
    });
    if (!request) {
      return res.status(404).json({ error: 'Anfrage wurde nicht gefunden.' });
    }
    res.json({ request });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Anfrage wurde nicht gefunden.' });
    }
    if (req.user.role !== ROLES.BERATER) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    const request = await cancelOwnRequest(req.params.id, req.user.id);
    if (!request) {
      return res.status(404).json({ error: 'Anfrage wurde nicht gefunden.' });
    }
    res.json({ request });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
