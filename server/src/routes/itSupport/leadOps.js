import { supabase } from '../../lib/supabase.js';
import { getLeadById, withAssignee } from '../../lib/leads.js';
import { leadHasOpenComplaint } from '../../lib/complaints.js';
import { refreshRequestAfterRefund } from '../../lib/leadRequests.js';
import { removeHolderCalendarEvent, syncLeadCalendar } from '../../lib/energy.js';
import { fail } from './common.js';

export const SCHEDULE_CLEAR = {
  appointment_at: null,
  appointment_reminded_at: null,
  appointment_soon_reminded_at: null,
  follow_up_at: null,
  follow_up_reminded_at: null,
  follow_up_soon_reminded_at: null,
};

/** Lead as shown in the console: everything except the Berater's private notes. */
export function consoleLead(lead) {
  if (!lead) return lead;
  const { brokerNotes, ...rest } = lead;
  return { ...rest, hasBrokerNotes: Boolean(brokerNotes) };
}

export async function loadLead(id, t) {
  const row = await getLeadById(id);
  if (!row) throw fail(t('Lead wurde nicht gefunden.', 'Lead not found.'), 404);
  return row;
}

export function leadLabel(row) {
  const name = `${row?.first_name || ''} ${row?.last_name || ''}`.trim();
  return name || row?.email || row?.id || 'Lead';
}

function missingColumn(error) {
  const message = String(error?.message || '');
  const match = message.match(/'([a-z_]+)' column/i) || message.match(/column "?([a-z_]+)"? (?:of relation .* )?does not exist/i);
  return match ? match[1] : null;
}

/**
 * Direct row update for IT Support corrections. Columns from SQL scripts that were never run in this
 * project are dropped from the patch instead of failing the whole correction.
 */
export async function updateLeadRow(id, patch) {
  const next = { ...patch };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!Object.keys(next).length) return getLeadById(id);
    const { data, error } = await supabase.from('leads').update(next).eq('id', id).select('*').maybeSingle();
    if (!error) return data;
    const column = missingColumn(error);
    if (!column || !(column in next)) throw error;
    delete next[column];
  }
  throw fail('Lead could not be updated.', 500);
}

/** `what` is a [German, English] pair naming the blocked action. */
export async function assertNoOpenComplaint(leadId, t, what) {
  if (await leadHasOpenComplaint(leadId)) {
    throw fail(t(
      `Dieser Lead hat eine offene Reklamation. ${what[0]} ist erst möglich, wenn ein Admin die Reklamation entschieden hat.`,
      `This lead has an open complaint. ${what[1]} is only possible once an admin has decided the complaint.`,
    ), 409);
  }
}

export function afterLeadChange(previous, next) {
  if (previous?.request_id && previous.request_id !== next?.request_id) {
    refreshRequestAfterRefund(previous.request_id).catch((error) => {
      console.error('IT support: order progress could not be refreshed:', error.message);
    });
  }
  const holderId = previous?.energy_holder_id;
  const calendarError = (error) => console.error('IT support: calendar sync failed:', error.message);
  if (holderId && (!next || next.energy_holder_id !== holderId)) {
    // Lead left the partner (deleted or unassigned): remove the event from their Google Calendar.
    if (previous.google_event_id) removeHolderCalendarEvent(previous, holderId).catch(calendarError);
  } else if (next?.energy_holder_id) {
    syncLeadCalendar(previous, next).catch(calendarError);
  }
}

export async function publicLead(row) {
  return row ? consoleLead(await withAssignee(row)) : null;
}
