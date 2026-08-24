import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function sendWithResend({ to, subject, text, html, attachments }) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error('RESEND_API_KEY fehlt in server/.env.');
  }
  if (!FROM) {
    throw new Error('EMAIL_FROM fehlt in server/.env. Nutzen Sie eine in Resend verifizierte Domain.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      text,
      html,
      attachments,
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
