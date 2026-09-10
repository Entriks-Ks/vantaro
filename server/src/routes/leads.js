import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  createLead,
  deleteLead,
  getLeadById,
  handleLeadError,
  importLeads,
  isUuid,
  listLeads,
  listMyLeads,
  LEAD_STATUSES,
  restoreRejectedLead,
  tableMissingResponse,
  updateLead,
  withAssignee,
} from '../lib/leads.js';
import {
  attachComplaints,
  complaintTableMissing,
  reportLead,
} from '../lib/complaints.js';
import { notifyFollowUpSaved } from '../lib/followUpReminders.js';

const router = Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

function hideBrokerNotes(lead) {
  if (!lead) return lead;
  const { brokerNotes, ...rest } = lead;
  return rest;
}

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const leads = await attachComplaints(await listMyLeads(req.user.id));
    res.json({ leads });
  } catch (error) {
    if (complaintTableMissing(error)) {
      return tableMissingResponse(
        res,
        'Reklamationen fehlen. Bitte server/supabase/lead_workflow.sql im Supabase SQL Editor ausführen.',
      );
    }
    handleLeadError(res, error);
  }
});

router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    }
    if (req.user.role !== ROLES.BERATER) {
      return res.status(403).json({ error: 'Nur Berater können Leads reklamieren.' });
    }
    const complaint = await reportLead(req.params.id, req.user.id, {
      reason: req.body?.reason,
      comment: req.body?.comment,
      proofName: req.body?.proofName ?? req.body?.proof_name,
      proofData: req.body?.proofData ?? req.body?.proof_data,
      contactStatus: req.body?.contactStatus ?? req.body?.contact_status,
      notes: req.body?.notes ?? req.body?.brokerNotes,
    });
    res.status(201).json({ complaint });
  } catch (error) {
    if (complaintTableMissing(error)) {
      return tableMissingResponse(
        res,
        'Reklamationen fehlen. Bitte server/supabase/lead_workflow.sql im Supabase SQL Editor ausführen.',
      );
    }
    handleLeadError(res, error);
  }
});

router.get('/', ...adminOnly, async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const assignedTo = String(req.query.assignedTo || req.query.assigned_to || '').trim();
    const search = String(req.query.q || req.query.search || '').trim();

    const leads = await listLeads({
      status: LEAD_STATUSES.includes(status) ? status : '',
      assignedTo,
      search,
      scope: String(req.query.scope || '').trim(),
    });
    res.json({ leads: leads.map(hideBrokerNotes) });
  } catch (error) {
    handleLeadError(res, error);
  }
});

router.post('/', ...adminOnly, async (req, res) => {
  try {
    const source = req.body?.source === 'api' ? 'api' : 'manual';
    const lead = await createLead(req.body || {}, { createdBy: req.user.id, source });
    res.status(201).json({ lead: hideBrokerNotes(lead) });
  } catch (error) {
    handleLeadError(res, error);
  }
});

router.post('/import', ...adminOnly, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length > 500) {
      return res.status(400).json({ error: 'Maximal 500 Zeilen pro Import.' });
    }
    const result = await importLeads(rows, { createdBy: req.user.id });
    res.json({
      created: (result.created || []).map(hideBrokerNotes),
      createdCount: result.created.length,
      errors: result.errors,
    });
  } catch (error) {
    handleLeadError(res, error);
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    }
    const row = await getLeadById(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Lead wurde nicht gefunden.' });
    }
    if (req.user.role !== ROLES.ADMIN && row.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    const [lead] = await attachComplaints([await withAssignee(row)]);
    res.json({
      lead: req.user.role === ROLES.ADMIN ? hideBrokerNotes(lead) : lead,
    });
  } catch (error) {
    if (complaintTableMissing(error)) {
      return tableMissingResponse(
        res,
        'Reklamationen fehlen. Bitte server/supabase/lead_workflow.sql im Supabase SQL Editor ausführen.',
      );
    }
    handleLeadError(res, error);
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    }
    const current = await getLeadById(req.params.id);
    if (!current) {
      return res.status(404).json({ error: 'Lead wurde nicht gefunden.' });
    }

    if (req.user.role === ROLES.ADMIN) {
      const body = { ...(req.body || {}) };
      delete body.brokerNotes;
      delete body.broker_notes;
      const lead = await updateLead(req.params.id, body);
      if (!lead) {
        return res.status(404).json({ error: 'Lead wurde nicht gefunden.' });
      }
      return res.json({ lead: hideBrokerNotes(lead) });
    }

    if (req.user.role !== ROLES.BERATER || current.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    if (current.refunded_at) {
      return res.status(400).json({ error: 'Erstattete Leads können nicht bearbeitet werden.' });
    }

    const payload = {};
    if (req.body?.status != null) payload.status = req.body.status;
    if (req.body?.brokerNotes != null || req.body?.broker_notes != null) {
      payload.brokerNotes = req.body.brokerNotes ?? req.body.broker_notes;
    }
    if (req.body?.contactStatus != null || req.body?.contact_status != null) {
      payload.contactStatus = req.body.contactStatus ?? req.body.contact_status;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'followUpAt')
      || Object.prototype.hasOwnProperty.call(req.body || {}, 'follow_up_at')) {
      payload.followUpAt = req.body.followUpAt ?? req.body.follow_up_at;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'appointmentAt')
      || Object.prototype.hasOwnProperty.call(req.body || {}, 'appointment_at')) {
      payload.appointmentAt = req.body.appointmentAt ?? req.body.appointment_at;
    }
    const lead = await updateLead(req.params.id, payload, { bypassDeliveryLock: true });
    if (!lead) {
      return res.status(404).json({ error: 'Lead wurde nicht gefunden.' });
    }
    const previousFollowUp = current.follow_up_at ? new Date(current.follow_up_at).toISOString() : '';
    const nextFollowUp = lead.followUpAt ? new Date(lead.followUpAt).toISOString() : '';
    if (previousFollowUp !== nextFollowUp && lead.contactStatus === 'wiedervorlage' && lead.followUpAt) {
      notifyFollowUpSaved(lead).catch((error) => {
        console.error('Wiedervorlage notify failed:', error.message);
      });
    }
    const [withComplaint] = await attachComplaints([lead]);
    res.json({ lead: withComplaint });
  } catch (error) {
    if (complaintTableMissing(error)) {
      return tableMissingResponse(
        res,
        'Reklamationen fehlen. Bitte server/supabase/lead_workflow.sql im Supabase SQL Editor ausführen.',
      );
    }
    handleLeadError(res, error);
  }
});

router.post('/:id/restore', ...adminOnly, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    }
    const lead = await restoreRejectedLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead wurde nicht gefunden.' });
    }
    res.json({ lead: hideBrokerNotes(lead) });
  } catch (error) {
    handleLeadError(res, error);
  }
});

router.delete('/:id', ...adminOnly, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    }
    const removed = await deleteLead(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Lead wurde nicht gefunden.' });
    }
    res.json({ ok: true });
  } catch (error) {
    handleLeadError(res, error);
  }
});

export default router;
