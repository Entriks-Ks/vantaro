import { L, locale, pick } from './i18n';

// Label maps hold [German, English]; label() resolves them in the console language.

export const LEAD_STATUS = {
  neu: ['Neu', 'New'],
  in_bearbeitung: ['Wieder verfügbar', 'Available again'],
  zugewiesen: ['Zugewiesen', 'Assigned'],
  erledigt: ['Erledigt', 'Done'],
};

export const CONTACT_STATUS = {
  neu: ['Neu', 'New'],
  kontaktiert: ['Kontaktiert', 'Contacted'],
  termin: ['Termin', 'Appointment'],
  wiedervorlage: ['Wiedervorlage', 'Follow-up'],
  abgeschlossen: ['Abgeschlossen', 'Closed'],
};

export const CLOSE_OUTCOME = {
  erfolgreich: ['Erfolgreich', 'Successful'],
  fehlgeschlagen: ['Nicht erfolgreich', 'Not successful'],
};

export const LEAD_SOURCE = {
  csv: ['CSV-Import', 'CSV import'],
  manual: ['Manuell', 'Manual'],
  api: ['API / TC-Dial', 'API / TC-Dial'],
};

export const VERTICAL = {
  insurance: ['Versicherung', 'Insurance'],
  energy: ['Energie', 'Energy'],
};

export const SCOPE = {
  deutschlandweit: ['Deutschlandweit', 'Nationwide'],
  regional: ['Regional', 'Regional'],
};

export const PAYMENT_STATUS = {
  pending: ['Offen', 'Open'],
  paid: ['Bezahlt', 'Paid'],
  failed: ['Fehlgeschlagen', 'Failed'],
  refunded: ['Erstattet', 'Refunded'],
};

export const REQUEST_STATUS = {
  pending: ['Ausstehend', 'Pending'],
  active: ['Aktiv', 'Active'],
  completed: ['Erfüllt', 'Fulfilled'],
  rejected: ['Abgelehnt', 'Rejected'],
  cancelled: ['Storniert', 'Cancelled'],
};

export const COMPLAINT_STATUS = {
  pending: ['Offen', 'Open'],
  approved: ['Erstattet', 'Refunded'],
  partial: ['Teilweise', 'Partial'],
  declined: ['Abgelehnt', 'Declined'],
  info_needed: ['Info angefordert', 'Info requested'],
};

export const ROLE = {
  berater: ['Berater', 'Advisor'],
  admin: ['Admin', 'Admin'],
  it_support: ['IT-Support', 'IT Support'],
};

export const PARTNER_ROLE = {
  main: ['Hauptkonto', 'Main account'],
  dispatcher: ['Disponent', 'Dispatcher'],
  sub_partner: ['Unterpartner', 'Sub-partner'],
  field_rep: ['Außendienst', 'Field rep'],
};

export const EVENT_SOURCE = {
  server: ['Server', 'Server'],
  auth: ['Anmeldung', 'Sign-in'],
  leads: ['Leads', 'Leads'],
  payments: ['Zahlungen', 'Payments'],
  email: ['E-Mail', 'Email'],
  reminders: ['Erinnerungen', 'Reminders'],
  tcdial: ['TC-Dial', 'TC-Dial'],
  calendar: ['Kalender', 'Calendar'],
  database: ['Datenbank', 'Database'],
  it_support: ['IT-Support', 'IT Support'],
};

export const EVENT_LEVEL = {
  error: ['Fehler', 'Error'],
  warning: ['Warnung', 'Warning'],
  info: ['Info', 'Info'],
};

export const PAYMENT_EVENT = {
  checkout_created: ['Checkout gestartet', 'Checkout started'],
  payment_paid: ['Bezahlt', 'Paid'],
  payment_failed: ['Fehlgeschlagen', 'Failed'],
  payment_synced: ['Mit Bank abgeglichen', 'Checked with bank'],
  return_invalid_token: ['Ungültige Rückleitung', 'Invalid return'],
  suspicious_activity: ['Verdächtige Aktivität', 'Suspicious activity'],
};

export const ACTION = {
  'lead.update': ['Lead bearbeitet', 'Lead edited'],
  'lead.assign': ['Lead zugewiesen', 'Lead assigned'],
  'lead.unassign': ['Zuweisung aufgehoben', 'Lead unassigned'],
  'lead.reset': ['Bearbeitungsstand zurückgesetzt', 'Progress reset'],
  'lead.restore': ['Lead wiederhergestellt', 'Lead restored'],
  'lead.fix': ['Datenfehler korrigiert', 'Data error fixed'],
  'lead.delete': ['Lead gelöscht', 'Lead deleted'],
  'appointment.update': ['Termin geändert', 'Appointment changed'],
  'appointment.cancel': ['Termin entfernt', 'Appointment removed'],
  'appointment.reset_reminders': ['Erinnerungen zurückgesetzt', 'Reminders reset'],
  'reminders.run': ['Erinnerungs-Job gestartet', 'Reminder job started'],
  'user.update': ['Nutzer bearbeitet', 'User edited'],
  'user.verify_email': ['E-Mail bestätigt', 'Email confirmed'],
  'user.resend_verification': ['Bestätigungscode gesendet', 'Confirmation code sent'],
  'user.verification_code': ['Bestätigungscode manuell erstellt', 'Confirmation code created manually'],
  'user.password_reset': ['Passwort-Link gesendet', 'Password link sent'],
  'user.block': ['Konto gesperrt', 'Account blocked'],
  'user.unblock': ['Sperre aufgehoben', 'Account unblocked'],
  'user.partner_activate': ['Partnerzugang aktiviert', 'Partner access activated'],
  'user.partner_deactivate': ['Partnerzugang deaktiviert', 'Partner access deactivated'],
  'user.reset_onboarding': ['Ersteinrichtung zurückgesetzt', 'Initial setup reset'],
  'user.delete': ['Konto gelöscht', 'Account deleted'],
  'payment.sync': ['Zahlung abgeglichen', 'Payment checked'],
  'payment.mark_failed': ['Zahlung abgebrochen', 'Payment cancelled'],
  'payment.repair_request': ['Auftrag nachgetragen', 'Order created'],
  'integration.test': ['Integration getestet', 'Integration tested'],
  'integration.tcdial_subscribe': ['TC-Dial Webhook registriert', 'TC-Dial webhook registered'],
  'integration.tcdial_unsubscribe': ['TC-Dial Webhook abgemeldet', 'TC-Dial webhook unsubscribed'],
  'system_event.resolve': ['Meldung erledigt', 'Message resolved'],
  'system_event.reopen': ['Meldung wieder geöffnet', 'Message reopened'],
  'system_event.resolve_all': ['Meldungen erledigt', 'Messages resolved'],
};

export const TARGET_TYPE = {
  lead: ['Lead', 'Lead'],
  user: ['Nutzer', 'User'],
  payment: ['Zahlung', 'Payment'],
  integration: ['Integration', 'Integration'],
  system_event: ['Systemmeldung', 'System message'],
  system: ['System', 'System'],
};

export function label(map, value, fallback = '—') {
  if (value == null || value === '') return fallback;
  return map[value] ? pick(map[value]) : value;
}

/** Options for a <Select>: all entries of a label map, with a first "all" entry. */
export function mapOptions(map, allLabel) {
  return [{ value: '', label: allLabel }, ...Object.keys(map).map((value) => ({ value, label: pick(map[value]) }))];
}

const formatters = new Map();
function formatter(kind, factory) {
  const key = `${kind}:${locale()}`;
  if (!formatters.has(key)) formatters.set(key, factory(locale()));
  return formatters.get(key);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatter('datetime', (loc) => new Intl.DateTimeFormat(loc, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })).format(date);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatter('date', (loc) => new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })).format(date);
}

export function formatRelative(value) {
  if (!value) return '—';
  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff)) return '—';
  const relative = formatter('relative', (loc) => new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }));
  const abs = Math.abs(diff);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return L('gerade eben', 'just now');
  if (abs < hour) return relative.format(Math.round(diff / minute), 'minute');
  if (abs < day) return relative.format(Math.round(diff / hour), 'hour');
  if (abs < 30 * day) return relative.format(Math.round(diff / day), 'day');
  return formatDate(value);
}

export function formatEuro(cents) {
  return formatter('euro', (loc) => new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }))
    .format((Number(cents) || 0) / 100);
}

/** Value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromLocalInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
}
