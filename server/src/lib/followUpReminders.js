import { supabase, supabaseConfig } from './supabase.js';
import { getClientOrigin } from './clientOrigin.js';
import { hasLeadsMailer, sendFollowUpReminderEmail, sendFollowUpScheduledEmail } from './mailer.js';
import { tableMissing } from './leads.js';
import { toDirectoryUser } from './users.js';

const INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 25;
let running = false;
let timer = null;

function leadDisplayName(row) {
  return `${row?.first_name || ''} ${row?.last_name || ''}`.trim() || 'einem Lead';
}

async function loadBerater(id) {
  if (!id || !supabase) return null;
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data?.user) return null;
  return toDirectoryUser(data.user);
}

async function markReminded(id) {
  const { data, error } = await supabase
    .from('leads')
    .update({ follow_up_reminded_at: new Date().toISOString() })
    .eq('id', id)
    .is('follow_up_reminded_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function clearReminded(id) {
  await supabase
    .from('leads')
    .update({ follow_up_reminded_at: null })
    .eq('id', id);
}

function followUpMailPayload(lead, berater) {
  return {
    to: berater.email,
    beraterName: berater.fullName || '',
    leadName: lead.fullName || leadDisplayName(lead),
    followUpAt: lead.followUpAt || lead.follow_up_at,
    phone: lead.phone || '',
    leadUrl: `${getClientOrigin()}/dashboard/leads/${lead.id}`,
    leadId: lead.id,
  };
}

export async function notifyFollowUpSaved(lead) {
  if (!hasLeadsMailer()) return { sent: false, reason: 'mailer' };
  if (lead?.contactStatus !== 'wiedervorlage' || !lead.followUpAt || !lead.assignedTo) {
    return { sent: false, reason: 'not-due' };
  }

  const berater = await loadBerater(lead.assignedTo);
  if (!berater?.email) return { sent: false, reason: 'no-berater' };

  const payload = followUpMailPayload(lead, berater);
  const due = new Date(lead.followUpAt).getTime() <= Date.now();

  try {
    if (due) {
      await sendFollowUpReminderEmail(payload);
      await markReminded(lead.id);
    } else {
      await sendFollowUpScheduledEmail(payload);
    }
    return { sent: true, kind: due ? 'due' : 'scheduled' };
  } catch (error) {
    console.error('Wiedervorlage notify failed:', error.message);
    return { sent: false, reason: error.message };
  }
}

export async function processDueFollowUps() {
  if (!supabaseConfig.configured || !supabase) return { sent: 0, skipped: 0 };
  if (!hasLeadsMailer()) return { sent: 0, skipped: 0 };

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('contact_status', 'wiedervorlage')
    .not('assigned_to', 'is', null)
    .not('follow_up_at', 'is', null)
    .is('follow_up_reminded_at', null)
    .is('refunded_at', null)
    .lte('follow_up_at', new Date().toISOString())
    .order('follow_up_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    if (tableMissing(error) || /follow_up_at|contact_status|follow_up_reminded_at/i.test(error.message || '')) {
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

    const claimed = await markReminded(row.id);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    try {
      await sendFollowUpReminderEmail({
        to: berater.email,
        beraterName: berater.fullName || '',
        leadName: leadDisplayName(row),
        followUpAt: row.follow_up_at,
        phone: row.phone || '',
        leadUrl: `${origin}/dashboard/leads/${row.id}`,
        leadId: row.id,
      });
      sent += 1;
    } catch (sendError) {
      console.error('Wiedervorlage reminder failed:', sendError.message);
      await clearReminded(row.id).catch(() => {});
      skipped += 1;
    }
  }

  return { sent, skipped };
}

export async function tickFollowUpReminders() {
  if (running) return { sent: 0, skipped: 0, busy: true };
  running = true;
  try {
    return await processDueFollowUps();
  } catch (error) {
    console.error('Wiedervorlage reminder job failed:', error.message);
    return { sent: 0, skipped: 0, error: error.message };
  } finally {
    running = false;
  }
}

export function startFollowUpReminderJob() {
  if (timer) return;
  const kick = () => {
    tickFollowUpReminders().catch((error) => {
      console.error('Wiedervorlage reminder tick failed:', error.message);
    });
  };
  timer = setInterval(kick, INTERVAL_MS);
  timer.unref?.();
  setTimeout(kick, 15_000).unref?.();
}
