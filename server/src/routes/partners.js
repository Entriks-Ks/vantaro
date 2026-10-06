import { Router } from 'express';
import { partnerPageOptions, requireAuth } from '../lib/auth.js';
import { handleLeadError, isUuid } from '../lib/leads.js';
import {
  assignLeadHolder,
  createPartner,
  deletePartner,
  listPartners,
  partnerRolesFor,
  resetPartnerPassword,
  sendPartnerPasswordLink,
  updatePartner,
} from '../lib/partners.js';

const router = Router();

function handleError(res, error) {
  if (error?.status) return res.status(error.status).json({ error: error.message });
  return handleLeadError(res, error);
}

function options(user) {
  return { pageOptions: partnerPageOptions(user.vertical), roleOptions: partnerRolesFor(user.vertical) };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    res.json({ partners: await listPartners(req.user), ...options(req.user) });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const created = await createPartner(req.user, {
      firstName: req.body?.firstName,
      lastName: req.body?.lastName,
      email: req.body?.email,
      partnerRole: req.body?.partnerRole ?? req.body?.energyRole,
      pages: req.body?.pages,
    });
    res.status(201).json(created);
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Unterpartner wurde nicht gefunden.' });
    const partner = await updatePartner(req.user, req.params.id, {
      active: req.body?.active,
      pages: req.body?.pages,
      partnerRole: req.body?.partnerRole ?? req.body?.energyRole,
      firstName: req.body?.firstName,
      lastName: req.body?.lastName,
      email: req.body?.email,
    });
    res.json({ partner, ...options(req.user) });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/password-link', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Unterpartner wurde nicht gefunden.' });
    res.json(await sendPartnerPasswordLink(req.user, req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/password', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Unterpartner wurde nicht gefunden.' });
    res.json(await resetPartnerPassword(req.user, req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Unterpartner wurde nicht gefunden.' });
    res.json(await deletePartner(req.user, req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/leads/:id/assign', requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Lead wurde nicht gefunden.' });
    const lead = await assignLeadHolder(req.user, req.params.id, req.body?.holderId);
    res.json({ lead });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
