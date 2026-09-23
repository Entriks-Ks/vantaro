import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPLE_ICON, EMAIL_GOOGLE_ICON, EMAIL_OUTLOOK_ICON } from './brandIcons.js';
import { buildFollowUpIcs, followUpCalendarLinks, SHOW_APPLE_CALENDAR } from './followUpCalendar.js';

const FROM = process.env.EMAIL_FROM?.trim() || '';
const HEADING_FONT = "'Space Grotesk', Arial, Helvetica, sans-serif";
const BODY_FONT = "'DM Sans', Arial, Helvetica, sans-serif";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../..', 'client/public');

function readPublicPng(name, contentId) {
  try {
    return {
      filename: name,
      content: readFileSync(join(publicDir, name)).toString('base64'),
      content_id: contentId,
    };
  } catch (error) {
    console.error(`Email logo missing: ${name}`, error.message);
    return null;
  }
}

const logoAttachments = [
  readPublicPng('wordmark.png', 'vantaro-wordmark'),
].filter(Boolean);

const EMAIL_APPLE_ICON = APPLE_ICON.replace('fill="currentColor"', 'fill="#101827"');

export function hasCustomMailer() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && FROM);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function verificationEmail({ code, fullName, confirmUrl }) {
  const year = new Date().getFullYear();
  const safeCode = escapeHtml(String(code));
  const safeName = escapeHtml(fullName);
  const safeUrl = escapeHtml(confirmUrl);
  const greeting = safeName ? `Hallo ${safeName}` : 'Hallo';

  const text = `${greeting},

bestätigen Sie Ihre E-Mail-Adresse, um Ihr VANTARO-Konto zu aktivieren:

${confirmUrl}

Oder geben Sie diesen Code ein: ${code}

Link und Code sind 15 Minuten gültig.
Wenn Sie kein Konto erstellt haben, ignorieren Sie diese E-Mail.

© ${year} VANTARO. Alle Rechte vorbehalten.`;

  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Ihr Bestätigungscode für VANTARO</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#101827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            Geben Sie den Code ein oder klicken Sie auf „E-Mail bestätigen“. 15 Minuten gültig.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="background:#070b14;padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="center">
                <img src="cid:vantaro-wordmark" width="168" height="18" alt="VANTARO" style="display:block;margin:0 auto;width:168px;height:18px;border:0;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:36px 24px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="left" style="padding:0 0 12px;font-family:${HEADING_FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-0.04em;color:#101827;">
                Bestätigen Sie Ihre E-Mail-Adresse
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 24px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:#3d4b5c;">
                ${greeting}, bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren. Ein Klick reicht — oder geben Sie den Code ein.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:4px 0 28px;">
                <a href="${safeUrl}" style="display:inline-block;background:#101827;color:#ffffff;font-family:${HEADING_FONT};font-size:15px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;border-radius:10px;padding:14px 22px;">
                  E-Mail bestätigen
                </a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 0 10px;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:#8b9aaa;">
                Oder geben Sie diesen Code ein
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0 28px;font-family:${HEADING_FONT};font-size:40px;font-weight:700;letter-spacing:0.18em;line-height:1.2;color:#101827;-webkit-user-select:all;user-select:all;">
                ${safeCode}
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 8px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                Link und Code sind 15 Minuten gültig. Teilen Sie sie mit niemandem.
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 36px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                Wenn Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0 0;border-top:1px solid #e6e8eb;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:#8b9aaa;">
                © ${year} VANTARO. Alle Rechte vorbehalten.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

async function sendWithResend({ to, subject, text, html, attachments, from, replyTo }) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error('RESEND_API_KEY fehlt in server/.env.');
  }
  const sender = String(from || FROM).trim();
  if (!sender) {
    throw new Error('EMAIL_FROM fehlt in server/.env. Nutzen Sie eine in Resend verifizierte Domain.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender,
      to,
      subject,
      text,
      html,
      attachments,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Resend error: ${payload}`);
  }
}

export async function sendVerificationCodeEmail({ to, code, fullName, confirmUrl }) {
  const subject = 'Bestätigen Sie Ihre E-Mail-Adresse für VANTARO';
  const content = verificationEmail({ code, fullName, confirmUrl });
  await sendWithResend({
    to,
    subject,
    ...content,
    attachments: logoAttachments,
  });
  return 'resend';
}

function passwordResetEmail({ fullName, resetUrl }) {
  const year = new Date().getFullYear();
  const safeName = escapeHtml(fullName);
  const safeUrl = escapeHtml(resetUrl);
  const greeting = safeName ? `Hallo ${safeName}` : 'Hallo';

  const text = `${greeting},

wir haben eine Anfrage erhalten, Ihr VANTARO-Passwort zurückzusetzen.

Klicken Sie auf diesen Link, um ein neues Passwort festzulegen:
${resetUrl}

Der Link ist 30 Minuten gültig.
Wenn Sie kein neues Passwort angefordert haben, ignorieren Sie diese E-Mail.

© ${year} VANTARO. Alle Rechte vorbehalten.`;

  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Passwort zurücksetzen für VANTARO</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#101827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            Klicken Sie auf „Passwort zurücksetzen“, um ein neues Passwort festzulegen.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="background:#070b14;padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="center">
                <img src="cid:vantaro-wordmark" width="168" height="18" alt="VANTARO" style="display:block;margin:0 auto;width:168px;height:18px;border:0;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:36px 24px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="left" style="padding:0 0 12px;font-family:${HEADING_FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-0.04em;color:#101827;">
                Passwort zurücksetzen
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 24px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:#3d4b5c;">
                ${greeting}, wir haben eine Anfrage erhalten, Ihr Passwort zurückzusetzen. Klicken Sie auf den Button, um ein neues Passwort festzulegen.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:4px 0 28px;">
                <a href="${safeUrl}" style="display:inline-block;background:#101827;color:#ffffff;font-family:${HEADING_FONT};font-size:15px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;border-radius:10px;padding:14px 22px;">
                  Passwort zurücksetzen
                </a>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 8px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                Der Link ist 30 Minuten gültig. Teilen Sie ihn mit niemandem.
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 36px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                Wenn Sie kein neues Passwort angefordert haben, können Sie diese E-Mail ignorieren.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0 0;border-top:1px solid #e6e8eb;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:#8b9aaa;">
                © ${year} VANTARO. Alle Rechte vorbehalten.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

export async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  const subject = 'Passwort zurücksetzen für VANTARO';
  const content = passwordResetEmail({ fullName, resetUrl });
  await sendWithResend({
    to,
    subject,
    ...content,
    attachments: logoAttachments,
  });
  return 'resend';
}

function leadsFrom() {
  return process.env.EMAIL_FROM_LEADS?.trim() || FROM;
}

function organizerAddress() {
  const raw = leadsFrom() || FROM;
  const match = String(raw).match(/<([^>]+)>/);
  return (match ? match[1] : String(raw)).replace(/^mailto:/i, '').trim() || 'noreply@vantaro.io';
}

export function hasLeadsMailer() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && leadsFrom());
}

function formatFollowUpWhen(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(value));
}

function followUpReminderEmail({
  beraterName,
  leadName,
  whenLabel,
  phone,
  leadUrl,
  googleUrl,
  outlookUrl,
  appleUrl,
  kind = 'due',
  eventType = 'wiedervorlage',
  whenKind = 'due',
}) {
  const year = new Date().getFullYear();
  const scheduled = kind === 'scheduled';
  const updated = kind === 'updated';
  const cancelled = kind === 'cancelled';
  const isTermin = eventType === 'termin';
  const noun = isTermin ? 'Termin' : 'Wiedervorlage';
  const articleAcc = isTermin ? 'einen Termin' : 'eine Wiedervorlage';
  const articleNom = isTermin ? 'ein Termin' : 'eine Wiedervorlage';
  const safeBerater = escapeHtml(beraterName);
  const safeLead = escapeHtml(leadName);
  const safeWhen = escapeHtml(whenLabel);
  const safePhone = escapeHtml(phone);
  const safeUrl = escapeHtml(leadUrl);
  const safeGoogle = escapeHtml(googleUrl);
  const safeOutlook = escapeHtml(outlookUrl);
  const safeApple = escapeHtml(appleUrl);
  const greeting = safeBerater ? `Hallo ${safeBerater}` : 'Hallo';
  const phoneLine = phone
    ? `Telefon: ${phone}`
    : 'Für diesen Lead ist keine Telefonnummer hinterlegt.';
  const safePhoneLine = phone
    ? `Telefon: ${safePhone}`
    : 'Für diesen Lead ist keine Telefonnummer hinterlegt.';
  const heading = cancelled
    ? `${noun} abgesagt`
    : updated
      ? `${noun} geändert`
      : scheduled
        ? `${noun} gespeichert`
        : whenKind === 'hour'
          ? `${noun} in 1 Stunde`
          : whenKind === 'soon'
            ? `${noun} in 15 Minuten`
            : `${noun} ist fällig`;
  const intro = cancelled
    ? `${greeting}, ${articleNom} für <strong style="color:#101827;">${safeLead}</strong> wurde im Portal entfernt. Der Kalendereintrag wird aktualisiert.`
    : updated
      ? `${greeting}, ${articleNom} für <strong style="color:#101827;">${safeLead}</strong> wurde geändert. Der Eintrag in Google Kalender wird mitverschoben.`
      : scheduled
        ? `${greeting}, Sie haben ${articleAcc} für <strong style="color:#101827;">${safeLead}</strong> gelegt. Speichern Sie die Erinnerung in Ihrem Kalender.`
        : whenKind === 'hour'
          ? `${greeting}, für <strong style="color:#101827;">${safeLead}</strong> steht in 1 Stunde ${articleNom} an.`
          : whenKind === 'soon'
            ? `${greeting}, für <strong style="color:#101827;">${safeLead}</strong> steht in 15 Minuten ${articleNom} an.`
            : `${greeting}, für <strong style="color:#101827;">${safeLead}</strong> ist jetzt ${articleNom} fällig.`;
  const introText = cancelled
    ? `${greeting}, ${articleNom} für ${leadName} wurde im Portal entfernt. Der Kalendereintrag wird aktualisiert.`
    : updated
      ? `${greeting}, ${articleNom} für ${leadName} wurde geändert. Der Eintrag in Google Kalender wird mitverschoben.`
      : scheduled
        ? `${greeting}, Sie haben ${articleAcc} für ${leadName} gelegt. Speichern Sie die Erinnerung in Ihrem Kalender.`
        : whenKind === 'hour'
          ? `${greeting},\n\nfür ${leadName} steht in 1 Stunde ${articleNom} an.`
          : whenKind === 'soon'
            ? `${greeting},\n\nfür ${leadName} steht in 15 Minuten ${articleNom} an.`
            : `${greeting},\n\nfür ${leadName} ist jetzt ${articleNom} fällig.`;
  const footerNote = cancelled
    ? 'Wenn der Termin im Kalender bleibt, löschen Sie den Eintrag dort bitte einmalig.'
    : updated || scheduled
      ? 'Sie können Datum und Uhrzeit jederzeit im Portal ändern — Google Kalender folgt mit.'
      : 'Wenn Sie den Lead bereits bearbeitet haben, können Sie diese E-Mail ignorieren.';
  const preview = cancelled
    ? `${noun} abgesagt · ${safeLead}.`
    : updated
      ? `${noun} geändert für ${safeLead} · ${safeWhen}.`
      : scheduled
        ? `${noun} gespeichert für ${safeLead} · ${safeWhen}.`
        : whenKind === 'hour'
          ? `${noun} in 1 Stunde · ${safeLead} · ${safeWhen}.`
          : whenKind === 'soon'
            ? `${noun} in 15 Minuten · ${safeLead} · ${safeWhen}.`
            : `${noun} für ${safeLead} · ${safeWhen}.`;
  const title = cancelled
    ? `${noun} abgesagt für ${safeLead}`
    : updated
      ? `${noun} geändert für ${safeLead}`
      : scheduled
        ? `${noun} gespeichert für ${safeLead}`
        : `${noun} für ${safeLead}`;
  const calendarText = googleUrl || outlookUrl || (SHOW_APPLE_CALENDAR && appleUrl)
    ? `

Im Kalender speichern:
${googleUrl ? `Google Kalender: ${googleUrl}` : ''}
${outlookUrl ? `Outlook: ${outlookUrl}` : ''}
${SHOW_APPLE_CALENDAR && appleUrl ? `Apple Kalender: ${appleUrl}` : ''}`
    : '';

  const calendarButton = (href, icon, label) => `
                    <td style="padding:0 8px 8px 0;">
                      <a href="${href}" style="display:inline-block;background:#ffffff;color:#101827;font-family:${BODY_FONT};font-size:13px;font-weight:500;text-decoration:none;border:1px solid #d8dee6;border-radius:10px;padding:11px 18px;line-height:20px;">
                        ${icon}<span style="display:inline-block;vertical-align:middle;padding-left:8px;">${label}</span>
                      </a>
                    </td>`;

  const calendarHtml = googleUrl || outlookUrl || (SHOW_APPLE_CALENDAR && appleUrl)
    ? `
            <tr>
              <td align="left" style="padding:0 0 10px;font-family:${HEADING_FONT};font-size:14px;font-weight:600;color:#101827;">
                Im Kalender speichern
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" align="left">
                  <tr>
                    ${googleUrl ? calendarButton(safeGoogle, EMAIL_GOOGLE_ICON, 'Google') : ''}
                    ${outlookUrl ? calendarButton(safeOutlook, EMAIL_OUTLOOK_ICON, 'Outlook') : ''}
                    ${SHOW_APPLE_CALENDAR && appleUrl ? calendarButton(safeApple, EMAIL_APPLE_ICON, 'Apple') : ''}
                  </tr>
                </table>
              </td>
            </tr>`
    : '';

  const text = `${introText}

${whenLabel}
${phoneLine}

Öffnen Sie den Lead:
${leadUrl}
${calendarText}

${footerNote}

© ${year} VANTARO. Alle Rechte vorbehalten.`;

  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#101827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            ${preview}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="background:#070b14;padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="center">
                <img src="cid:vantaro-wordmark" width="168" height="18" alt="VANTARO" style="display:block;margin:0 auto;width:168px;height:18px;border:0;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:36px 24px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="left" style="padding:0 0 12px;font-family:${HEADING_FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-0.04em;color:#101827;">
                ${heading}
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 24px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:#3d4b5c;">
                ${intro}
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 8px;font-family:${HEADING_FONT};font-size:18px;font-weight:600;line-height:1.4;color:#101827;">
                ${safeWhen}
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 28px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:#3d4b5c;">
                ${safePhoneLine}
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:4px 0 20px;">
                <a href="${safeUrl}" style="display:inline-block;background:#101827;color:#ffffff;font-family:${HEADING_FONT};font-size:15px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;border-radius:10px;padding:14px 22px;">
                  Lead öffnen
                </a>
              </td>
            </tr>
            ${calendarHtml}
            <tr>
              <td align="left" style="padding:0 0 36px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                ${footerNote}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0 0;border-top:1px solid #e6e8eb;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:#8b9aaa;">
                © ${year} VANTARO. Alle Rechte vorbehalten.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

async function sendFollowUpEmail({
  to,
  beraterName,
  leadName,
  followUpAt,
  phone,
  leadUrl,
  leadId,
  kind = 'due',
  eventType = 'wiedervorlage',
  whenKind = 'due',
  includeCalendar = true,
}) {
  const noun = eventType === 'termin' ? 'Termin' : 'Wiedervorlage';
  const whenLabel = formatFollowUpWhen(followUpAt) || 'jetzt';
  const timingLabel = whenKind === 'hour'
    ? 'in 1 Stunde'
    : whenKind === 'soon'
      ? 'in 15 Minuten'
      : null;
  const subject = kind === 'cancelled'
    ? `${noun} abgesagt · ${leadName}`
    : kind === 'updated'
      ? `${noun} geändert · ${leadName} · ${whenLabel}`
      : kind === 'scheduled'
        ? `${noun} gespeichert · ${leadName} · ${whenLabel}`
        : timingLabel
          ? `${noun} ${timingLabel} · ${leadName} · ${whenLabel}`
          : `${noun} · ${leadName} · ${whenLabel}`;
  const calendar = leadId && followUpAt && kind !== 'cancelled'
    ? followUpCalendarLinks({
      leadId,
      leadName,
      followUpAt,
      phone,
      leadUrl,
      eventType,
    })
    : null;
  const content = followUpReminderEmail({
    beraterName,
    leadName,
    whenLabel,
    phone,
    leadUrl,
    googleUrl: calendar?.googleUrl,
    outlookUrl: calendar?.outlookUrl,
    appleUrl: calendar?.appleUrl,
    kind,
    eventType,
    whenKind,
  });
  const attachments = [...logoAttachments];
  if (includeCalendar && leadId && followUpAt && to) {
    const ics = buildFollowUpIcs({
      leadId,
      leadName,
      followUpAt,
      phone,
      leadUrl,
      eventType,
      method: kind === 'cancelled' ? 'CANCEL' : 'REQUEST',
      sequence: Math.max(1, Math.floor(Date.now() / 1000)),
      attendeeEmail: to,
      organizerEmail: organizerAddress(),
    });
    attachments.push({
      filename: eventType === 'termin' ? 'VANTARO-Termin.ics' : 'VANTARO-Wiedervorlage.ics',
      content: Buffer.from(ics, 'utf8').toString('base64'),
      content_type: `text/calendar; charset=UTF-8; method=${kind === 'cancelled' ? 'CANCEL' : 'REQUEST'}`,
    });
  }
  await sendWithResend({
    to,
    from: leadsFrom(),
    subject,
    ...content,
    attachments,
  });
  return 'resend';
}

function adminLeadRequestEmail({
  beraterName,
  beraterEmail,
  company,
  requestCode,
  leadType,
  scopeLabel,
  requestedCount,
  reviewUrl,
}) {
  const year = new Date().getFullYear();
  const safeBerater = escapeHtml(beraterName);
  const safeEmail = escapeHtml(beraterEmail);
  const safeCompany = escapeHtml(company);
  const safeCode = escapeHtml(requestCode);
  const safeType = escapeHtml(leadType);
  const safeScope = escapeHtml(scopeLabel);
  const safeCount = escapeHtml(String(requestedCount));
  const safeUrl = escapeHtml(reviewUrl);
  const greeting = 'Hallo';
  const companyLine = company ? `Firma: ${company}` : '';
  const codeLine = requestCode ? `Code: ${requestCode}` : '';

  const text = `${greeting},

eine neue Lead-Anforderung ist eingegangen.

Berater: ${beraterName || '—'}
${beraterEmail ? `E-Mail: ${beraterEmail}` : ''}
${companyLine}
${codeLine}
Paket: ${scopeLabel} · ${leadType}
Anzahl: ${requestedCount} Leads

Anforderung öffnen:
${reviewUrl}

© ${year} VANTARO. Alle Rechte vorbehalten.`;

  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Neue Lead-Anforderung</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#101827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safeBerater} · ${safeCount} ${safeType}-Leads · ${safeScope}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="background:#070b14;padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="center">
                <img src="cid:vantaro-wordmark" width="168" height="18" alt="VANTARO" style="display:block;margin:0 auto;width:168px;height:18px;border:0;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:36px 24px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="left" style="padding:0 0 12px;font-family:${HEADING_FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-0.04em;color:#101827;">
                Neue Anforderung
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 24px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#3a4658;">
                ${greeting}, eine neue Lead-Anforderung von <strong style="color:#101827;">${safeBerater || 'einem Berater'}</strong> ist eingegangen.
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6ebf2;border-radius:12px;background:#f8fafc;">
                  <tr>
                    <td style="padding:16px 18px;font-family:${BODY_FONT};font-size:14px;line-height:1.55;color:#3a4658;">
                      <div style="margin:0 0 8px;"><strong style="color:#101827;">Berater:</strong> ${safeBerater || '—'}</div>
                      ${beraterEmail ? `<div style="margin:0 0 8px;"><strong style="color:#101827;">E-Mail:</strong> ${safeEmail}</div>` : ''}
                      ${company ? `<div style="margin:0 0 8px;"><strong style="color:#101827;">Firma:</strong> ${safeCompany}</div>` : ''}
                      ${requestCode ? `<div style="margin:0 0 8px;"><strong style="color:#101827;">Code:</strong> ${safeCode}</div>` : ''}
                      <div style="margin:0 0 8px;"><strong style="color:#101827;">Paket:</strong> ${safeScope} · ${safeType}</div>
                      <div style="margin:0;"><strong style="color:#101827;">Anzahl:</strong> ${safeCount} Leads</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 28px;">
                <a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#ff755a;color:#ffffff;font-family:${BODY_FONT};font-size:14px;font-weight:600;text-decoration:none;">
                  Anforderung öffnen
                </a>
              </td>
            </tr>
            <tr>
              <td align="left" style="font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:#6b849c;">
                © ${year} VANTARO. Alle Rechte vorbehalten.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

export async function sendAdminLeadRequestEmail({
  to,
  beraterName,
  beraterEmail,
  company,
  requestCode,
  leadType,
  scopeLabel,
  requestedCount,
  reviewUrl,
}) {
  const subjectParts = [
    'Neue Anforderung',
    beraterName || null,
    requestedCount ? `${requestedCount} ${leadType || 'Leads'}` : null,
  ].filter(Boolean);
  const subject = subjectParts.join(' · ');
  const content = adminLeadRequestEmail({
    beraterName,
    beraterEmail,
    company,
    requestCode,
    leadType,
    scopeLabel,
    requestedCount,
    reviewUrl,
  });
  await sendWithResend({
    to,
    from: leadsFrom(),
    subject,
    ...content,
    attachments: logoAttachments,
  });
  return 'resend';
}

export async function sendFollowUpReminderEmail(payload) {
  return sendFollowUpEmail({ ...payload, kind: 'due' });
}

export async function sendFollowUpScheduledEmail(payload) {
  return sendFollowUpEmail({ ...payload, kind: payload.kind || 'scheduled' });
}

function supportEmail({
  name,
  email,
  category,
  subject,
  message,
  phone,
  company,
  customerNumber,
  priority,
  leadRef,
  userId,
  pageUrl,
  userAgent,
  attachments = [],
}) {
  const year = new Date().getFullYear();
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const categoryLabels = {
    general: 'Allgemeine Frage',
    billing: 'Abrechnung & Zahlung',
    technical: 'Technisches Problem',
    leads: 'Lead-Bestand',
    account: 'Konto & Profil',
    calendar: 'Termine & Wiedervorlage',
  };
  const priorityLabels = {
    normal: 'Normal',
    urgent: 'Dringend',
  };
  const categoryLabel = categoryLabels[category] || 'Allgemeine Frage';
  const priorityLabel = priorityLabels[priority] || 'Normal';
  const safeCategory = escapeHtml(categoryLabel);
  const safePriority = escapeHtml(priorityLabel);
  const fact = (label, value) => (value
    ? `${label}: ${value}`
    : '');
  const facts = [
    fact('Kategorie', categoryLabel),
    fact('Priorität', priorityLabel),
    fact('Name', name),
    fact('E-Mail', email),
    fact('Telefon', phone),
    fact('Unternehmen', company),
    fact('Kundennummer', customerNumber),
    fact('Lead-Bezug', leadRef),
    fact('Konto-ID', userId),
    fact('Anhänge', attachments.map((file) => file.filename).filter(Boolean).join(', ')),
    fact('Seite', pageUrl),
    fact('Browser', userAgent),
  ].filter(Boolean);

  const htmlFact = (label, value) => (value
    ? `<tr>
              <td align="left" style="padding:0 0 8px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                <strong style="color:#101827;">${escapeHtml(label)}:</strong> ${escapeHtml(value)}
              </td>
            </tr>`
    : '');

  const text = `Neue Support-Anfrage von ${name}

${facts.join('\n')}

Betreff: ${subject}

Nachricht:
${message}

© ${year} VANTARO. Alle Rechte vorbehalten.`;

  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Neue Support-Anfrage</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#101827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="background:#070b14;padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="center">
                <img src="cid:vantaro-wordmark" width="168" height="18" alt="VANTARO" style="display:block;margin:0 auto;width:168px;height:18px;border:0;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:36px 24px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="left" style="padding:0 0 12px;font-family:${HEADING_FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-0.04em;color:#101827;">
                Neue Support-Anfrage
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 24px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:#3d4b5c;">
                Von: <strong style="color:#101827;">${safeName}</strong>
                ${priority === 'urgent' ? ' · <strong style="color:#dc5942;">Dringend</strong>' : ''}
              </td>
            </tr>
            ${htmlFact('Kategorie', categoryLabel)}
            ${htmlFact('Priorität', priorityLabel)}
            ${htmlFact('E-Mail', email)}
            ${htmlFact('Telefon', phone)}
            ${htmlFact('Unternehmen', company)}
            ${htmlFact('Kundennummer', customerNumber)}
            ${htmlFact('Lead-Bezug', leadRef)}
            ${htmlFact('Konto-ID', userId)}
            <tr>
              <td align="left" style="padding:8px 0 12px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                <strong style="color:#101827;">Betreff:</strong> ${safeSubject}
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;font-family:${BODY_FONT};font-size:15px;line-height:1.6;color:#3d4b5c;">
                ${safeMessage.replace(/\n/g, '<br />')}
              </td>
            </tr>
            ${attachments.length
              ? `<tr>
              <td align="left" style="padding:8px 0 4px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                <strong style="color:#101827;">Anhänge:</strong> ${escapeHtml(attachments.map((file) => file.filename).join(', '))}
              </td>
            </tr>`
              : ''}
            ${attachments.filter((file) => file.content_id && String(file.content_type || '').startsWith('image/')).map((file) => `
            <tr>
              <td align="left" style="padding:8px 0 12px;">
                <img src="cid:${escapeHtml(file.content_id)}" alt="${escapeHtml(file.filename)}" style="display:block;max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:12px;" />
              </td>
            </tr>`).join('')}
            ${htmlFact('Seite', pageUrl)}
            ${htmlFact('Browser', userAgent)}
            <tr>
              <td align="center" style="padding:24px 0 0;border-top:1px solid #e6e8eb;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:#8b9aaa;">
                © ${year} VANTARO. Alle Rechte vorbehalten.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

function supportReceiptEmail({ name, subject, category, attachments = [] }) {
  const year = new Date().getFullYear();
  const safeName = escapeHtml(name);
  const safeSubject = escapeHtml(subject);
  const greeting = safeName ? `Hallo ${safeName}` : 'Hallo';
  const categoryLabels = {
    general: 'Allgemeine Frage',
    billing: 'Abrechnung & Zahlung',
    technical: 'Technisches Problem',
    leads: 'Lead-Bestand',
    account: 'Konto & Profil',
    calendar: 'Termine & Wiedervorlage',
  };
  const categoryLabel = categoryLabels[category] || 'Allgemeine Frage';

  const text = `${greeting},

wir haben Ihre Support-Anfrage erhalten und melden uns werktags.

Betreff: ${subject}
Kategorie: ${categoryLabel}
${attachments.length ? `Anhänge: ${attachments.length}` : ''}

© ${year} VANTARO. Alle Rechte vorbehalten.`;

  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Ihre Anfrage bei VANTARO</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#101827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="background:#070b14;padding:22px 24px;">
          <img src="cid:vantaro-wordmark" width="168" height="18" alt="VANTARO" style="display:block;margin:0 auto;width:168px;height:18px;border:0;" />
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:36px 24px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="left" style="padding:0 0 12px;font-family:${HEADING_FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-0.04em;color:#101827;">
                Anfrage erhalten
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 20px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:#3d4b5c;">
                ${greeting}, wir haben Ihre Nachricht erhalten und antworten werktags.
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 8px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                <strong style="color:#101827;">Betreff:</strong> ${safeSubject}
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 0 ${attachments.length ? '8' : '28'}px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                <strong style="color:#101827;">Kategorie:</strong> ${escapeHtml(categoryLabel)}
              </td>
            </tr>
            ${attachments.length
              ? `<tr>
              <td align="left" style="padding:0 0 28px;font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#5a6b7c;">
                <strong style="color:#101827;">Anhänge:</strong> ${attachments.length} Datei${attachments.length === 1 ? '' : 'en'} mitgesendet
              </td>
            </tr>`
              : ''}
            <tr>
              <td align="center" style="padding:24px 0 0;border-top:1px solid #e6e8eb;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:#8b9aaa;">
                © ${year} VANTARO. Alle Rechte vorbehalten.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

export async function sendSupportEmail(payload) {
  const inbox = process.env.SUPPORT_EMAIL?.trim() || 'info@vantaro.io';
  const urgent = payload.priority === 'urgent';
  const emailSubject = `${urgent ? '[Dringend] ' : ''}Support: ${payload.subject}`;
  const content = supportEmail(payload);

  await sendWithResend({
    to: inbox,
    subject: emailSubject,
    replyTo: payload.email,
    ...content,
    attachments: [...logoAttachments, ...(payload.attachments || [])],
  });

  if (payload.email) {
    try {
      const receipt = supportReceiptEmail(payload);
      await sendWithResend({
        to: payload.email,
        subject: `Ihre Anfrage bei VANTARO: ${payload.subject}`,
        ...receipt,
        attachments: logoAttachments,
      });
    } catch (error) {
      console.error('Support receipt email failed:', error.message);
    }
  }

  return 'resend';
}
