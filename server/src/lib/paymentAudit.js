import { supabase, supabaseConfig } from './supabase.js';
import { tableMissing } from './leads.js';

export const AUDIT_EVENTS = [
  'checkout_created',
  'payment_paid',
  'payment_failed',
  'payment_synced',
  'return_invalid_token',
  'suspicious_activity',
];

// Keys that must never reach the audit log: card data, order passwords, certificates, tokens.
const SENSITIVE_KEY = /password|passwd|cvc|cvv|pan$|^pan|cardnumber|card_number|pem|cert|privatekey|private_key|secret|token|^key$/i;
// 13–19 digit runs look like a full card number; mask them if one slips into a string.
const PAN_LIKE = /\b\d{13,19}\b/g;

function sanitize(value, depth = 0) {
  if (value == null || depth > 4) return value ?? null;
  if (typeof value === 'string') return value.replace(PAN_LIKE, '[redacted]').slice(0, 500);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitize(entry, depth + 1));
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    out[key] = sanitize(entry, depth + 1);
  }
  return out;
}

export function sanitizeAuditMetadata(metadata) {
  const clean = sanitize(metadata || {});
  return clean && typeof clean === 'object' && !Array.isArray(clean) ? clean : {};
}

/** Express sets req.ip from X-Forwarded-For via `trust proxy`, so it is not client-spoofable. */
export function requestContext(req) {
  return {
    ip: req?.ip || req?.socket?.remoteAddress || null,
    userAgent: req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 512) : null,
  };
}

let warnedMissing = false;

/** Fire-and-forget audit write. Never throws: a logging problem must not break a payment. */
export async function logPaymentEvent(event, {
  userId = null,
  paymentId = null,
  req = null,
  ip,
  userAgent,
  metadata = {},
} = {}) {
  if (!AUDIT_EVENTS.includes(event)) {
    console.error(`payment_audit_log: unbekanntes Event "${event}".`);
    return;
  }
  if (!supabaseConfig.configured || !supabase) return;
  const context = requestContext(req);
  const row = {
    event,
    user_id: userId || null,
    payment_id: paymentId || null,
    ip: ip ?? context.ip,
    user_agent: userAgent ?? context.userAgent,
    metadata: sanitizeAuditMetadata(metadata),
  };
  try {
    const { error } = await supabase.from('payment_audit_log').insert(row);
    if (error) throw error;
  } catch (error) {
    if (tableMissing(error)) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.error('payment_audit_log fehlt. Bitte server/supabase/payment_audit_log.sql im Supabase SQL Editor ausführen.');
      }
      return;
    }
    console.error(`payment_audit_log (${event}) fehlgeschlagen:`, error.message);
  }
}
