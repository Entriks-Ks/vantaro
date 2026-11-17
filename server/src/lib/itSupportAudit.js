import { supabase, supabaseConfig } from './supabase.js';
import { requestContext, sanitizeAuditMetadata } from './paymentAudit.js';
import { tr } from '../routes/itSupport/i18n.js';

/**
 * Activity log of the IT Support console (public.it_support_audit_log).
 * Every change made through /api/it-support is recorded with who, when, what, why and before/after.
 * Summaries are stored in German (summary) and English (summary_en) so the console can show either.
 */

const READY_TTL_MS = 5 * 60 * 1000;
let readyCheckedAt = 0;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function auditTableMissingMessage(req) {
  return tr(req)(
    'Das Aktivitätsprotokoll fehlt. Bitte server/supabase/it_support.sql im Supabase SQL Editor ausführen. '
      + 'Bis dahin sind Änderungen über die IT-Support-Konsole gesperrt, damit jede Aktion nachvollziehbar bleibt.',
    'The activity log is missing. Please run server/supabase/it_support.sql in the Supabase SQL Editor. '
      + 'Until then, changes through the IT Support console are blocked so every action stays traceable.',
  );
}

export async function auditLogReady() {
  if (!supabaseConfig.configured || !supabase) return false;
  if (Date.now() - readyCheckedAt < READY_TTL_MS) return true;
  const { error } = await supabase.from('it_support_audit_log').select('id').limit(1);
  if (error) return false;
  readyCheckedAt = Date.now();
  return true;
}

/** Express middleware: refuse console changes while the audit table is unavailable. */
export async function requireAuditLog(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  try {
    if (await auditLogReady()) return next();
  } catch {
    // fall through
  }
  return res.status(503).json({ error: auditTableMissingMessage(req), code: 'audit_log_missing' });
}

function snapshot(value) {
  if (value == null) return null;
  // Berater notes are private to the Berater and never copied into the log.
  if (typeof value === 'object' && !Array.isArray(value)) {
    const { brokerNotes, broker_notes, ...rest } = value;
    return sanitizeAuditMetadata(rest);
  }
  return sanitizeAuditMetadata({ value });
}

function summaryParts(summary) {
  if (!summary) return { de: null, en: null };
  if (typeof summary === 'object') return { de: summary.de || summary.en || null, en: summary.en || summary.de || null };
  return { de: String(summary), en: null };
}

function rowFor(req, entry) {
  const context = requestContext(req);
  const summary = summaryParts(entry.summary);
  return {
    actor_id: req.user?.id || null,
    actor_email: req.user?.email || 'unknown',
    actor_role: req.user?.role || 'unknown',
    action: String(entry.action || 'unknown').slice(0, 80),
    target_type: String(entry.targetType || 'system').slice(0, 40),
    target_id: entry.targetId != null ? String(entry.targetId).slice(0, 120) : null,
    target_label: entry.targetLabel ? String(entry.targetLabel).slice(0, 200) : null,
    reason: entry.reason ? String(entry.reason).slice(0, 1000) : null,
    summary: summary.de ? summary.de.slice(0, 500) : null,
    summary_en: summary.en ? summary.en.slice(0, 500) : null,
    before: snapshot(entry.before),
    after: snapshot(entry.after),
    ip: context.ip,
    user_agent: context.userAgent,
  };
}

function summaryEnMissing(error) {
  return /summary_en/i.test(String(error?.message || ''));
}

/** Writes one or more log rows. Throws if the log cannot be written. */
export async function logItActions(req, entries) {
  const rows = (Array.isArray(entries) ? entries : [entries]).filter(Boolean).map((entry) => rowFor(req, entry));
  if (!rows.length) return;
  let { error } = await supabase.from('it_support_audit_log').insert(rows);
  if (error && summaryEnMissing(error)) {
    // it_support.sql from before the English console: keep logging, German summary only.
    ({ error } = await supabase.from('it_support_audit_log').insert(rows.map(({ summary_en, ...rest }) => rest)));
  }
  if (error) {
    readyCheckedAt = 0;
    console.error(`IT support activity log could not be written (${rows[0].action}):`, error.message);
    throw fail(tr(req)(
      'Die Aktion wurde ausgeführt, konnte aber nicht protokolliert werden. Bitte Systemfehler prüfen.',
      'The action was carried out but could not be logged. Please check "System errors".',
    ), 500);
  }
}

export async function logItAction(req, entry) {
  return logItActions(req, [entry]);
}

/** Only the fields that changed, for compact before/after entries. */
export function diffFields(before = {}, after = {}, keys = null) {
  const fields = keys || [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  const from = {};
  const to = {};
  for (const key of fields) {
    const a = before?.[key] ?? null;
    const b = after?.[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      from[key] = a;
      to[key] = b;
    }
  }
  return { before: from, after: to, changed: Object.keys(to) };
}

export function toPublicActivity(row) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    reason: row.reason,
    summary: row.summary,
    summaryEn: row.summary_en || null,
    before: row.before,
    after: row.after,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export async function listActivityFor(targetType, targetId, limit = 20) {
  if (!supabase || !targetId) return [];
  const { data, error } = await supabase
    .from('it_support_audit_log')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', String(targetId))
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map(toPublicActivity);
}
