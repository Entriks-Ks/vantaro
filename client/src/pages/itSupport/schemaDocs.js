/**
 * Database page: the live table map comes from the server (public.it_support_relations()).
 * This file adds what the database cannot know: what each table is for in VANTARO, in plain words.
 */
import {
  BadgePercent,
  CalendarSync,
  CircleAlert,
  ClipboardList,
  CreditCard,
  FileWarning,
  ListChecks,
  MessageSquareWarning,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Table2,
  UserRound,
} from 'lucide-react';
import {
  ACTION,
  COMPLAINT_STATUS,
  CONTACT_STATUS,
  EVENT_LEVEL,
  EVENT_SOURCE,
  formatDateTime,
  formatEuro,
  label,
  LEAD_SOURCE,
  LEAD_STATUS,
  PAYMENT_EVENT,
  PAYMENT_STATUS,
  REQUEST_STATUS,
  ROLE,
  SCOPE,
  TARGET_TYPE,
  VERTICAL,
} from './format';
import { L, pick } from './i18n';

export const AUTH_USERS = 'auth.users';

/** name/about: [German, English]. show: columns for list views, in order. */
export const TABLE_DOCS = {
  [AUTH_USERS]: {
    name: ['Logins (Nutzerkonten)', 'Logins (user accounts)'],
    about: [
      'Jedes Konto (Berater, Partner, Admin, IT-Support) ist ein Login in auth.users, verwaltet von Supabase Auth. Name, Telefon, Firma, Bereich und Partnerrolle stehen in user_metadata, die Rolle in app_metadata. Fast alle VANTARO-Tabellen verweisen mit einer Nutzer-ID hierher. Ändern nur über die Seite „Nutzer“ oder Supabase → Authentication, nie per SQL.',
      'Every account (Berater, partner, admin, IT Support) is a login in auth.users, managed by Supabase Auth. Name, phone, company, area and partner role are in user_metadata, the role is in app_metadata. Almost every VANTARO table points here with a user id. Change it only on the Users page or in Supabase → Authentication, never with SQL.',
    ],
    show: ['email', 'role', 'last_sign_in_at', 'created_at'],
  },
  leads: {
    name: ['Leads', 'Leads'],
    about: [
      'Ein Interessent (Versicherung oder Energie). assigned_to ist der Berater/die Firma, der der Lead gehört; request_id der Auftrag, über den er geliefert wurde; energy_holder_id der Partner, der ihn bei Energie gerade bearbeitet. contact_status ist die Pipeline (neu → kontaktiert → termin/wiedervorlage → abgeschlossen). broker_notes sind privat und werden hier nicht angezeigt.',
      'A prospect (insurance or energy). assigned_to is the Berater/company that owns the lead; request_id is the order it was delivered through; energy_holder_id is the partner currently working it (energy). contact_status is the pipeline (neu → kontaktiert → termin/wiedervorlage → abgeschlossen). broker_notes are private and not shown here.',
    ],
    show: ['first_name', 'last_name', 'status', 'contact_status', 'vertical', 'created_at'],
  },
  lead_requests: {
    name: ['Lead-Aufträge', 'Lead orders'],
    about: [
      'Ein Auftrag eines Beraters über eine Anzahl Leads (code z. B. „A-1234“). Leads, Zahlungen und Reklamationen verweisen mit request_id darauf. Wird der Berater gelöscht, werden seine Aufträge mitgelöscht.',
      'An order by a Berater for a number of leads (code e.g. "A-1234"). Leads, payments and complaints point at it with request_id. If the Berater is deleted, their orders are deleted too.',
    ],
    show: ['code', 'status', 'requested_count', 'lead_type', 'scope', 'created_at'],
  },
  lead_payments: {
    name: ['Zahlungen (Lead-Pakete)', 'Payments (lead packages)'],
    about: [
      'Eine Paket-Zahlung über ProCredit (Kartenzahlung). invoice_number ist die Rechnungsnummer. Kartennummern werden nie gespeichert; das Bestell-Passwort ist verschlüsselt und wird hier ausgeblendet. Rechnungen sind aufbewahrungspflichtig: nicht löschen.',
      'A package payment through ProCredit (card). invoice_number is the invoice number. Card numbers are never stored; the order password is encrypted and hidden here. Invoices must be kept by law: do not delete.',
    ],
    show: ['invoice_number', 'status', 'package_label', 'gross_cents', 'paid_at', 'created_at'],
  },
  lead_complaints: {
    name: ['Reklamationen', 'Complaints'],
    about: [
      'Eine Reklamation eines Beraters zu einem Lead (z. B. falsche Nummer). Admins entscheiden; bei Erstattung wird der Lead als refunded markiert und ggf. ein Ersatz-Lead (replacement_lead_id) geliefert.',
      'A complaint by a Berater about a lead (e.g. wrong number). Admins decide; on a refund the lead is marked refunded and a replacement lead (replacement_lead_id) may be delivered.',
    ],
    show: ['reason', 'status', 'lead_id', 'created_at'],
  },
  berater_discounts: {
    name: ['Rabatte', 'Discounts'],
    about: [
      'Rabatt für einen Berater: dauerhaft (standing) bis zum Widerruf oder einmalig (one_time), der beim nächsten bezahlten Paket verbraucht wird. reserved/consumed_payment_id zeigen auf die Zahlung.',
      'A discount for a Berater: standing (until revoked) or one-time, used up by the next paid package. reserved/consumed_payment_id point at the payment.',
    ],
    show: ['kind', 'code', 'value_type', 'value', 'status', 'created_at'],
  },
  payment_audit_log: {
    name: ['Zahlungs-Protokoll', 'Payment audit log'],
    about: [
      'Sicherheitsprotokoll für Zahlungen (ProCredit-Vorgabe): Checkout erstellt, bezahlt, fehlgeschlagen, ungültige Rücksprung-Links. Wird nach 12 Monaten gelöscht. Nie manuell ändern.',
      'Security log for payments (ProCredit requirement): checkout created, paid, failed, invalid return links. Deleted after 12 months. Never change it by hand.',
    ],
    show: ['event', 'payment_id', 'ip', 'created_at'],
  },
  energy_calendar_connections: {
    name: ['Kalender-Verbindungen', 'Calendar connections'],
    about: [
      'Google-Kalender-Verbindung eines Energie-Partners (eine Zeile pro Nutzer). Termine von Leads werden darüber synchronisiert. Die Tokens werden hier ausgeblendet.',
      'Google Calendar connection of an energy partner (one row per user). Lead appointments are synced through it. The tokens are hidden here.',
    ],
    show: ['sync_status', 'calendar_id', 'last_synced_at', 'sync_error'],
  },
  energy_billing_profiles: {
    name: ['Energie-Abrechnungsprofile (alt)', 'Energy billing profiles (old)'],
    about: [
      'Alte Energie-Abrechnung pro Firma. Wird von unify_leads.sql entfernt; Energie läuft jetzt über Lead-Pakete.',
      'Old per-company energy billing. Removed by unify_leads.sql; energy now goes through lead packages.',
    ],
  },
  energy_delivery_lines: {
    name: ['Energie-Lieferzeilen (alt)', 'Energy delivery lines (old)'],
    about: [
      'Alte Abrechnungszeile pro gelieferten Energie-Lead. Wird von unify_leads.sql entfernt.',
      'Old billing line per delivered energy lead. Removed by unify_leads.sql.',
    ],
  },
  energy_complaints: {
    name: ['Energie-Reklamationen (alt)', 'Energy complaints (old)'],
    about: [
      'Alte Energie-Reklamationen. unify_leads.sql verschiebt sie nach lead_complaints und entfernt die Tabelle.',
      'Old energy complaints. unify_leads.sql moves them into lead_complaints and drops the table.',
    ],
  },
  it_support_audit_log: {
    name: ['Aktivitätsprotokoll (IT-Support)', 'Activity log (IT Support)'],
    about: [
      'Jede Änderung aus der IT-Support-Konsole: wer, was, wann, warum, vorher/nachher. Nur anhängen, nie ändern oder löschen. target_id ist Text ohne Fremdschlüssel, damit der Verlauf bleibt, auch wenn das Ziel gelöscht wird.',
      'Every change made in the IT Support console: who, what, when, why, before/after. Append-only, never change or delete. target_id is text without a foreign key, so history stays when the target is deleted.',
    ],
    show: ['actor_email', 'action', 'target_type', 'target_label', 'created_at'],
  },
  system_events: {
    name: ['Systemfehler & Ereignisse', 'System errors & events'],
    about: [
      'Serverfehler, Warnungen und Integrations-Ereignisse (TC-Dial, E-Mail, Erinnerungs-Job). Gleiche Fehler werden zusammengefasst (occurrences). Wird unter „Systemfehler“ angezeigt und dort erledigt.',
      'Server errors, warnings and integration events (TC-Dial, email, reminder job). Repeats are merged (occurrences). Shown and resolved under "System errors".',
    ],
    show: ['level', 'source', 'message', 'occurrences', 'last_seen_at'],
  },
};

/** What delete-time triggers do, keyed by function name. VANTARO has none today; unknown ones fall back to a generic text. */
export const TRIGGER_DOCS = {};

/** Plain-words meaning of each ON DELETE rule, seen from the parent row. */
export const RULE_TEXT = {
  CASCADE: ['Wird mitgelöscht.', 'Deleted as well.'],
  'SET NULL': ['Bleibt, die Verknüpfung wird geleert (NULL).', 'Kept; the link is cleared (NULL).'],
  'SET DEFAULT': ['Bleibt, die Verknüpfung wird auf den Standardwert gesetzt.', 'Kept; the link is reset to its default.'],
  RESTRICT: ['Blockiert das Löschen, solange solche Zeilen existieren.', 'Blocks the delete while such rows exist.'],
  'NO ACTION': ['Blockiert das Löschen, solange solche Zeilen existieren.', 'Blocks the delete while such rows exist.'],
};

/** Same rule, seen from the child row pointing at its parent. */
export const PARENT_RULE_TEXT = {
  CASCADE: ['Wird der Eintrag dort gelöscht, wird diese Zeile mitgelöscht.', 'If that row is deleted, this row is deleted too.'],
  'SET NULL': ['Wird der Eintrag dort gelöscht, wird dieses Feld geleert.', 'If that row is deleted, this field is cleared.'],
  'SET DEFAULT': ['Wird der Eintrag dort gelöscht, wird dieses Feld auf den Standard gesetzt.', 'If that row is deleted, this field is reset to its default.'],
  RESTRICT: ['Der Eintrag dort kann nicht gelöscht werden, solange diese Zeile existiert.', 'That row cannot be deleted while this row exists.'],
  'NO ACTION': ['Der Eintrag dort kann nicht gelöscht werden, solange diese Zeile existiert.', 'That row cannot be deleted while this row exists.'],
};

export const cleanTable = (table) => String(table || '').replace(/^public\./, '');

export function tableLabel(table) {
  const doc = TABLE_DOCS[cleanTable(table)];
  return doc ? L(doc.name[0], doc.name[1]) : cleanTable(table);
}

export function tableAbout(table, comment) {
  const doc = TABLE_DOCS[cleanTable(table)];
  if (doc) return L(doc.about[0], doc.about[1]);
  return comment || L('Keine Beschreibung hinterlegt.', 'No description yet.');
}

/** auth.users is not a public table, so the map has no metadata for it; this stands in. */
export const AUTH_USERS_META = {
  table: AUTH_USERS,
  comment: null,
  estimated_rows: null,
  rls: true,
  primary_key: ['id'],
  columns: [
    ['id', 'uuid'], ['email', 'text'], ['phone', 'text'], ['role', 'text (app_metadata.role / ADMIN_EMAILS / IT_SUPPORT_EMAILS)'],
    ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'], ['last_sign_in_at', 'timestamptz'],
    ['email_confirmed_at', 'timestamptz'], ['banned_until', 'timestamptz'], ['app_metadata', 'jsonb'], ['user_metadata', 'jsonb'],
  ].map(([name, type]) => ({ name, type, nullable: name !== 'id' })),
};

export function tableMeta(rel, table) {
  const name = cleanTable(table);
  if (name === AUTH_USERS) return AUTH_USERS_META;
  return rel?.tables.find((entry) => entry.table === name) || null;
}

/** Columns to show in list views: documented ones that exist, else the first few. */
export function listColumns(meta, table) {
  const doc = TABLE_DOCS[cleanTable(table)]?.show;
  const columns = meta?.columns.map((column) => column.name) || [];
  if (doc) return doc.filter((column) => !columns.length || columns.includes(column));
  return columns.filter((column) => column !== 'id').slice(0, 5);
}

export const outgoingKeys = (rel, table) => (rel?.foreign_keys || []).filter((fk) => cleanTable(fk.table) === cleanTable(table));
export const incomingKeys = (rel, table) => (rel?.foreign_keys || []).filter((fk) => cleanTable(fk.ref_table) === cleanTable(table));
export const deleteTriggersOf = (rel, table) => (rel?.delete_triggers || []).filter((trigger) => cleanTable(trigger.table) === cleanTable(table));
export const checksOf = (rel, table) => (rel?.checks || []).filter((check) => cleanTable(check.table) === cleanTable(table));

/** What a DELETE on `table` sets off, following CASCADE chains (tables only). */
export function deleteTree(rel, table, seen = new Set([cleanTable(table)])) {
  return incomingKeys(rel, table).map((fk) => {
    const child = cleanTable(fk.table);
    const node = { table: child, via: fk.columns.join(', '), rule: fk.on_delete, children: [] };
    if (fk.on_delete === 'CASCADE' && !seen.has(child)) {
      node.children = deleteTree(rel, child, new Set(seen).add(child));
    }
    return node;
  });
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function supabaseDashboardUrl(projectRef, path = 'sql/new') {
  return projectRef ? `https://supabase.com/dashboard/project/${projectRef}/${path}` : 'https://supabase.com/dashboard';
}

/** Short readable cell text for tables and fields. */
export function cellText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(cellText).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/* ---------- presentation: groups, icons, short summaries, links to console pages ---------- */

export const GROUPS = [
  { id: 'people', label: ['Konten', 'Accounts'], hint: ['Wer sich anmeldet', 'Who signs in'] },
  { id: 'leads', label: ['Leads & Aufträge', 'Leads & orders'], hint: ['Was Berater bestellen und bearbeiten', 'What Berater order and work on'] },
  { id: 'money', label: ['Zahlungen & Rabatte', 'Payments & discounts'], hint: ['Geld und Preise', 'Money and prices'] },
  { id: 'system', label: ['Technik & Protokolle', 'Technical & logs'], hint: ['Fehler, Verlauf, Verbindungen', 'Errors, history, connections'] },
  { id: 'old', label: ['Alt (wird entfernt)', 'Old (being removed)'], hint: ['Nur noch vor unify_leads.sql vorhanden', 'Only there before unify_leads.sql'] },
  { id: 'other', label: ['Weitere Tabellen', 'Other tables'], hint: ['Noch ohne Beschreibung', 'No description yet'] },
];

const UI = {
  [AUTH_USERS]: { group: 'people', icon: UserRound, tone: 'accent', summary: ['Alle Konten: Berater, Partner, Admins, IT-Support.', 'All accounts: Berater, partners, admins, IT Support.'], page: (row) => `/it-support/users?id=${row.id}` },
  leads: { group: 'leads', icon: ListChecks, tone: 'accent', summary: ['Interessenten, die an Berater geliefert werden.', 'Prospects delivered to Berater.'], page: (row) => `/it-support/leads?id=${row.id}` },
  lead_requests: { group: 'leads', icon: ClipboardList, summary: ['Bestellungen von Leads durch Berater.', 'Lead orders placed by Berater.'] },
  lead_complaints: { group: 'leads', icon: MessageSquareWarning, summary: ['Reklamationen zu gelieferten Leads.', 'Complaints about delivered leads.'] },
  lead_payments: { group: 'money', icon: CreditCard, tone: 'accent', summary: ['Kartenzahlungen für Lead-Pakete (ProCredit).', 'Card payments for lead packages (ProCredit).'], page: (row) => `/it-support/payments?id=${row.id}` },
  berater_discounts: { group: 'money', icon: BadgePercent, summary: ['Rabatte für einzelne Berater.', 'Discounts for single Berater.'] },
  payment_audit_log: { group: 'money', icon: ShieldCheck, summary: ['Sicherheitsprotokoll jeder Zahlung.', 'Security log of every payment.'] },
  energy_calendar_connections: { group: 'system', icon: CalendarSync, summary: ['Google-Kalender von Energie-Partnern.', 'Google Calendar of energy partners.'] },
  it_support_audit_log: { group: 'system', icon: ScrollText, summary: ['Jede Änderung aus dieser Konsole.', 'Every change made in this console.'] },
  system_events: { group: 'system', icon: CircleAlert, summary: ['Serverfehler und Warnungen.', 'Server errors and warnings.'], page: () => '/it-support/errors' },
  energy_billing_profiles: { group: 'old', icon: ReceiptText, summary: ['Alte Energie-Abrechnung.', 'Old energy billing.'] },
  energy_delivery_lines: { group: 'old', icon: ReceiptText, summary: ['Alte Energie-Lieferzeilen.', 'Old energy delivery lines.'] },
  energy_complaints: { group: 'old', icon: FileWarning, summary: ['Alte Energie-Reklamationen.', 'Old energy complaints.'] },
};

export function tableUi(table) {
  const entry = UI[cleanTable(table)];
  return {
    group: entry?.group || 'other',
    icon: entry?.icon || Table2,
    tone: entry?.tone || 'neutral',
    summary: entry ? pick(entry.summary) : null,
    page: entry?.page || null,
  };
}

/** Position in the curated list, so the main table of each group comes first. */
export function tableOrder(table) {
  const index = Object.keys(UI).indexOf(cleanTable(table));
  return index === -1 ? 999 : index;
}

/** Link to the normal console page for a row, when there is one. */
export function rowPage(table, row) {
  const page = UI[cleanTable(table)]?.page;
  return page && row ? page(row) : null;
}

/* ---------- friendly column names and values ---------- */

const COLUMN_LABELS = {
  id: ['ID', 'ID'],
  email: ['E-Mail', 'Email'],
  phone: ['Telefon', 'Phone'],
  role: ['Rolle', 'Role'],
  first_name: ['Vorname', 'First name'],
  last_name: ['Nachname', 'Last name'],
  status: ['Status', 'Status'],
  contact_status: ['Kontaktstatus', 'Contact status'],
  vertical: ['Bereich', 'Area'],
  scope: ['Gebiet', 'Area covered'],
  code: ['Code', 'Code'],
  requested_count: ['Anzahl Leads', 'Leads ordered'],
  lead_type: ['Lead-Typ', 'Lead type'],
  invoice_number: ['Rechnung', 'Invoice'],
  package_label: ['Paket', 'Package'],
  gross_cents: ['Betrag (brutto)', 'Amount (gross)'],
  net_cents: ['Betrag (netto)', 'Amount (net)'],
  paid_at: ['Bezahlt am', 'Paid at'],
  created_at: ['Erstellt', 'Created'],
  updated_at: ['Geändert', 'Updated'],
  last_sign_in_at: ['Letzter Login', 'Last sign-in'],
  reason: ['Grund', 'Reason'],
  lead_id: ['Lead', 'Lead'],
  payment_id: ['Zahlung', 'Payment'],
  kind: ['Art', 'Kind'],
  value_type: ['Wert-Typ', 'Value type'],
  value: ['Wert', 'Value'],
  event: ['Ereignis', 'Event'],
  ip: ['IP', 'IP'],
  sync_status: ['Sync-Status', 'Sync status'],
  calendar_id: ['Kalender', 'Calendar'],
  last_synced_at: ['Zuletzt synchronisiert', 'Last synced'],
  sync_error: ['Sync-Fehler', 'Sync error'],
  actor_email: ['Von', 'By'],
  action: ['Aktion', 'Action'],
  target_type: ['Ziel', 'Target'],
  target_label: ['Betrifft', 'Concerns'],
  level: ['Stufe', 'Level'],
  source: ['Quelle', 'Source'],
  message: ['Meldung', 'Message'],
  occurrences: ['Anzahl', 'Count'],
  last_seen_at: ['Zuletzt', 'Last seen'],
  assigned_to: ['Zugewiesen an', 'Assigned to'],
  created_by: ['Erstellt von', 'Created by'],
  berater_id: ['Berater', 'Berater'],
  energy_holder_id: ['Bearbeitet von (Partner)', 'Worked by (partner)'],
  request_id: ['Auftrag', 'Order'],
  user_id: ['Nutzer', 'User'],
  reviewed_by: ['Geprüft von', 'Reviewed by'],
  revoked_by: ['Widerrufen von', 'Revoked by'],
  actor_id: ['Ausgeführt von', 'Done by'],
  resolved_by: ['Erledigt von', 'Resolved by'],
  target_id: ['Ziel-ID', 'Target ID'],
  company_id: ['Firma', 'Company'],
  opened_by: ['Eröffnet von', 'Opened by'],
  decided_by: ['Entschieden von', 'Decided by'],
};

export function columnLabel(column) {
  const entry = COLUMN_LABELS[column];
  return entry ? pick(entry) : column;
}

const DISCOUNT_STATUS = { active: ['Aktiv', 'Active'], reserved: ['Reserviert', 'Reserved'], consumed: ['Verbraucht', 'Used'], revoked: ['Widerrufen', 'Revoked'] };
const SYNC_STATUS = { connected: ['Verbunden', 'Connected'], error: ['Fehler', 'Error'], pending: ['Ausstehend', 'Pending'], disconnected: ['Getrennt', 'Disconnected'] };

const VALUE_MAPS = {
  'leads.status': LEAD_STATUS,
  'leads.contact_status': CONTACT_STATUS,
  'leads.source': LEAD_SOURCE,
  'lead_requests.status': REQUEST_STATUS,
  'lead_payments.status': PAYMENT_STATUS,
  'lead_complaints.status': COMPLAINT_STATUS,
  'berater_discounts.status': DISCOUNT_STATUS,
  'payment_audit_log.event': PAYMENT_EVENT,
  'energy_calendar_connections.sync_status': SYNC_STATUS,
  'it_support_audit_log.action': ACTION,
  'it_support_audit_log.target_type': TARGET_TYPE,
  'system_events.level': EVENT_LEVEL,
  'system_events.source': EVENT_SOURCE,
  '*.vertical': VERTICAL,
  '*.scope': SCOPE,
  '*.role': ROLE,
};

const OK = /^(paid|active|completed|approved|connected|erledigt|abgeschlossen|consumed)$/;
const BAD = /^(failed|error|declined|rejected|suspicious_activity|return_invalid_token|revoked|cancelled)$/;
const WARN = /^(warning|partial|info_needed|pending|reserved|wiedervorlage|termin)$/;
const INFO = /^(neu|new|zugewiesen|kontaktiert|info|refunded)$/;

/**
 * A cell as shown to people: { text, tone?, title? }. tone means "show as a coloured chip".
 * Status-like columns get readable labels, money columns euros, dates the local date and time.
 */
export function displayValue(table, column, value) {
  if (value === null || value === undefined || value === '') return { text: '—', empty: true };
  const name = cleanTable(table);
  const map = VALUE_MAPS[`${name}.${column}`] || VALUE_MAPS[`*.${column}`];
  if (map && typeof value === 'string') {
    const tone = OK.test(value) ? 'ok' : BAD.test(value) ? 'error' : WARN.test(value) ? 'warn' : INFO.test(value) ? 'info' : 'neutral';
    return { text: label(map, value), tone, title: value };
  }
  if (typeof value === 'boolean') return { text: value ? L('ja', 'yes') : L('nein', 'no'), tone: value ? 'ok' : 'neutral' };
  if (/_cents$/.test(column) && Number.isFinite(Number(value))) return { text: formatEuro(value), title: `${value} cents` };
  if (/(_at|_until)$/.test(column) && typeof value === 'string') return { text: formatDateTime(value), title: value };
  if (Array.isArray(value)) return { text: value.map(cellText).join(', ') || '—' };
  if (typeof value === 'object') return { text: JSON.stringify(value) };
  return { text: String(value) };
}
