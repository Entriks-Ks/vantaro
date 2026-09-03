import { getTcDialConfig } from './config.js';

function trim(value) {
  return String(value || '').trim();
}

async function tcDialFetch(path, { method = 'GET', body } = {}) {
  const config = getTcDialConfig();
  if (!config.configured) {
    const error = new Error('TC-Dial ist nicht konfiguriert (TCDIAL_API_BASE_URL / TCDIAL_API_KEY).');
    error.status = 503;
    throw error;
  }

  const url = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: 'application/json',
  };
  if (body != null) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data
      ? (data.message || data.error || data.title || JSON.stringify(data))
      : (text || response.statusText);
    const error = new Error(`TC-Dial API ${response.status}: ${message}`);
    error.status = response.status === 401 || response.status === 403 ? 502 : 502;
    error.upstreamStatus = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

export async function getTcDialLead(leadId) {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Ungültige TC-Dial Lead-ID.');
    error.status = 400;
    throw error;
  }
  return tcDialFetch(`/api/public/v1/leads/${id}`);
}

export async function listTcDialWebhookChannels() {
  return tcDialFetch('/api/public/v1/channels');
}

export async function subscribeAgentSetDisposition(overrides = {}) {
  const config = getTcDialConfig();
  const hookUrl = trim(overrides.hookUrl || config.webhookUrl);
  if (!hookUrl) {
    const error = new Error('hookUrl fehlt (Body oder TCDIAL_WEBHOOK_URL).');
    error.status = 400;
    throw error;
  }

  const payload = {
    hookUrl,
    statusMustChange: overrides.statusMustChange ?? true,
    statusGroupMustChange: overrides.statusGroupMustChange ?? false,
  };

  const callStatusGroups = overrides.callStatusGroups ?? config.callStatusGroups;
  if (callStatusGroups?.length) payload.callStatusGroups = callStatusGroups;

  const callStatuses = overrides.callStatuses ?? config.callStatuses;
  if (callStatuses?.length) payload.callStatuses = callStatuses;

  const campaigns = overrides.campaigns ?? config.campaigns;
  if (campaigns?.length) payload.campaigns = campaigns;

  if (Array.isArray(overrides.agents) && overrides.agents.length) payload.agents = overrides.agents;
  if (Array.isArray(overrides.groups) && overrides.groups.length) payload.groups = overrides.groups;

  return tcDialFetch('/api/public/v1/channels/agent-set-disposition', {
    method: 'POST',
    body: payload,
  });
}

export async function unsubscribeAgentSetDisposition(hookUrl) {
  const url = trim(hookUrl || getTcDialConfig().webhookUrl);
  if (!url) {
    const error = new Error('hookUrl fehlt.');
    error.status = 400;
    throw error;
  }
  return tcDialFetch('/api/public/v1/channels/agent-set-disposition', {
    method: 'DELETE',
    body: { hookUrl: url },
  });
}
