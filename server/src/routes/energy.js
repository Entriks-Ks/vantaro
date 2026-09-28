import { Router } from 'express';
import { ENERGY_PAGE_OPTIONS, requireAuth, requireRole } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import { handleLeadError, isUuid } from '../lib/leads.js';
import {
  assignEnergyHolder,
  billingView,
  calendarConnectUrl,
  calendarReturnUrl,
  calendarStatus,
  connectCalendarFromCode,
  createEnergyPartner,
  decideEnergyComplaint,
  disconnectCalendar,
  invoiceOpenLines,
  listEnergyComplaints,
  listEnergyPartners,
  openEnergyComplaint,
  saveBillingProfile,
  setEnergyOutcome,
  updateEnergyPartner,
} from '../lib/energy.js';

const router = Router();

function handleError(res, error) {
  if (error?.status) return res.status(error.status).json({ error: error.message });
  return handleLeadError(res, error);
}

router.post('/partners', requireAuth, async (req, res) => {
  try {
    const created = await createEnergyPartner(req.user, req.body || {});
    res.status(201).json(created);
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/partners/:id', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Unterpartner wurde nicht gefunden.' });
    const partner = await updateEnergyPartner(req.user, req.params.id, {
      active: req.body?.active,
      pages: req.body?.pages,
      energyRole: req.body?.energyRole ?? req.body?.energy_role,
    });
    res.json({ partner, pageOptions: ENERGY_PAGE_OPTIONS });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/partners', requireAuth, async (req, res) => {
  try {
    res.json({ partners: await listEnergyPartners(req.user), pageOptions: ENERGY_PAGE_OPTIONS });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/leads/:id/assign', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    const lead = await assignEnergyHolder(req.user, req.params.id, req.body?.holderId || req.body?.holder_id);
    res.json({ lead });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/leads/:id/outcome', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    const lead = await setEnergyOutcome(req.user, req.params.id, {
      status: req.body?.status,
      appointmentAt: req.body?.appointmentAt || req.body?.appointment_at,
    });
    res.json({ lead });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/billing', requireAuth, async (req, res) => {
  try {
    res.json(await billingView(req.user, req.query.companyId || req.query.company_id));
  } catch (error) {
    handleError(res, error);
  }
});

router.put('/billing/:companyId', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    if (!isUuid(req.params.companyId)) return res.status(400).json({ error: 'Firma wurde nicht gefunden.' });
    res.json({ profile: await saveBillingProfile(req.params.companyId, req.body || {}) });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/billing/:companyId/invoice', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const lines = await invoiceOpenLines(req.params.companyId, req.body?.invoiceId || req.body?.invoice_id);
    res.json({ lines });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/complaints', requireAuth, async (req, res) => {
  try {
    res.json({ complaints: await listEnergyComplaints(req.user) });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/leads/:id/complaints', requireAuth, async (req, res) => {
  try {
    const complaint = await openEnergyComplaint(req.user, req.params.id, req.body || {});
    res.status(201).json({ complaint });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/complaints/:id/decide', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const complaint = await decideEnergyComplaint(req.user.id, req.params.id, req.body?.status);
    res.json({ complaint });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/calendar/status', requireAuth, async (req, res) => {
  try {
    res.json(await calendarStatus(req.user.id));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/calendar/connect', requireAuth, async (req, res) => {
  try {
    res.json({ url: calendarConnectUrl(req.user) });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/calendar/callback', async (req, res) => {
  try {
    await connectCalendarFromCode(req.query.state, req.query.code);
    res.redirect(calendarReturnUrl(true));
  } catch (error) {
    console.error('Energy calendar callback failed:', error.message);
    res.redirect(calendarReturnUrl(false));
  }
});

router.post('/calendar/disconnect', requireAuth, async (req, res) => {
  try {
    res.json(await disconnectCalendar(req.user.id));
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
