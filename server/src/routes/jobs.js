import { Router } from 'express';
import { tickFollowUpReminders } from '../lib/followUpReminders.js';

const router = Router();

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = String(req.get('authorization') || '');
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const custom = String(req.get('x-cron-secret') || '').trim();
  return bearer === secret || custom === secret;
}

router.post('/follow-up-reminders', async (req, res) => {
  if (!cronAuthorized(req)) {
    return res.status(401).json({ error: 'Keine Berechtigung.' });
  }
  const result = await tickFollowUpReminders();
  res.json({ ok: true, ...result });
});

export default router;
