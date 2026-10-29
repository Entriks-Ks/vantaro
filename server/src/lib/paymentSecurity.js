import { supabase, supabaseConfig } from './supabase.js';
import { adminEmails } from './roles.js';
import { hasCustomMailer, sendPaymentSecurityAlertEmail } from './mailer.js';
import { logPaymentEvent, requestContext } from './paymentAudit.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** More than FAILED_PAYMENT_LIMIT failures within FAILED_PAYMENT_WINDOW → locked for FAILED_PAYMENT_LOCK. */
export const FAILED_PAYMENT_LIMIT = 5;
export const FAILED_PAYMENT_WINDOW = HOUR;
export const FAILED_PAYMENT_LOCK = HOUR;

// Failures we caused ourselves (bank unreachable, discount race) do not count against the customer.
const INTERNAL_FAILURES = ['create_order_failed', 'discount_reserve_failed'];

function fail(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function sendTooMany(res, retryAfterSec, message) {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterSec))));
  return res.status(429).json({ error: message });
}

/**
 * In-memory fixed-window limiter (per API instance). `key(req)` picks the bucket,
 * e.g. the user id for authenticated routes or the IP for the bank return.
 */
export function createRateLimiter({ name, windowMs, max, key }) {
  const buckets = new Map();

  function prune(now) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  const middleware = (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 5000) prune(now);
    const bucketKey = String(key(req) || 'anonymous');
    let bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs, flagged: false };
      buckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    if (bucket.count <= max) return next();

    if (!bucket.flagged) {
      bucket.flagged = true;
      logPaymentEvent('suspicious_activity', {
        userId: req.user?.id || null,
        req,
        metadata: { reason: 'rate_limit', route: name, limit: max, windowSec: windowMs / 1000 },
      });
    }
    return sendTooMany(res, (bucket.resetAt - now) / 1000, 'Zu viele Anfragen. Bitte warten Sie einen Moment.');
  };
  middleware.reset = () => buckets.clear();
  return middleware;
}

export const checkoutRateLimit = createRateLimiter({
  name: 'checkout',
  windowMs: 15 * MINUTE,
  max: 10,
  key: (req) => req.user?.id || requestContext(req).ip,
});

export const returnRateLimit = createRateLimiter({
  name: 'return',
  windowMs: 15 * MINUTE,
  max: 30,
  key: (req) => requestContext(req).ip,
});

export const syncRateLimit = createRateLimiter({
  name: 'sync',
  windowMs: 15 * MINUTE,
  max: 30,
  key: (req) => req.user?.id || requestContext(req).ip,
});

/**
 * Pure: given failure times (ms, any order), when does the lock end?
 * Lock starts at the failure that makes it more than `limit` within `windowMs`.
 */
export function failureLockUntil(times, {
  limit = FAILED_PAYMENT_LIMIT,
  windowMs = FAILED_PAYMENT_WINDOW,
  lockMs = FAILED_PAYMENT_LOCK,
} = {}) {
  const sorted = [...times].filter(Number.isFinite).sort((a, b) => a - b);
  let until = 0;
  for (let i = limit; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - limit] <= windowMs) until = Math.max(until, sorted[i] + lockMs);
  }
  return until;
}

/** Customer-side payment failures from lead_payments (durable across restarts and instances). */
async function recentFailureTimes(userId, now) {
  if (!supabaseConfig.configured || !supabase || !userId) return [];
  const since = new Date(now - FAILED_PAYMENT_WINDOW - FAILED_PAYMENT_LOCK).toISOString();
  const { data, error } = await supabase
    .from('lead_payments')
    .select('created_at, pg_status')
    .eq('berater_id', userId)
    .eq('status', 'failed')
    .gte('created_at', since);
  if (error) {
    console.error('Fehlversuche konnten nicht gelesen werden:', error.message);
    return [];
  }
  return (data || [])
    .filter((row) => !INTERNAL_FAILURES.includes(row.pg_status))
    .map((row) => new Date(row.created_at).getTime());
}

// userId → lock end we already alerted about, so admins get one email per lock.
const alerted = new Map();

async function alertAdmins({ userId, failures, lockedUntil, ip }) {
  const recipients = adminEmails();
  if (!hasCustomMailer() || !recipients.length) {
    console.warn('Sicherheitswarnung nicht per E-Mail gesendet (RESEND_API_KEY/EMAIL_FROM/ADMIN_EMAILS fehlt).');
    return;
  }
  try {
    await sendPaymentSecurityAlertEmail({
      to: recipients,
      reason: `Mehr als ${FAILED_PAYMENT_LIMIT} fehlgeschlagene Zahlungen innerhalb einer Stunde. Zahlungen für diesen Nutzer sind bis ${new Date(lockedUntil).toISOString()} gesperrt.`,
      details: [
        ['Nutzer-ID', userId],
        ['Fehlversuche (letzte 2 h)', failures],
        ['IP', ip],
      ],
    });
  } catch (error) {
    console.error('Sicherheitswarnung an Admins fehlgeschlagen:', error.message);
  }
}

/** Returns { locked, retryAfterSec }; logs suspicious_activity and emails admins once per lock. */
export async function evaluateFailedPaymentLock(userId, { req = null, ip = null, now = Date.now() } = {}) {
  const times = await recentFailureTimes(userId, now);
  const lockedUntil = failureLockUntil(times);
  if (lockedUntil <= now) return { locked: false, retryAfterSec: 0 };

  if (alerted.get(userId) !== lockedUntil) {
    alerted.set(userId, lockedUntil);
    const context = requestContext(req);
    await logPaymentEvent('suspicious_activity', {
      userId,
      req,
      ip: ip ?? context.ip,
      metadata: {
        reason: 'failed_payments',
        failures: times.length,
        limit: FAILED_PAYMENT_LIMIT,
        lockedUntil: new Date(lockedUntil).toISOString(),
      },
    });
    await alertAdmins({ userId, failures: times.length, lockedUntil, ip: ip ?? context.ip });
  }
  return { locked: true, retryAfterSec: Math.ceil((lockedUntil - now) / 1000) };
}

/** Throws 429 while the user is locked after too many failed payments. */
export async function assertPaymentsAllowed(userId, { req = null } = {}) {
  const { locked, retryAfterSec } = await evaluateFailedPaymentLock(userId, { req });
  if (locked) {
    throw fail(
      'Zu viele fehlgeschlagene Zahlungen. Bitte versuchen Sie es in einer Stunde erneut oder kontaktieren Sie den Support.',
      429,
      { retryAfterSec },
    );
  }
}

export function resetPaymentSecurityState() {
  alerted.clear();
  checkoutRateLimit.reset();
  returnRateLimit.reset();
  syncRateLimit.reset();
}
