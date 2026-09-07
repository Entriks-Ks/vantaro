import { Router } from 'express';
import { requireAuth, requireRole } from '../../lib/auth.js';
import { ROLES } from '../../lib/roles.js';
import { getTcDialConfig } from '../../lib/tcdial/config.js';
import {
  listTcDialWebhookChannels,
  subscribeAgentSetDisposition,
  unsubscribeAgentSetDisposition,
} from '../../lib/tcdial/client.js';
import {
  columnMissingExternalId,
  ingestTcDialDisposition,
  summarizeIngest,
} from '../../lib/tcdial/ingest.js';
import {
  rememberWebhookId,
  verifyTcDialWebhook,
  wasWebhookProcessed,
} from '../../lib/tcdial/verify.js';
import { handleLeadError, tableMissingResponse } from '../../lib/leads.js';

const router = Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

function rawBodyString(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  if (typeof req.rawBody === 'string') return req.rawBody;
  return JSON.stringify(req.body ?? {});
}

router.get('/status', ...adminOnly, (_req, res) => {
  const config = getTcDialConfig();
  res.json({
    configured: config.configured,
    webhookConfigured: config.webhookConfigured,
    apiBaseUrl: config.apiBaseUrl || null,
    webhookUrl: config.webhookUrl || null,
    callStatusGroups: config.callStatusGroups,
    callStatuses: config.callStatuses,
    campaigns: config.campaigns,
    skipVerify: config.skipVerify,
  });
});

router.get('/channels', ...adminOnly, async (_req, res) => {
  try {
    const channels = await listTcDialWebhookChannels();
    res.json({ channels });
  } catch (error) {
    const status = error.status || 502;
    res.status(status).json({ error: error.message || 'TC-Dial Channels konnten nicht geladen werden.' });
  }
});

router.post('/subscribe', ...adminOnly, async (req, res) => {
  try {
    const result = await subscribeAgentSetDisposition(req.body || {});
    res.json({ ok: true, subscription: result });
  } catch (error) {
    const status = error.status || 502;
    res.status(status).json({ error: error.message || 'TC-Dial Subscribe fehlgeschlagen.' });
  }
});

router.delete('/subscribe', ...adminOnly, async (req, res) => {
  try {
    const hookUrl = req.body?.hookUrl || req.query?.hookUrl;
    await unsubscribeAgentSetDisposition(hookUrl);
    res.json({ ok: true });
  } catch (error) {
    const status = error.status || 502;
    res.status(status).json({ error: error.message || 'TC-Dial Unsubscribe fehlgeschlagen.' });
  }
});

router.post('/agent-set-disposition', async (req, res) => {
  try {
    const config = getTcDialConfig();
    if (!config.configured) {
      return res.status(503).json({
        error: 'TC-Dial ist nicht konfiguriert. Bitte TCDIAL_API_BASE_URL und TCDIAL_API_KEY setzen.',
      });
    }

    const verified = verifyTcDialWebhook({
      headers: req.headers,
      rawBody: rawBodyString(req),
    });

    if (wasWebhookProcessed(verified.webhookId)) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const result = await ingestTcDialDisposition(req.body || {});
    rememberWebhookId(verified.webhookId);
    res.status(result.created ? 201 : 200).json(summarizeIngest(result));
  } catch (error) {
    if (columnMissingExternalId(error)) {
      return tableMissingResponse(
        res,
        'Externe Lead-IDs fehlen. Bitte server/supabase/lead_external_id.sql im Supabase SQL Editor ausführen.',
      );
    }
    console.error('TC-Dial webhook failed:', error.message || error);
    handleLeadError(res, error);
  }
});

export default router;
