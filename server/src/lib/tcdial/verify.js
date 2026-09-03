import { createPublicKey, verify as cryptoVerify, timingSafeEqual } from 'node:crypto';
import { getTcDialConfig } from './config.js';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const MAX_SKEW_SECONDS = 300;
const processedWebhookIds = new Map();
const PROCESSED_TTL_MS = 24 * 60 * 60 * 1000;

function trim(value) {
  return String(value || '').trim();
}

function headerValue(headers, name) {
  const lower = name.toLowerCase();
  const raw = headers?.[name] ?? headers?.[lower] ?? headers?.[name.toUpperCase()];
  if (Array.isArray(raw)) return trim(raw[0]);
  return trim(raw);
}

function pruneProcessed() {
  const cutoff = Date.now() - PROCESSED_TTL_MS;
  for (const [id, seenAt] of processedWebhookIds) {
    if (seenAt < cutoff) processedWebhookIds.delete(id);
  }
}

export function rememberWebhookId(webhookId) {
  if (!webhookId) return false;
  pruneProcessed();
  if (processedWebhookIds.has(webhookId)) return false;
  processedWebhookIds.set(webhookId, Date.now());
  return true;
}

export function wasWebhookProcessed(webhookId) {
  if (!webhookId) return false;
  pruneProcessed();
  return processedWebhookIds.has(webhookId);
}

function decodePublicKey(prefixed) {
  const value = trim(prefixed);
  if (!value.startsWith('whpk_')) {
    throw Object.assign(new Error('TC-Dial Webhook-Public-Key muss mit whpk_ beginnen.'), { status: 500 });
  }
  const raw = Buffer.from(value.slice(5), 'base64');
  if (raw.length !== 32) {
    throw Object.assign(new Error('TC-Dial Webhook-Public-Key ist ungültig.'), { status: 500 });
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

function parseSignatures(header) {
  return trim(header)
    .split(/\s+/)
    .map((part) => trim(part))
    .filter(Boolean)
    .map((part) => {
      const comma = part.indexOf(',');
      if (comma <= 0) return null;
      const version = part.slice(0, comma);
      const encoded = part.slice(comma + 1);
      if (!encoded) return null;
      return { version, signature: Buffer.from(encoded, 'base64') };
    })
    .filter(Boolean);
}

/**
 * Verifies Standard Webhooks Ed25519 signatures from TC-Dial.
 * Message: `{webhook-id}.{webhook-timestamp}.{raw_json_body}`
 */
export function verifyTcDialWebhook({ headers, rawBody }) {
  const config = getTcDialConfig();
  const webhookId = headerValue(headers, 'webhook-id');
  const webhookTimestamp = headerValue(headers, 'webhook-timestamp');
  const webhookSignature = headerValue(headers, 'webhook-signature');

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    const error = new Error('Webhook-Signatur-Header fehlen.');
    error.status = 401;
    throw error;
  }

  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) {
    const error = new Error('Webhook-Timestamp ist ungültig.');
    error.status = 401;
    throw error;
  }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > MAX_SKEW_SECONDS) {
    const error = new Error('Webhook-Timestamp außerhalb der erlaubten Toleranz.');
    error.status = 401;
    throw error;
  }

  if (config.skipVerify) {
    return { webhookId, webhookTimestamp: ts, skipped: true };
  }

  if (!config.webhookPublicKey) {
    const error = new Error('TCDIAL_WEBHOOK_PUBLIC_KEY fehlt in der Server-Konfiguration.');
    error.status = 503;
    throw error;
  }

  const payload = Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : String(rawBody || '');
  const message = Buffer.from(`${webhookId}.${webhookTimestamp}.${payload}`, 'utf8');
  const publicKey = decodePublicKey(config.webhookPublicKey);
  const signatures = parseSignatures(webhookSignature);
  const ed25519 = signatures.filter((entry) => entry.version === 'v1a' || entry.version === 'v1');

  if (!ed25519.length) {
    const error = new Error('Keine gültige Webhook-Signatur gefunden.');
    error.status = 401;
    throw error;
  }

  const ok = ed25519.some((entry) => {
    try {
      if (entry.signature.length !== 64) return false;
      return cryptoVerify(null, message, publicKey, entry.signature);
    } catch {
      return false;
    }
  });

  if (!ok) {
    const error = new Error('Webhook-Signatur ist ungültig.');
    error.status = 401;
    throw error;
  }

  return { webhookId, webhookTimestamp: ts, skipped: false };
}

/** Timing-safe compare for optional shared secrets (unused by TC-Dial, kept for tests). */
export function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
