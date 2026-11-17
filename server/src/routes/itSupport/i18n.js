/**
 * Language of the IT Support console API. The console sends Accept-Language "en" or "de";
 * English is only used here — the rest of the platform stays German.
 */

export function langOf(req) {
  return /^\s*en/i.test(String(req?.headers?.['accept-language'] || '')) ? 'en' : 'de';
}

/** `const t = tr(req); t('Deutsch', 'English')` */
export function tr(reqOrLang) {
  const lang = typeof reqOrLang === 'string' ? reqOrLang : langOf(reqOrLang);
  return (de, en) => (lang === 'en' ? en : de);
}

/** Bilingual text for the activity log, stored in both languages. */
export function both(de, en) {
  return { de, en };
}

// German messages raised by shared platform code (lead validation, assignment, auth, payments) that
// can reach the console. Unknown messages are shown unchanged.
const MESSAGES = {
  'Vorname ist erforderlich.': 'First name is required.',
  'Nachname ist erforderlich.': 'Last name is required.',
  'E-Mail-Adresse ist ungültig.': 'Email address is invalid.',
  'PLZ muss 5 Ziffern haben.': 'Postcode must have 5 digits.',
  'PLZ ist erforderlich.': 'Postcode is required.',
  'Ort ist erforderlich.': 'City is required.',
  'Straße ist erforderlich.': 'Street is required.',
  'Telefonnummer ist erforderlich.': 'Phone number is required.',
  'Bundesland ist ungültig.': 'Federal state is invalid.',
  'Status ist ungültig.': 'Status is invalid.',
  'Quelle ist ungültig.': 'Source is invalid.',
  'Bereich ist ungültig.': 'Area is invalid.',
  'Gesprächsstatus ist ungültig.': 'Conversation status is invalid.',
  'Abschluss-Ergebnis ist ungültig.': 'Outcome is invalid.',
  'Abschluss-Ergebnis nur bei Status Abgeschlossen.': 'An outcome is only allowed when the status is "Closed".',
  'Bitte wählen Sie, ob der Lead erfolgreich oder nicht erfolgreich war.': 'Please choose whether the lead was successful or not.',
  'Paket muss deutschlandweit oder regional sein.': 'Package must be nationwide or regional.',
  'Fester Termin braucht Datum und Uhrzeit.': 'A fixed appointment needs a date and time.',
  'Bitte zuerst einen Berater zuweisen.': 'Please assign an advisor first.',
  'Lead wurde nicht gefunden.': 'Lead not found.',
  'Lead ist ungültig.': 'Lead is invalid.',
  'Berater ist ungültig.': 'Advisor is invalid.',
  'Berater wurde nicht gefunden.': 'Advisor not found.',
  'Anforderung ist ungültig.': 'Order is invalid.',
  'Bitte eine Anforderung auswählen.': 'Please select an order.',
  'Bitte mindestens einen Lead auswählen.': 'Please select at least one lead.',
  'Erledigte Leads können nicht zugewiesen werden.': 'Completed leads cannot be assigned.',
  'Erstattete Leads können nicht erneut zugewiesen werden.': 'Refunded leads cannot be assigned again.',
  'Dieser Lead ist bereits zugestellt und kann nicht neu zugewiesen werden. Rückgabe nur über eine Reklamation.': 'This lead has already been delivered and cannot be reassigned. Unassign it first.',
  'Dieser Berater hat keinen offenen Auftrag für dieses Paket.': 'This advisor has no open order for this package.',
  'Die gewählte Anforderung ist nicht aktiv, hat kein Restkontingent oder passt nicht zum Paket.': 'The selected order is not active, has no remaining quota or does not match the package.',
  'Die gewählte Anforderung ist nicht aktiv oder gehört nicht zu diesem Berater.': 'The selected order is not active or does not belong to this advisor.',
  'Dieser Auftrag ist nicht aktiv.': 'This order is not active.',
  'Auftrag ist bereits erfüllt. Erhöhen Sie zuerst die Anzahl.': 'The order is already fulfilled.',
  'Lead und Auftrag gehören zu unterschiedlichen Bereichen.': 'Lead and order belong to different areas.',
  'Lead passt nicht zum bestellten Produkt.': 'The lead does not match the ordered product.',
  'Der Termin ist bereits verstrichen und kann nicht mehr gesendet werden. Bitte zuerst neu terminieren.': 'The appointment has already passed and cannot be sent. Please reschedule it first.',
  'Nur Berater können Leads zugewiesen bekommen.': 'Only advisors can receive leads.',
  'Nur Berater mit aktivem Auftrag in diesem Bereich können Leads erhalten.': 'Only advisors with an active order in this area can receive leads.',
  'Unterpartner erhalten Leads über ihre Hauptfirma.': 'Sub-partners receive leads through their main company.',
  'Lead konnte nicht zugewiesen werden.': 'Lead could not be assigned.',
  'Ein ausgewählter Lead wurde nicht gefunden.': 'A selected lead was not found.',
  'Dieser Lead ist nicht verworfen.': 'This lead has not been rejected.',
  'Nur Berater-Konten können Aufträge erhalten.': 'Only advisor accounts can receive orders.',
  'Supabase ist nicht konfiguriert.': 'Supabase is not configured.',
  'Energie-Bereich fehlt. Bitte server/supabase/vertical.sql im Supabase SQL Editor ausführen.': 'Energy area is missing. Please run server/supabase/vertical.sql in the Supabase SQL Editor.',
  'E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY / EMAIL_FROM).': 'Email sending is not configured (RESEND_API_KEY / EMAIL_FROM).',
  'Für diese Zahlung fehlt die ProCredit-Order-Referenz.': 'This payment has no ProCredit order reference.',
  'Zahlung nicht gefunden.': 'Payment not found.',
  'ProCredit Create Order Antwort ist unvollständig.': 'ProCredit "create order" response is incomplete.',
  'Google Kalender ist noch nicht konfiguriert.': 'Google Calendar is not configured yet.',
  'Keine Berechtigung.': 'Access denied.',
  'Nicht angemeldet.': 'Not signed in.',
  'Sitzung ungültig oder abgelaufen.': 'Session invalid or expired.',
};

const PATTERNS = [
  [/^Nur noch (\d+) Leads? in diesem Auftrag offen\.$/, (m) => `Only ${m[1]} lead(s) left in this order.`],
  [/^Bitte warten Sie (\d+) Sekunden.*$/, (m) => `Please wait ${m[1]} seconds before trying again.`],
  [/^ProCredit-Verbindung fehlgeschlagen: (.*)$/, (m) => `ProCredit connection failed: ${m[1]}`],
  [/^Dieser Auftrag ist (regional|deutschlandweit)\..*$/, (m) => `This order is ${m[1] === 'regional' ? 'regional' : 'nationwide'}. Please only send matching leads.`],
  [/^Resend error: (.*)$/, (m) => `Resend error: ${m[1]}`],
];

/** English version of a German platform message when we know it; otherwise the message itself. */
export function translateMessage(message, lang) {
  if (lang !== 'en' || !message) return message;
  const text = String(message);
  if (MESSAGES[text]) return MESSAGES[text];
  for (const [pattern, render] of PATTERNS) {
    const match = text.match(pattern);
    if (match) return render(match);
  }
  return text;
}
