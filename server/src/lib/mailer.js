const FROM = process.env.EMAIL_FROM?.trim() || '';

export function hasCustomMailer() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && FROM);
}

function verificationEmail({ code, fullName }) {
  const greeting = fullName ? `Hallo ${fullName}` : 'Hallo';
  const text = `${greeting},

Ihr Bestätigungscode für VANTARO lautet:

${code}

Der Code ist 15 Minuten gültig. Wenn Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.

— VANTARO`;

  const html = `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:32px;background:#070b14;color:#e8eef6;font-family:Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px;background:#101827;border-radius:16px;">
      <p style="margin:0 0 16px;color:#8ea0b8;">${greeting},</p>
      <p style="margin:0 0 24px;">Ihr Bestätigungscode für VANTARO lautet:</p>
      <p style="margin:0 0 24px;font-size:32px;letter-spacing:0.28em;font-weight:700;color:#56d3c4;">${code}</p>
      <p style="margin:0;color:#8ea0b8;font-size:14px;">Der Code ist 15 Minuten gültig. Wenn Sie kein Konto erstellt haben, ignorieren Sie diese E-Mail.</p>
    </div>
  </body>
</html>`;

  return { text, html };
}

async function sendWithResend({ to, subject, text, html }) {
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
    body: JSON.stringify({ from: FROM, to, subject, text, html }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Resend error: ${payload}`);
  }
}

export async function sendVerificationCodeEmail({ to, code, fullName }) {
  const subject = 'Ihr VANTARO-Bestätigungscode';
  const content = verificationEmail({ code, fullName });
  await sendWithResend({ to, subject, ...content });
  return 'resend';
}
