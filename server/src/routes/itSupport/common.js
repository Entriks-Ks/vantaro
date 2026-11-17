import { tableMissing } from '../../lib/leads.js';
import { supabase, supabaseConfig } from '../../lib/supabase.js';
import { langOf, tr, translateMessage } from './i18n.js';

export function fail(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

export function requireDb(req) {
  if (!supabaseConfig.configured || !supabase) {
    throw fail(tr(req)('Supabase ist nicht konfiguriert.', 'Supabase is not configured.'), 503);
  }
}

/** Destructive or overriding actions must say why; the reason goes into the activity log. */
export function requireReason(req, min = 5) {
  const reason = String(req.body?.reason ?? '').trim();
  if (reason.length < min) {
    throw fail(tr(req)(
      `Bitte eine Begründung angeben (mindestens ${min} Zeichen). Sie wird im Aktivitätsprotokoll gespeichert.`,
      `Please enter a reason (at least ${min} characters). It is stored in the activity log.`,
    ));
  }
  return reason.slice(0, 1000);
}

export function optionalReason(req) {
  const reason = String(req.body?.reason ?? '').trim();
  return reason ? reason.slice(0, 1000) : null;
}

export function pageParams(req, { def = 25, max = 200 } = {}) {
  const limit = Math.min(max, Math.max(1, Number.parseInt(req.query.limit, 10) || def));
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  return { limit, page, from: (page - 1) * limit, to: page * limit - 1 };
}

export function searchTerm(value) {
  return String(value || '').trim().replace(/[%_,()"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function sendError(req, res, error) {
  const t = tr(req);
  if (error?.status) {
    return res.status(error.status).json({
      error: translateMessage(error.message, langOf(req)),
      code: error.code || undefined,
    });
  }
  if (tableMissing(error)) {
    return res.status(503).json({
      error: t(
        'Eine benötigte Tabelle fehlt in Supabase. Unter „Integrationen → Datenbank-Schema“ sehen Sie, welches SQL-Skript fehlt.',
        'A required table is missing in Supabase. "Integrations → Database schema" shows which SQL script is missing.',
      ),
      code: 'schema_missing',
    });
  }
  if (/column .* does not exist|could not find the .* column/i.test(String(error?.message || ''))) {
    return res.status(503).json({
      error: t(
        `Eine Spalte fehlt in Supabase (${error.message}). Unter „Integrationen → Datenbank-Schema“ sehen Sie, welches SQL-Skript fehlt.`,
        `A column is missing in Supabase (${error.message}). "Integrations → Database schema" shows which SQL script is missing.`,
      ),
      code: 'schema_missing',
    });
  }
  console.error('IT support API error:', error?.message || error);
  return res.status(500).json({
    error: t('Etwas ist schiefgelaufen. Details stehen unter „Systemfehler“.', 'Something went wrong. Details are under "System errors".'),
  });
}

/** Wraps an async handler and turns thrown errors into JSON responses. */
export const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(req, res, error);
  }
};
