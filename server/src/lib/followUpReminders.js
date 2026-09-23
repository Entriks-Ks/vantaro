import { supabase, supabaseConfig } from './supabase.js';
import { getClientOrigin } from './clientOrigin.js';
import { hasLeadsMailer, sendFollowUpReminderEmail, sendFollowUpScheduledEmail } from './mailer.js';
import { tableMissing } from './leads.js';
import { toDirectoryUser } from './users.js';

const INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 25;
export const SCHEDULE_HOUR_MS = 60 * 60 * 1000;
export const SCHEDULE_SOON_MS = 15 * 60 * 1000;
const MISSING_COLS = /follow_up_at|appointment_at|contact_status|follow_up_reminded_at|appointment_reminded_at|follow_up_soon_reminded_at|appointment_soon_reminded_at/i;

let running = false;
let timer = null;

function leadDisplayName(row) {
  return `${row?.first_name || ''} ${row?.last_name || ''}`.trim() || 'einem Lead';
}

function eventAtOf(lead, eventType) {
  if (eventType === 'termin') return lead.appointmentAt || lead.appointment_at || null;
  return lead.followUpAt || lead.follow_up_at || null;
}

function hourColumn(eventType) {
  return eventType === 'termin' ? 'appointment_reminded_at' : 'follow_up_reminded_at';
}

function soonColumn(eventType) {
  return eventType === 'termin' ? 'appointment_soon_reminded_at' : 'follow_up_soon_reminded_at';
}

function atColumn(eventType) {
  return eventType === 'termin' ? 'appointment_at' : 'follow_up_at';
}

function remindedColumn(eventType, stage) {
  return stage === 'soon' ? soonColumn(eventType) : hourColumn(eventType);
}

async function loadBerater(id) {
  if (!id || !supabase) return null;
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data?.user) return null;
  return toDirectoryUser(data.user);
}

async function markReminded(id, eventType, stage) {
  const column = remindedColumn(eventType, stage);
  const { data, error } = await supabase
    .from('leads')
    .update({ [column]: new Date().toISOString() })
    .eq('id', id)
    .is(column, null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function clearReminded(id, eventType, stage) {
  await supabase
    .from('leads')
    .update({ [remindedColumn(eventType, stage)]: null })
    .eq('id', id);
}

function scheduleMailPayload(lead, berater, eventType) {
  return {
    to: berater.email,
    beraterName: berater.fullName || '',
    leadName: lead.fullName || leadDisplayName(lead),
    followUpAt: eventAtOf(lead, eventType),
    phone: lead.phone || '',
    leadUrl: `${getClientOrigin()}/dashboard/leads/${lead.id}`,
    leadId: lead.id,
    eventType,
  };
}

function whenKindOf(remaining) {
  if (remaining <= 0) return 'due';
  if (remaining <= SCHEDULE_SOON_MS) return 'soon';
  return 'hour';
}

export async function notifyScheduleSaved(lead, { previousAt = '' } = {}) {
  if (!hasLeadsMailer()) return { sent: false, reason: 'mailer' };
  const eventType = lead?.contactStatus;
  if (eventType !== 'wiedervorlage' && eventType !== 'termin') {
    return { sent: false, reason: 'not-due' };
  }
  const at = eventAtOf(lead, eventType);
  if (!at || !lead.assignedTo) return { sent: false, reason: 'not-due' };

  const berater = await loadBerater(lead.assignedTo);
  if (!berater?.email) return { sent: false, reason: 'no-berater' };
  const typeOn = eventType === 'termin'
    ? berater.terminAlerts !== false
    : berater.wiedervorlageAlerts !== false;
  if (!typeOn) return { sent: false, reason: 'type-off' };
  const calendarOn = berater.googleCalendar !== false;
  const mailOn = berater.emailReminders !== false;
  if (!mailOn && !calendarOn) return { sent: false, reason: 'opt-out' };

  const remaining = new Date(at).getTime() - Date.now();
  const isUpdate = Boolean(previousAt);
  const payload = {
    ...scheduleMailPayload(lead, berater, eventType),
    includeCalendar: calendarOn,
    kind: isUpdate ? 'updated' : 'scheduled',
  };

  try {
    if (isUpdate || remaining > SCHEDULE_HOUR_MS || !mailOn) {
      await sendFollowUpScheduledEmail(payload);
      return { sent: true, kind: isUpdate ? 'updated' : (mailOn ? 'scheduled' : 'calendar') };
    }
    if (remaining > SCHEDULE_SOON_MS) {
      await sendFollowUpReminderEmail({ ...payload, whenKind: 'hour' });
      await markReminded(lead.id, eventType, 'hour');
      return { sent: true, kind: 'hour' };
    }
    await sendFollowUpReminderEmail({ ...payload, whenKind: whenKindOf(remaining) });
    await markReminded(lead.id, eventType, 'soon');
    return { sent: true, kind: remaining <= 0 ? 'due' : 'soon' };
  } catch (error) {
    console.error(`${eventType} notify failed:`, error.message);
    return { sent: false, reason: error.message };
  }
}

export async function notifyScheduleCancelled({ lead, eventType, at }) {
  if (!hasLeadsMailer()) return { sent: false, reason: 'mailer' };
  if (eventType !== 'wiedervorlage' && eventType !== 'termin') {
    return { sent: false, reason: 'not-due' };
  }
  if (!at || !lead?.assignedTo) return { sent: false, reason: 'not-due' };

  const berater = await loadBerater(lead.assignedTo);
  if (!berater?.email) return { sent: false, reason: 'no-berater' };
  const typeOn = eventType === 'termin'
    ? berater.terminAlerts !== false
    : berater.wiedervorlageAlerts !== false;
  if (!typeOn) return { sent: false, reason: 'type-off' };
  if (berater.googleCalendar === false) return { sent: false, reason: 'calendar-off' };

  try {
    await sendFollowUpScheduledEmail({
      ...scheduleMailPayload({ ...lead, appointmentAt: at, followUpAt: at }, berater, eventType),
      followUpAt: at,
      eventType,
      includeCalendar: true,
      kind: 'cancelled',
    });
    return { sent: true, kind: 'cancelled' };
  } catch (error) {
    console.error(`${eventType} cancel failed:`, error.message);
    return { sent: false, reason: error.message };
  }
}

export async function notifyFollowUpSaved(lead) {
  return notifyScheduleSaved(lead);
}

async function processStage(eventType, stage) {
  const atCol = atColumn(eventType);
  const now = Date.now();
  let query = supabase
    .from('leads')
    .select('*')
    .eq('contact_status', eventType)
    .not('assigned_to', 'is', null)
    .not(atCol, 'is', null)
    .is(remindedColumn(eventType, stage), null)
    .is('refunded_at', null);

  if (stage === 'hour') {
    query = query
      .lte(atCol, new Date(now + SCHEDULE_HOUR_MS).toISOString())
      .gt(atCol, new Date(now + SCHEDULE_SOON_MS).toISOString());
  } else {
    query = query.lte(atCol, new Date(now + SCHEDULE_SOON_MS).toISOString());
  }

  const { data, error } = await query
    .order(atCol, { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    if (tableMissing(error) || MISSING_COLS.test(error.message || '')) {
      return { sent: 0, skipped: 0 };
    }
    throw error;
  }

  const origin = getClientOrigin();
  let sent = 0;
  let skipped = 0;

  for (const row of data || []) {
    const berater = await loadBerater(row.assigned_to);
    if (!berater?.email) {
      skipped += 1;
      continue;
    }
    if (berater.emailReminders === false) {
      await markReminded(row.id, eventType, stage);
      skipped += 1;
      continue;
    }
    const typeOn = eventType === 'termin'
      ? berater.terminAlerts !== false
      : berater.wiedervorlageAlerts !== false;
    if (!typeOn) {
      await markReminded(row.id, eventType, stage);
      skipped += 1;
      continue;
    }

    const claimed = await markReminded(row.id, eventType, stage);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const at = eventAtOf(row, eventType);
    const remaining = new Date(at).getTime() - Date.now();
    const whenKind = stage === 'hour' ? 'hour' : whenKindOf(remaining);

    try {
      await sendFollowUpReminderEmail({
        to: berater.email,
        beraterName: berater.fullName || '',
        leadName: leadDisplayName(row),
        followUpAt: at,
        phone: row.phone || '',
        leadUrl: `${origin}/dashboard/leads/${row.id}`,
        leadId: row.id,
        eventType,
        whenKind,
        includeCalendar: berater.googleCalendar !== false,
      });
      sent += 1;
    } catch (sendError) {
      console.error(`${eventType} ${stage} reminder failed:`, sendError.message);
      await clearReminded(row.id, eventType, stage).catch(() => {});
      skipped += 1;
    }
  }

  return { sent, skipped };
}

export async function processDueFollowUps() {
  if (!supabaseConfig.configured || !supabase) return { sent: 0, skipped: 0 };
  if (!hasLeadsMailer()) return { sent: 0, skipped: 0 };

  const results = await Promise.all([
    processStage('wiedervorlage', 'hour'),
    processStage('wiedervorlage', 'soon'),
    processStage('termin', 'hour'),
    processStage('termin', 'soon'),
  ]);

  return results.reduce(
    (sum, part) => ({ sent: sum.sent + part.sent, skipped: sum.skipped + part.skipped }),
    { sent: 0, skipped: 0 },
  );
}

export async function tickFollowUpReminders() {
  if (running) return { sent: 0, skipped: 0, busy: true };
  running = true;
  try {
    return await processDueFollowUps();
  } catch (error) {
    console.error('Schedule reminder job failed:', error.message);
    return { sent: 0, skipped: 0, error: error.message };
  } finally {
    running = false;
  }
}

export function startFollowUpReminderJob() {
  if (timer) return;
  const kick = () => {
    tickFollowUpReminders().catch((error) => {
      console.error('Schedule reminder tick failed:', error.message);
    });
  };
  timer = setInterval(kick, INTERVAL_MS);
  timer.unref?.();
  setTimeout(kick, 15_000).unref?.();
}
