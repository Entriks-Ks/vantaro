import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  complaintTableMissing,
  listComplaints,
  listComplaintsForBerater,
  reviewComplaint,
  sendComplaintReplacement,
} from '../lib/complaints.js';
import { handleLeadError, isUuid, tableMissingResponse } from '../lib/leads.js';

const router = Router();
router.use(requireAuth);

function handleError(res, error) {
  if (complaintTableMissing(error)) {
    return tableMissingResponse(
      res,
      'Reklamationen fehlen. Bitte server/supabase/lead_workflow.sql im Supabase SQL Editor ausführen.',
    );
  }
  return handleLeadError(res, error);
}

router.get('/', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const complaints = await listComplaints({ status });
    res.json({ complaints });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/mine', async (req, res) => {
  try {
    const complaints = await listComplaintsForBerater(req.user.id);
    res.json({ complaints });
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Reklamation wurde nicht gefunden.' });
    }
    const result = await reviewComplaint(req.params.id, {
      status: req.body?.status,
      note: req.body?.note ?? req.body?.adminNote ?? req.body?.admin_note,
      replaceLeadId: req.body?.replaceLeadId ?? req.body?.replace_lead_id,
      refundCents: req.body?.refundCents ?? req.body?.refund_cents,
      reviewerId: req.user.id,
    });
    if (!result) {
      return res.status(404).json({ error: 'Reklamation wurde nicht gefunden.' });
    }
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/replacement', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Reklamation wurde nicht gefunden.' });
    }
    const result = await sendComplaintReplacement(
      req.params.id,
      req.body?.replaceLeadId ?? req.body?.replace_lead_id ?? req.body?.leadId ?? req.body?.lead_id,
    );
    if (!result) {
      return res.status(404).json({ error: 'Reklamation wurde nicht gefunden.' });
    }
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/refund', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Reklamation wurde nicht gefunden.' });
    }
    const result = await reviewComplaint(req.params.id, {
      status: 'approved',
      replaceLeadId: req.body?.replaceLeadId ?? req.body?.replace_lead_id,
      reviewerId: req.user.id,
    });
    if (!result) {
      return res.status(404).json({ error: 'Reklamation wurde nicht gefunden.' });
    }
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
