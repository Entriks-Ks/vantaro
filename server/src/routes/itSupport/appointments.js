import { Router } from 'express';
import { supabase } from '../../lib/supabase.js';
import { isUuid, updateLead, withAssignees } from '../../lib/leads.js';
import { notifyScheduleCancelled, notifyScheduleSaved, reminderJobState, tickFollowUpReminders } from '../../lib/followUpReminders.js';
import { logItAction } from '../../lib/itSupportAudit.js';
import { fail, optionalReason, requireDb, requireReason, route, searchTerm } from './common.js';
import { both, tr } from './i18n.js';
import { afterLeadChange, consoleLead, leadLabel, loadLead, updateLeadRow } from './leadOps.js';

const router = Router();

const TYPES = {
  termin: {
    label: ['Termin', 'Appointment'],
    at: 'appointment_at',
    hour: 'appointment_reminded_at',
    soon: 'appointment_soon_reminded_at',
    field: 'appointmentAt',
  },
  wiedervorlage: {
    label: ['Wiedervorlage', 'Follow-up'],
    at: 'follow_up_at',
    hour: 'follow_up_reminded_at',
    soon: 'follow_up_soon_reminded_at',
    field: 'followUpAt',
  },
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function typeOf(req) {
  const type = String(req.body?.type || '');
  if (!TYPES[type]) throw fail(tr(req)('Typ muss „termin“ oder „wiedervorlage“ sein.', 'Type must be "termin" or "wiedervorlage".'));
  return type;
}

function leadId(req) {
  if (!isUuid(req.params.leadId)) throw fail(tr(req)('Lead wurde nicht gefunden.', 'Lead not found.'), 404);
  return req.params.leadId;
}

function reminderState(entry, now) {
  const at = new Date(entry.at).getTime();
  if (!entry.assignedTo) return 'no_berater';
  if (entry.remindedAt) return 'sent';
  if (at < now - 15 * 60 * 1000) return 'missed';
  if (at - now <= HOUR) return 'due';
  return 'scheduled';
}

function entriesFor(lead, row, now) {
  const result = [];
  for (const [type, meta] of Object.entries(TYPES)) {
    const at = row[meta.at];
    if (!at) continue;
    const active = row.contact_status === type;
    const entry = {
      key: `${row.id}:${type}`,
      leadId: row.id,
      type,
      at,
      active,
      contactStatus: row.contact_status || null,
      leadName: lead.fullName || lead.email || 'Lead',
      leadPhone: lead.phone,
      leadCity: [lead.zip, lead.city].filter(Boolean).join(' '),
      vertical: lead.vertical,
      assignedTo: lead.assignedTo,
      assignedToName: lead.assignedToName,
      assignedToEmail: lead.assignedToEmail,
      remindedAt: row[meta.hour] || null,
      soonRemindedAt: row[meta.soon] || null,
      calendarSyncStatus: row.calendar_sync_status || null,
    };
    const time = new Date(at).getTime();
    entry.timing = time < now ? 'past' : (time - now < DAY ? 'soon' : 'upcoming');
    entry.reminder = active ? reminderState(entry, now) : 'inactive';
    // A date that no longer matches the conversation status is stale data.
    entry.stale = !active;
    result.push(entry);
  }
  return result;
}

router.get('/', route(async (req, res) => {
  requireDb(req);
  const type = String(req.query.type || 'all');
  const range = String(req.query.range || 'upcoming');
  const now = Date.now();

  let query = supabase.from('leads').select('*').order('updated_at', { ascending: false }).limit(1000);
  if (type === 'termin') query = query.not('appointment_at', 'is', null);
  else if (type === 'wiedervorlage') query = query.not('follow_up_at', 'is', null);
  else query = query.or('appointment_at.not.is.null,follow_up_at.not.is.null');
  if (isUuid(req.query.beraterId)) query = query.eq('assigned_to', req.query.beraterId);

  const q = searchTerm(req.query.q);
  if (q) {
    const pattern = `"%${q}%"`;
    query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},city.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  const leads = await withAssignees(rows);
  let entries = rows.flatMap((row, index) => entriesFor(leads[index], row, now));
  if (type === 'termin' || type === 'wiedervorlage') entries = entries.filter((entry) => entry.type === type);

  const today = new Date(now).toDateString();
  const counts = {
    today: entries.filter((entry) => entry.active && new Date(entry.at).toDateString() === today).length,
    upcoming: entries.filter((entry) => entry.active && new Date(entry.at).getTime() >= now).length,
    missed: entries.filter((entry) => entry.reminder === 'missed').length,
    stale: entries.filter((entry) => entry.stale).length,
    noBerater: entries.filter((entry) => entry.active && entry.reminder === 'no_berater').length,
  };

  if (range === 'today') entries = entries.filter((entry) => entry.active && new Date(entry.at).toDateString() === today);
  else if (range === 'upcoming') entries = entries.filter((entry) => entry.active && new Date(entry.at).getTime() >= now);
  else if (range === 'past') entries = entries.filter((entry) => entry.active && new Date(entry.at).getTime() < now);
  else if (range === 'missed') entries = entries.filter((entry) => entry.reminder === 'missed');
  else if (range === 'stale') entries = entries.filter((entry) => entry.stale);
  else if (range === 'no_berater') entries = entries.filter((entry) => entry.active && entry.reminder === 'no_berater');

  const ascending = range === 'upcoming' || range === 'today';
  entries.sort((a, b) => (ascending ? 1 : -1) * (new Date(a.at) - new Date(b.at)));
  res.json({ appointments: entries.slice(0, 300), total: entries.length, counts, job: reminderJobState() });
}));

router.patch('/:leadId', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const id = leadId(req);
  const type = typeOf(req);
  const meta = TYPES[type];
  const at = new Date(String(req.body?.at || ''));
  if (Number.isNaN(at.getTime())) throw fail(t('Bitte ein gültiges Datum mit Uhrzeit angeben.', 'Please enter a valid date and time.'));

  const current = await loadLead(id, t);
  const previousAt = current[meta.at] ? new Date(current[meta.at]).toISOString() : '';
  const updated = await updateLead(current.id, {
    contactStatus: type,
    [meta.field]: at.toISOString(),
  }, { bypassDeliveryLock: true });
  const notify = req.body?.notify === true && Boolean(updated.assignedTo);
  if (notify) {
    notifyScheduleSaved(updated, { previousAt }).catch((error) => {
      console.error('IT support: appointment notification failed:', error.message);
    });
  }
  await logItAction(req, {
    action: 'appointment.update',
    targetType: 'lead',
    targetId: current.id,
    targetLabel: leadLabel(current),
    reason: optionalReason(req),
    summary: both(
      `${meta.label[0]} ${previousAt ? 'verschoben' : 'gesetzt'}${notify ? ', Berater benachrichtigt' : ''}`,
      `${meta.label[1]} ${previousAt ? 'moved' : 'set'}${notify ? ', advisor notified' : ''}`,
    ),
    before: { contactStatus: current.contact_status ?? null, [meta.field]: current[meta.at] ?? null },
    after: { contactStatus: type, [meta.field]: at.toISOString() },
  });
  afterLeadChange(current, await loadLead(current.id, t));
  res.json({ lead: consoleLead(updated) });
}));

router.post('/:leadId/reset-reminders', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const id = leadId(req);
  const type = typeOf(req);
  const meta = TYPES[type];
  const current = await loadLead(id, t);
  if (!current[meta.at]) throw fail(t(`Dieser Lead hat keine ${meta.label[0]}.`, `This lead has no ${meta.label[1].toLowerCase()}.`));
  await updateLeadRow(current.id, { [meta.hour]: null, [meta.soon]: null });
  await logItAction(req, {
    action: 'appointment.reset_reminders',
    targetType: 'lead',
    targetId: current.id,
    targetLabel: leadLabel(current),
    reason: optionalReason(req),
    summary: both(
      `Erinnerungen für ${meta.label[0]} zurückgesetzt – werden beim nächsten Job-Lauf neu geprüft`,
      `Reminders for the ${meta.label[1].toLowerCase()} reset – re-checked on the next job run`,
    ),
    before: { remindedAt: current[meta.hour] ?? null, soonRemindedAt: current[meta.soon] ?? null },
    after: { remindedAt: null, soonRemindedAt: null },
  });
  res.json({ ok: true });
}));

router.post('/:leadId/cancel', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const id = leadId(req);
  const reason = requireReason(req);
  const type = typeOf(req);
  const meta = TYPES[type];
  const current = await loadLead(id, t);
  if (!current[meta.at]) throw fail(t(`Dieser Lead hat keine ${meta.label[0]}.`, `This lead has no ${meta.label[1].toLowerCase()}.`));

  const patch = { [meta.at]: null, [meta.hour]: null, [meta.soon]: null };
  if (current.contact_status === type) patch.contact_status = 'kontaktiert';
  const next = await updateLeadRow(current.id, patch);
  const notify = req.body?.notify === true && Boolean(current.assigned_to) && current.contact_status === type;
  if (notify) {
    const [lead] = await withAssignees([current]);
    notifyScheduleCancelled({ lead, eventType: type, at: new Date(current[meta.at]).toISOString() }).catch((error) => {
      console.error('IT support: cancellation notification failed:', error.message);
    });
  }
  await logItAction(req, {
    action: 'appointment.cancel',
    targetType: 'lead',
    targetId: current.id,
    targetLabel: leadLabel(current),
    reason,
    summary: both(
      `${meta.label[0]} entfernt${notify ? ', Berater benachrichtigt' : ''}`,
      `${meta.label[1]} removed${notify ? ', advisor notified' : ''}`,
    ),
    before: { contactStatus: current.contact_status ?? null, [meta.field]: current[meta.at] },
    after: { contactStatus: patch.contact_status ?? current.contact_status ?? null, [meta.field]: null },
  });
  afterLeadChange(current, next);
  res.json({ ok: true });
}));

router.post('/run-reminders', route(async (req, res) => {
  const result = await tickFollowUpReminders();
  await logItAction(req, {
    action: 'reminders.run',
    targetType: 'system',
    targetId: 'reminders',
    targetLabel: 'Reminder job',
    summary: result.busy
      ? both('Erinnerungs-Job manuell gestartet (lief bereits)', 'Reminder job started manually (was already running)')
      : both(
        `Erinnerungs-Job manuell gestartet: ${result.sent || 0} gesendet, ${result.skipped || 0} übersprungen${result.error ? `, Fehler: ${result.error}` : ''}`,
        `Reminder job started manually: ${result.sent || 0} sent, ${result.skipped || 0} skipped${result.error ? `, error: ${result.error}` : ''}`,
      ),
    after: result,
  });
  res.json({ result, job: reminderJobState() });
}));

export default router;
