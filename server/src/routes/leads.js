import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  assignLead,
  createLead,
  deleteLead,
  getLeadById,
  handleLeadError,
  importLeads,
  isUuid,
  listLeads,
  listMyLeads,
  LEAD_STATUSES,
  updateLead,
  withAssignee,
} from '../lib/leads.js';

const router = Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const leads = await listMyLeads(req.user.id);
    res.json({ leads });
  } catch (error) {
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
    });
    res.json({ leads });
  } catch (error) {
    handleLeadError(res, error);
  }
});

router.post('/', ...adminOnly, async (req, res) => {
  try {
    const source = req.body?.source === 'api' ? 'api' : 'manual';
    const lead = await createLead(req.body || {}, { createdBy: req.user.id, source });
    res.status(201).json({ lead });
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
      created: result.created,
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
    res.json({ lead: await withAssignee(row) });
  } catch (error) {
    handleLeadError(res, error);
  }
});

router.patch('/:id', ...adminOnly, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    }
    const lead = await updateLead(req.params.id, req.body || {});
    if (!lead) {
      return res.status(404).json({ error: 'Lead wurde nicht gefunden.' });
    }
    res.json({ lead });
  } catch (error) {
    handleLeadError(res, error);
  }
});

router.patch('/:id/assign', ...adminOnly, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    }
    const assignedTo = req.body?.assignedTo ?? req.body?.assigned_to ?? null;
    const lead = await assignLead(req.params.id, assignedTo || null);
    if (!lead) {
      return res.status(404).json({ error: 'Lead wurde nicht gefunden.' });
    }
    res.json({ lead });
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
