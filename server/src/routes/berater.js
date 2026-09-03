import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  createLeadRequest,
  getBeraterPipeline,
  listBeraterPipelines,
  recallLeadFromRequest,
  requestTableMissing,
  sendLeadsToRequest,
  updateLeadRequest,
} from '../lib/leadRequests.js';
import { handleLeadError, isUuid, tableMissingResponse } from '../lib/leads.js';
import { attachComplaints } from '../lib/complaints.js';
import {
  attachPaymentsToPipelines,
  attachPaymentsToRequests,
  listMyPayments,
  paymentTableMissing,
} from '../lib/payments.js';

const router = Router();
router.use(requireAuth, requireRole(ROLES.ADMIN));

function handleError(res, error) {
  if (requestTableMissing(error)) {
    return tableMissingResponse(
      res,
      'Berater-Aufträge fehlen. Bitte server/supabase/lead_requests.sql, lead_workflow.sql und lead_request_code.sql im Supabase SQL Editor ausführen.',
    );
  }
  return handleLeadError(res, error);
}

router.get('/', async (_req, res) => {
  try {
    const beraters = await attachPaymentsToPipelines(await listBeraterPipelines());
    res.json({ beraters });
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/requests/:requestId', async (req, res) => {
  try {
    if (!isUuid(req.params.requestId)) {
      return res.status(400).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    const request = await updateLeadRequest(req.params.requestId, {
      requestedCount: req.body?.requestedCount ?? req.body?.requested_count,
      notes: req.body?.notes,
      status: req.body?.status,
      leadType: req.body?.leadType ?? req.body?.lead_type,
      scope: req.body?.scope,
      replaceOnRefund: req.body?.replaceOnRefund ?? req.body?.replace_on_refund,
    });
    if (!request) {
      return res.status(404).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    res.json({ request });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/requests/:requestId/send', async (req, res) => {
  try {
    if (!isUuid(req.params.requestId)) {
      return res.status(400).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    const result = await sendLeadsToRequest(
      req.params.requestId,
      req.body?.leadIds || req.body?.lead_ids || [],
    );
    if (!result) {
      return res.status(404).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/requests/:requestId/recall', async (req, res) => {
  try {
    if (!isUuid(req.params.requestId)) {
      return res.status(400).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    const result = await recallLeadFromRequest(
      req.params.requestId,
      req.body?.leadId || req.body?.lead_id,
    );
    if (!result) {
      return res.status(404).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Berater wurde nicht gefunden.' });
    }
    const payload = await getBeraterPipeline(req.params.id);
    const requests = await attachPaymentsToRequests(payload.requests || []);
    const request = requests.find((entry) => entry.id === payload.request?.id) || payload.request || null;
    payload.requests = requests;
    payload.request = request;
    payload.sentLeads = await attachComplaints(payload.sentLeads || []);
    payload.requestLeads = await attachComplaints(payload.requestLeads || []);
    try {
      payload.payments = await listMyPayments(req.params.id);
    } catch (error) {
      if (!paymentTableMissing(error)) throw error;
      payload.payments = [];
    }
    res.json(payload);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/requests', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Berater wurde nicht gefunden.' });
    }
    const request = await createLeadRequest(req.params.id, {
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

export default router;
