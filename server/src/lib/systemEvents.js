import { supabase, supabaseConfig } from './supabase.js';
import { sanitizeAuditMetadata } from './paymentAudit.js';

/**
 * Persists server errors, warnings and integration events to public.system_events so IT Support can
 * see them in the console ("Systemfehler") without access to Render logs or Supabase.
 *
 * Writes are batched (every FLUSH_MS) and de-duplicated: an identical open event only gets its
 * occurrence counter and last_seen_at bumped. Logging never throws and never blocks a request.
 */

export const EVENT_LEVELS = ['error', 'warning', 'info'];
export const EVENT_SOURCES = ['server', 'auth', 'leads', 'payments', 'email', 'reminders', 'tcdial', 'calendar', 'database', 'it_support'];

const FLUSH_MS = 5_000;
const MAX_PENDING = 500;
const MISSING_RETRY_MS = 10 * 60 * 1000;
const PAN_LIKE = /\b\d{13,19}\b/g;
// Bearer tokens, JWTs and long hex secrets must not end up in the log.
const SECRET_LIKE = /(bearer\s+)[\w.-]+|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|\b[0-9a-f]{40,}\b/gi;

const pending = new Map();
let flushTimer = null;
let disabledUntil = 0;
let originalError = console.error.bind(console);
let originalWarn = console.warn.bind(console);
let capturing = false;

function clean(text, max = 600) {
  return String(text ?? '')
    .replace(PAN_LIKE, '[redacted]')
    .replace(SECRET_LIKE, (match, bearer) => (bearer ? `${bearer}[redacted]` : '[redacted]'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Best guess of the area a console message belongs to, from its prefix. */
export function inferSource(message) {
  const text = String(message || '');
  if (/tc-?dial/i.test(text)) return 'tcdial';
  if (/procredit|payment|zahlung|checkout|invoice|rechnung|refund|discount/i.test(text)) return 'payments';
  if (/resend|e-?mail|mailer|smtp/i.test(text)) return 'email';
  if (/reminder|schedule|wiedervorlage|follow.?up/i.test(text)) return 'reminders';
  if (/calendar|google/i.test(text)) return 'calendar';
  if (/auth|login|oauth|session|verify|password|customer.?number|role/i.test(text)) return 'auth';
  if (/lead|request|complaint|reklamation|partner/i.test(text)) return 'leads';
  if (/supabase|schema|relation|column|sql|database|postgres/i.test(text)) return 'database';
  return 'server';
}

function formatArgs(args) {
  return args
    .map((arg) => {
      if (arg instanceof Error) return arg.message || String(arg);
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function stackOf(args) {
  const error = args.find((arg) => arg instanceof Error);
  return error?.stack ? clean(error.stack.split('\n').slice(0, 6).join(' | '), 1200) : null;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushSystemEvents().catch(() => {});
  }, FLUSH_MS);
  flushTimer.unref?.();
}

/**
 * Readable text for a thrown value. Supabase answers count-only (HEAD) queries without a body, so a
 * failure there arrives as { message: '' } — say so instead of logging an empty message.
 */
export function describeError(error) {
  if (error == null) return 'Unknown error';
  if (typeof error === 'string') return error.trim() || 'Unknown error';
  const parts = [error.message, error.code ? `code ${error.code}` : '', error.details, error.hint]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(' – ');
  return 'Empty error from the database (Supabase sent no details – usually a short outage, restart or schema reload)';
}

/** Writes to the server log and to system_events with context, without being captured a second time. */
export function reportEvent({ level = 'error', source, message, context = {} }) {
  (level === 'error' ? originalError : originalWarn)(message, context);
  logSystemEvent({ level, source, message, context });
}

/** Queue an event. Never throws. */
export function logSystemEvent({ level = 'error', source, message, context = {} } = {}) {
  if (!supabaseConfig.configured || !supabase) return;
  if (Date.now() < disabledUntil) return;
  const text = clean(message);
  if (!text) return;
  const lvl = EVENT_LEVELS.includes(level) ? level : 'error';
  const src = EVENT_SOURCES.includes(source) ? source : inferSource(text);
  const key = `${lvl}|${src}|${text}`;
  const existing = pending.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = new Date().toISOString();
  } else {
    if (pending.size >= MAX_PENDING) return;
    pending.set(key, {
      level: lvl,
      source: src,
      message: text,
      context: sanitizeAuditMetadata(context),
      count: 1,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
  }
  scheduleFlush();
}

function tableMissing(error) {
  const message = String(error?.message || '');
  return error?.code === '42P01' || error?.code === 'PGRST205' || /system_events/i.test(message);
}

async function writeEvent(event) {
  const { data: open, error: findError } = await supabase
    .from('system_events')
    .select('id, occurrences')
    .eq('level', event.level)
    .eq('source', event.source)
    .eq('message', event.message)
    .is('resolved_at', null)
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;

  if (open) {
    const { error } = await supabase
      .from('system_events')
      .update({
        occurrences: (Number(open.occurrences) || 1) + event.count,
        last_seen_at: event.lastSeenAt,
        context: event.context,
      })
      .eq('id', open.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('system_events').insert({
    level: event.level,
    source: event.source,
    message: event.message,
    context: event.context,
    occurrences: event.count,
    first_seen_at: event.firstSeenAt,
    last_seen_at: event.lastSeenAt,
  });
  if (error) throw error;
}

export async function flushSystemEvents() {
  if (!pending.size || !supabase) return;
  const batch = [...pending.values()];
  pending.clear();
  for (const event of batch) {
    try {
      await writeEvent(event);
    } catch (error) {
      if (tableMissing(error)) {
        disabledUntil = Date.now() + MISSING_RETRY_MS;
        originalWarn('system_events fehlt. Bitte server/supabase/it_support.sql im Supabase SQL Editor ausführen.');
        return;
      }
      originalError('system_events konnte nicht geschrieben werden:', error.message);
    }
  }
}

/**
 * Mirrors console.error / console.warn into system_events, so every existing error log line in the
 * API (TC-Dial, ProCredit, Resend, reminder job, lead workflow, …) shows up in the console.
 */
export function installConsoleCapture() {
  if (capturing) return;
  capturing = true;
  originalError = console.error.bind(console);
  originalWarn = console.warn.bind(console);
  let inside = false;

  const wrap = (original, level) => (...args) => {
    original(...args);
    if (inside) return;
    inside = true;
    try {
      const message = formatArgs(args);
      const stack = stackOf(args);
      logSystemEvent({
        level,
        source: inferSource(message),
        message,
        context: stack ? { stack } : {},
      });
    } catch {
      // never let logging break the caller
    } finally {
      inside = false;
    }
  };

  console.error = wrap(originalError, 'error');
  console.warn = wrap(originalWarn, 'warning');
}
