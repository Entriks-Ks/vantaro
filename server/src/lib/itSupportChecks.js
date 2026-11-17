import { supabase } from './supabase.js';
import { tableMissing } from './leads.js';
import { describeError, reportEvent } from './systemEvents.js';

/**
 * Consistency checks for the IT Support console. Each check is a Supabase filter that finds broken or
 * contradictory records; `fix` (when present) is the safe, one-click correction.
 * Texts are [German, English] — the console shows the language it asked for.
 */

const MINUTE = 60 * 1000;
export const STALE_PAYMENT_MINUTES = 30;

export const LEAD_CHECKS = [
  {
    id: 'assigned_status_without_berater',
    severity: 'error',
    label: ['Status „Zugewiesen“, aber kein Berater', 'Status "Assigned" but no advisor'],
    help: [
      'Der Lead gilt als zugestellt, hat aber keinen Berater. Er taucht dadurch weder im Pool noch bei einem Berater auf.',
      'The lead counts as delivered but has no advisor, so it shows up neither in the pool nor with any advisor.',
    ],
    apply: (query) => query.eq('status', 'zugewiesen').is('assigned_to', null),
    fix: { patch: { status: 'neu' }, label: ['Status auf „Neu“ setzen (zurück in den Pool)', 'Set status to "New" (back to the pool)'] },
  },
  {
    id: 'berater_without_assigned_status',
    severity: 'warning',
    label: ['Berater gesetzt, aber Status nicht „Zugewiesen“', 'Advisor set but status is not "Assigned"'],
    help: [
      'Der Lead hat einen Berater, steht aber noch auf „Neu“ bzw. „Wieder verfügbar“ und könnte erneut vergeben werden.',
      'The lead has an advisor but is still "New" or "Available again" and could be handed out a second time.',
    ],
    apply: (query) => query.not('assigned_to', 'is', null).in('status', ['neu', 'in_bearbeitung']).is('refunded_at', null),
    fix: { patch: { status: 'zugewiesen' }, label: ['Status auf „Zugewiesen“ setzen', 'Set status to "Assigned"'] },
  },
  {
    id: 'request_without_berater',
    severity: 'warning',
    label: ['Mit Auftrag verknüpft, aber keinem Berater zugewiesen', 'Linked to an order but not assigned to an advisor'],
    help: [
      'Der Lead zählt für einen Auftrag, liegt aber bei keinem Berater. Das verfälscht den Auftragsstand.',
      'The lead counts towards an order but is not with any advisor, which distorts the order progress.',
    ],
    apply: (query) => query.not('request_id', 'is', null).is('assigned_to', null).is('refunded_at', null),
    fix: { patch: { request_id: null }, label: ['Auftragsverknüpfung entfernen', 'Remove the order link'] },
  },
  {
    id: 'termin_without_date',
    severity: 'warning',
    label: ['Gesprächsstatus „Termin“ ohne Datum', 'Conversation status "Appointment" without a date'],
    help: [
      'Ohne Datum erscheint der Termin in keinem Kalender und es wird keine Erinnerung verschickt.',
      'Without a date the appointment appears in no calendar and no reminder is sent.',
    ],
    apply: (query) => query.eq('contact_status', 'termin').is('appointment_at', null),
    fix: { patch: { contact_status: 'kontaktiert' }, label: ['Gesprächsstatus auf „Kontaktiert“ setzen', 'Set conversation status to "Contacted"'] },
  },
  {
    id: 'wiedervorlage_without_date',
    severity: 'warning',
    label: ['Gesprächsstatus „Wiedervorlage“ ohne Datum', 'Conversation status "Follow-up" without a date'],
    help: [
      'Ohne Datum erscheint die Wiedervorlage in keinem Kalender und es wird keine Erinnerung verschickt.',
      'Without a date the follow-up appears in no calendar and no reminder is sent.',
    ],
    apply: (query) => query.eq('contact_status', 'wiedervorlage').is('follow_up_at', null),
    fix: { patch: { contact_status: 'kontaktiert' }, label: ['Gesprächsstatus auf „Kontaktiert“ setzen', 'Set conversation status to "Contacted"'] },
  },
  {
    id: 'closed_without_outcome',
    severity: 'info',
    label: ['Abgeschlossen ohne Ergebnis', 'Closed without an outcome'],
    help: [
      'Der Berater hat „Abgeschlossen“ gesetzt, aber nicht angegeben, ob erfolgreich oder nicht. Bitte manuell im Lead korrigieren.',
      'The advisor set "Closed" but did not say whether it was successful. Please correct it manually in the lead.',
    ],
    apply: (query) => query.eq('contact_status', 'abgeschlossen').is('close_outcome', null),
    fix: null,
  },
  {
    id: 'appointment_reminder_missed',
    severity: 'warning',
    label: ['Termin-Erinnerung nicht versendet', 'Appointment reminder not sent'],
    help: [
      'Der Termin liegt in der Vergangenheit, die Erinnerungs-E-Mail an den Berater wurde aber nie versendet. Meist ein E-Mail- oder Job-Problem (siehe Integrationen).',
      'The appointment is in the past but the reminder email to the advisor was never sent. Usually an email or job problem (see Integrations).',
    ],
    apply: (query) => query
      .eq('contact_status', 'termin')
      .not('assigned_to', 'is', null)
      .is('appointment_reminded_at', null)
      .lt('appointment_at', new Date(Date.now() - 15 * MINUTE).toISOString())
      .gt('appointment_at', new Date(Date.now() - 7 * 24 * 60 * MINUTE).toISOString()),
    fix: null,
  },
  {
    id: 'follow_up_reminder_missed',
    severity: 'warning',
    label: ['Wiedervorlage-Erinnerung nicht versendet', 'Follow-up reminder not sent'],
    help: [
      'Die Wiedervorlage ist fällig, die Erinnerungs-E-Mail an den Berater wurde aber nie versendet.',
      'The follow-up is due but the reminder email to the advisor was never sent.',
    ],
    apply: (query) => query
      .eq('contact_status', 'wiedervorlage')
      .not('assigned_to', 'is', null)
      .is('follow_up_reminded_at', null)
      .lt('follow_up_at', new Date(Date.now() - 15 * MINUTE).toISOString())
      .gt('follow_up_at', new Date(Date.now() - 7 * 24 * 60 * MINUTE).toISOString()),
    fix: null,
  },
];

export const PAYMENT_CHECKS = [
  {
    id: 'paid_without_request',
    severity: 'error',
    label: ['Bezahlt, aber kein Lead-Auftrag angelegt', 'Paid but no lead order created'],
    help: [
      'Die Zahlung ist eingegangen, der dazugehörige Auftrag fehlt. Der Berater bekommt dadurch keine Leads.',
      'The payment came in but the matching order is missing, so the advisor receives no leads.',
    ],
    apply: (query) => query.eq('status', 'paid').is('request_id', null),
  },
  {
    id: 'pending_stale',
    severity: 'warning',
    label: [`Zahlung seit über ${STALE_PAYMENT_MINUTES} Minuten offen`, `Payment open for more than ${STALE_PAYMENT_MINUTES} minutes`],
    help: [
      'Der Checkout wurde gestartet, aber nie abgeschlossen (Bankseite geschlossen, Rückleitung fehlgeschlagen). Mit der Bank abgleichen oder als abgebrochen markieren.',
      'Checkout was started but never completed (bank page closed or the redirect back failed). Check with the bank or mark it as cancelled.',
    ],
    apply: (query) => query.eq('status', 'pending').lt('created_at', new Date(Date.now() - STALE_PAYMENT_MINUTES * MINUTE).toISOString()),
  },
  {
    id: 'failed_24h',
    severity: 'info',
    label: ['Fehlgeschlagene Zahlungen (24 h)', 'Failed payments (24 h)'],
    help: ['Abgelehnte oder abgebrochene Zahlungen der letzten 24 Stunden.', 'Declined or cancelled payments in the last 24 hours.'],
    apply: (query) => query.eq('status', 'failed').gt('created_at', new Date(Date.now() - 24 * 60 * MINUTE).toISOString()),
  },
];

/** Picks the text for the console language from a [German, English] pair. */
export function pick(pair, lang) {
  if (!Array.isArray(pair)) return pair;
  return lang === 'en' ? pair[1] : pair[0];
}

export function leadCheck(id) {
  return LEAD_CHECKS.find((check) => check.id === id) || null;
}

export function paymentCheck(id) {
  return PAYMENT_CHECKS.find((check) => check.id === id) || null;
}

async function countFor(table, check) {
  const { count, error, status } = await check.apply(
    supabase.from(table).select('id', { count: 'exact', head: true }),
  );
  if (error) {
    if (tableMissing(error) || /column/i.test(error.message || '')) return null;
    // One failed check must not take the whole overview down; it shows as "not checkable" instead.
    reportEvent({
      level: 'warning',
      source: 'it_support',
      message: `IT support data check "${check.id}" failed: ${describeError(error)}`,
      context: { table, check: check.id, httpStatus: status },
    });
    return null;
  }
  return count || 0;
}

function describe(check, count, area, lang) {
  return {
    id: check.id,
    area,
    severity: check.severity,
    label: pick(check.label, lang),
    help: pick(check.help, lang),
    count,
    fixLabel: check.fix ? pick(check.fix.label, lang) : null,
  };
}

/** Counts for every check (null = not checkable, e.g. migration missing). */
export async function runChecks(lang = 'de') {
  const [leads, payments] = await Promise.all([
    Promise.all(LEAD_CHECKS.map(async (check) => describe(check, await countFor('leads', check), 'leads', lang))),
    Promise.all(PAYMENT_CHECKS.map(async (check) => describe(check, await countFor('lead_payments', check), 'payments', lang))),
  ]);
  return [...leads, ...payments];
}

/** Which lead checks a single lead row fails. */
export async function leadProblems(leadId, lang = 'de') {
  const results = await Promise.all(LEAD_CHECKS.map(async (check) => {
    const { data, error } = await check.apply(supabase.from('leads').select('id').eq('id', leadId)).maybeSingle();
    if (error || !data) return null;
    return describe(check, 1, 'leads', lang);
  }));
  return results.filter(Boolean);
}
