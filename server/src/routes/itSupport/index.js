import { Router } from 'express';
import { requireAuth, requireRole } from '../../lib/auth.js';
import { ROLES } from '../../lib/roles.js';
import { supabase } from '../../lib/supabase.js';
import { auditLogReady, requireAuditLog, toPublicActivity } from '../../lib/itSupportAudit.js';
import { runChecks } from '../../lib/itSupportChecks.js';
import { flushSystemEvents } from '../../lib/systemEvents.js';
import { requireDb, route } from './common.js';
import { langOf } from './i18n.js';
import leadsRouter from './leads.js';
import appointmentsRouter from './appointments.js';
import usersRouter from './users.js';
import paymentsRouter from './payments.js';
import integrationsRouter, { checkSchema, listIntegrations } from './integrations.js';
import systemRouter from './system.js';

/**
 * IT Support console API. Open to the IT Support role and to admins.
 * Every change goes through requireAuditLog + logItAction, so it is traceable in the activity log.
 * Business settings (discounts, prices, complaint decisions, roles) are intentionally not exposed here.
 */
const router = Router();

router.use(requireAuth, requireRole(ROLES.IT_SUPPORT, ROLES.ADMIN), requireAuditLog);

router.get('/overview', route(async (req, res) => {
  requireDb(req);
  const lang = langOf(req);
  await flushSystemEvents();
  const count = (query) => query.then(({ count: value, error }) => (error ? null : value || 0), () => null);
  const now = new Date().toISOString();
  const [checks, integrations, schema, totals, errors, activity, auditReady] = await Promise.all([
    runChecks(lang),
    listIntegrations(lang),
    checkSchema(lang),
    Promise.all([
      count(supabase.from('leads').select('id', { count: 'exact', head: true })),
      count(supabase.from('leads').select('id', { count: 'exact', head: true }).is('assigned_to', null).is('refunded_at', null)),
      count(supabase.from('lead_payments').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      count(supabase.from('leads').select('id', { count: 'exact', head: true })
        .or(`and(contact_status.eq.termin,appointment_at.gte."${now}"),and(contact_status.eq.wiedervorlage,follow_up_at.gte."${now}")`)),
    ]),
    supabase.from('system_events').select('id, level, source, message, occurrences, last_seen_at')
      .is('resolved_at', null).in('level', ['error', 'warning']).order('last_seen_at', { ascending: false }).limit(200)
      .then(({ data, error }) => (error ? null : data || [])),
    supabase.from('it_support_audit_log').select('*').order('created_at', { ascending: false }).limit(8)
      .then(({ data, error }) => (error ? null : (data || []).map(toPublicActivity))),
    auditLogReady(),
  ]);

  const [leadTotal, poolLeads, pendingPayments, upcomingAppointments] = totals;
  res.json({
    checks,
    integrations: integrations.map(({ id, name, purpose, status, summary }) => ({ id, name, purpose, status, summary })),
    schema,
    totals: { leadTotal, poolLeads, pendingPayments, upcomingAppointments },
    errors: errors
      ? {
        open: errors.length,
        errors: errors.filter((row) => row.level === 'error').length,
        warnings: errors.filter((row) => row.level === 'warning').length,
        recent: errors.slice(0, 6).map((row) => ({
          id: row.id,
          level: row.level,
          source: row.source,
          message: row.message,
          occurrences: row.occurrences,
          lastSeenAt: row.last_seen_at,
        })),
      }
      : null,
    activity,
    auditReady,
  });
}));

router.use('/leads', leadsRouter);
router.use('/appointments', appointmentsRouter);
router.use('/users', usersRouter);
router.use('/payments', paymentsRouter);
router.use('/integrations', integrationsRouter);
router.use('/system', systemRouter);

export default router;
