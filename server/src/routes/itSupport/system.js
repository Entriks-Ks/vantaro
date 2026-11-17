import { Router } from 'express';
import { supabase } from '../../lib/supabase.js';
import { isUuid } from '../../lib/leads.js';
import { EVENT_LEVELS, EVENT_SOURCES, flushSystemEvents } from '../../lib/systemEvents.js';
import { logItAction, toPublicActivity } from '../../lib/itSupportAudit.js';
import { fail, optionalReason, pageParams, requireDb, route, searchTerm } from './common.js';
import { both, tr } from './i18n.js';

const router = Router();

function toPublicEvent(row) {
  return {
    id: row.id,
    level: row.level,
    source: row.source,
    message: row.message,
    context: row.context || {},
    occurrences: row.occurrences || 1,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,
  };
}

function eventsTableMissing(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || /system_events/i.test(error?.message || '');
}

const MISSING_RESPONSE = {
  events: [],
  total: 0,
  counts: { open: 0, error: 0, warning: 0, info: 0 },
  missingTable: true,
};

function applyEventFilters(query, req) {
  const level = String(req.query.level || '');
  if (level === 'problems') query = query.in('level', ['error', 'warning']);
  else if (EVENT_LEVELS.includes(level)) query = query.eq('level', level);
  const source = String(req.query.source || '');
  if (EVENT_SOURCES.includes(source)) query = query.eq('source', source);
  const q = searchTerm(req.query.q);
  if (q) query = query.ilike('message', `%${q}%`);
  return query;
}

function eventLabel(row) {
  return `${row.source}: ${row.message}`.slice(0, 200);
}

router.get('/errors', route(async (req, res) => {
  requireDb(req);
  await flushSystemEvents();
  const { limit, page, from, to } = pageParams(req, { def: 30, max: 100 });
  const state = String(req.query.state || 'open');
  let query = applyEventFilters(
    supabase.from('system_events').select('*', { count: 'exact' }).order('last_seen_at', { ascending: false }),
    req,
  );
  if (state === 'open') query = query.is('resolved_at', null);
  else if (state === 'resolved') query = query.not('resolved_at', 'is', null);
  const { data, count, error } = await query.range(from, to);
  if (error) {
    if (eventsTableMissing(error)) return res.json(MISSING_RESPONSE);
    throw error;
  }

  const counts = { open: 0, error: 0, warning: 0, info: 0, bySource: {} };
  const { data: openRows } = await supabase.from('system_events').select('level, source').is('resolved_at', null).limit(5000);
  for (const row of openRows || []) {
    counts.open += 1;
    counts[row.level] = (counts[row.level] || 0) + 1;
    if (row.level !== 'info') counts.bySource[row.source] = (counts.bySource[row.source] || 0) + 1;
  }
  res.json({ events: (data || []).map(toPublicEvent), total: count || 0, page, limit, counts });
}));

router.post('/errors/:id/resolve', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  if (!isUuid(req.params.id)) throw fail(t('Eintrag wurde nicht gefunden.', 'Entry not found.'), 404);
  const note = optionalReason(req);
  const { data, error } = await supabase
    .from('system_events')
    .update({ resolved_at: new Date().toISOString(), resolved_by: req.user.id, resolution_note: note })
    .eq('id', req.params.id)
    .is('resolved_at', null)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw fail(t('Eintrag wurde nicht gefunden oder ist bereits erledigt.', 'Entry not found or already resolved.'), 404);
  await logItAction(req, {
    action: 'system_event.resolve',
    targetType: 'system_event',
    targetId: data.id,
    targetLabel: eventLabel(data),
    reason: note,
    summary: both(
      `Systemmeldung als erledigt markiert (${data.occurrences}× aufgetreten)`,
      `System message marked as resolved (occurred ${data.occurrences}×)`,
    ),
  });
  res.json({ event: toPublicEvent(data) });
}));

router.post('/errors/:id/reopen', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  if (!isUuid(req.params.id)) throw fail(t('Eintrag wurde nicht gefunden.', 'Entry not found.'), 404);
  const { data, error } = await supabase
    .from('system_events')
    .update({ resolved_at: null, resolved_by: null, resolution_note: null })
    .eq('id', req.params.id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw fail(t('Eintrag wurde nicht gefunden.', 'Entry not found.'), 404);
  await logItAction(req, {
    action: 'system_event.reopen',
    targetType: 'system_event',
    targetId: data.id,
    targetLabel: eventLabel(data),
    summary: both('Systemmeldung wieder geöffnet', 'System message reopened'),
  });
  res.json({ event: toPublicEvent(data) });
}));

router.post('/errors/resolve-all', route(async (req, res) => {
  requireDb(req);
  const note = optionalReason(req);
  let query = supabase.from('system_events')
    .update({ resolved_at: new Date().toISOString(), resolved_by: req.user.id, resolution_note: note })
    .is('resolved_at', null);
  const level = String(req.body?.level || '');
  if (EVENT_LEVELS.includes(level)) query = query.eq('level', level);
  const source = String(req.body?.source || '');
  if (EVENT_SOURCES.includes(source)) query = query.eq('source', source);
  const { data, error } = await query.select('id');
  if (error) throw error;
  const count = (data || []).length;
  if (count) {
    await logItAction(req, {
      action: 'system_event.resolve_all',
      targetType: 'system_event',
      targetId: null,
      targetLabel: [source || 'all sources', level || 'all levels'].join(' · '),
      reason: note,
      summary: both(
        `${count} offene Systemmeldung(en) als erledigt markiert`,
        `${count} open system message(s) marked as resolved`,
      ),
    });
  }
  res.json({ resolved: count });
}));

function activityQuery(req, { withEnglish }) {
  let query = supabase.from('it_support_audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (isUuid(req.query.actorId)) query = query.eq('actor_id', req.query.actorId);
  const targetType = String(req.query.targetType || '');
  if (targetType) query = query.eq('target_type', targetType);
  if (req.query.targetId) query = query.eq('target_id', String(req.query.targetId).slice(0, 120));
  const action = String(req.query.action || '').replace(/[^a-z_.]/g, '');
  if (action) query = query.like('action', `${action}%`);
  const since = new Date(String(req.query.since || ''));
  if (!Number.isNaN(since.getTime())) query = query.gte('created_at', since.toISOString());
  const q = searchTerm(req.query.q);
  if (q) {
    const pattern = `"%${q}%"`;
    const columns = ['summary', ...(withEnglish ? ['summary_en'] : []), 'target_label', 'reason', 'actor_email'];
    query = query.or(columns.map((column) => `${column}.ilike.${pattern}`).join(','));
  }
  return query;
}

router.get('/activity', route(async (req, res) => {
  requireDb(req);
  const { limit, page, from, to } = pageParams(req, { def: 50, max: 200 });
  let { data, count, error } = await activityQuery(req, { withEnglish: true }).range(from, to);
  if (error && /summary_en/i.test(error.message || '')) {
    ({ data, count, error } = await activityQuery(req, { withEnglish: false }).range(from, to));
  }
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205' || /it_support_audit_log/i.test(error.message || '')) {
      return res.json({ activity: [], total: 0, missingTable: true });
    }
    throw error;
  }

  const { data: actorRows } = await supabase.from('it_support_audit_log').select('actor_id, actor_email').limit(1000);
  const actors = [...new Map((actorRows || []).filter((row) => row.actor_id).map((row) => [row.actor_id, row.actor_email])).entries()]
    .map(([id, email]) => ({ id, email }));

  res.json({ activity: (data || []).map(toPublicActivity), total: count || 0, page, limit, actors });
}));

export default router;
