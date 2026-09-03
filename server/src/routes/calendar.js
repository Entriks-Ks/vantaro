import { Router } from 'express';
import { APPLE_ICON, GOOGLE_ICON, OUTLOOK_ICON } from '../lib/brandIcons.js';
import { getClientOrigin } from '../lib/clientOrigin.js';
import { getLeadById, isUuid } from '../lib/leads.js';
import {
  buildFollowUpIcs,
  followUpAppUrl,
  followUpIcsUrl,
  followUpWebcalUrl,
  googleCalendarUrl,
  isFollowUpIcsSignature,
  outlookCalendarUrl,
  toFollowUpEventJson,
} from '../lib/followUpCalendar.js';

const router = Router();

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadFollowUp(req) {
  const leadId = String(req.query.lead || '');
  const at = String(req.query.at || '');
  const sig = String(req.query.sig || '');
  if (!isUuid(leadId) || !at || Number.isNaN(new Date(at).getTime()) || !isFollowUpIcsSignature(leadId, at, sig)) {
    return null;
  }
  return { leadId, at };
}

async function requireFollowUp(req, res) {
  const query = loadFollowUp(req);
  if (!query) {
    res.status(404).type('text').send('Kalender-Eintrag wurde nicht gefunden.');
    return null;
  }

  const row = await getLeadById(query.leadId);
  if (!row || row.contact_status !== 'wiedervorlage' || !row.follow_up_at) {
    res.status(404).type('text').send('Kalender-Eintrag wurde nicht gefunden.');
    return null;
  }

  const stored = new Date(row.follow_up_at).toISOString();
  const requested = new Date(query.at).toISOString();
  if (stored !== requested) {
    res.status(404).type('text').send('Kalender-Eintrag wurde nicht gefunden.');
    return null;
  }

  const leadName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Lead';
  const leadUrl = `${getClientOrigin()}/dashboard/leads/${query.leadId}`;
  return {
    leadId: query.leadId,
    leadName,
    followUpAt: row.follow_up_at,
    phone: row.phone || '',
    leadUrl,
  };
}

function formatWhen(value) {
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

function isAppleDevice(ua) {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|Firefox|Edg/.test(ua));
}

function isWindows(ua) {
  return /Windows/i.test(ua);
}

function appleCalendarPage({
  leadName,
  followUpAt,
  phone,
  leadUrl,
  icsUrl,
  webcalUrl,
  googleUrl,
  outlookUrl,
  appUrl,
  appleDevice,
  windows,
}) {
  const whenLabel = formatWhen(followUpAt);
  const year = new Date().getFullYear();
  const heading = windows
    ? 'Apple Kalender gibt es nur auf iPhone und Mac'
    : 'Zu Apple Kalender hinzufügen';
  const lede = windows
    ? 'An diesem Windows-PC kann Apple Kalender nicht geöffnet werden. Öffnen Sie dieselbe E-Mail auf dem iPhone. Die VANTARO-App legt den Termin mit EventKit direkt in Ihren Kalender.'
    : 'Die VANTARO-App speichert den Termin direkt in Apple Kalender. Tippen Sie auf den Button und erlauben Sie den Kalender-Zugriff.';

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Wiedervorlage in Apple Kalender</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>
      :root { color-scheme: light; }
      body { margin: 0; background: #ffffff; color: #101827; font-family: 'DM Sans', Arial, sans-serif; }
      .top { background: #070b14; padding: 22px 24px; text-align: center; }
      .wrap { max-width: 520px; margin: 0 auto; padding: 36px 24px 48px; }
      h1 { margin: 0 0 12px; font-family: 'Space Grotesk', Arial, sans-serif; font-size: 28px; letter-spacing: -.04em; }
      .lede { margin: 0 0 28px; font-size: 16px; line-height: 1.6; color: #3d4b5c; }
      .card { border: 1px solid #e6e8eb; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
      .label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #8b9aaa; margin: 0 0 6px; }
      .value { font-family: 'Space Grotesk', Arial, sans-serif; font-size: 18px; font-weight: 600; margin: 0 0 16px; }
      .card .value:last-child { margin-bottom: 0; }
      .btn { display: flex; align-items: center; justify-content: center; gap: 8px; text-align: center; background: #ffffff; color: #101827; text-decoration: none; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; font-weight: 500; border: 1px solid #d8dee6; border-radius: 10px; padding: 12px 22px; }
      .btn svg { flex: none; }
      .btn.primary { background: #101827; color: #ffffff; border-color: #101827; }
      .btn + .btn { margin-top: 10px; }
      .hint { margin: 18px 0 0; font-size: 13px; line-height: 1.6; color: #8b9aaa; }
      .foot { margin-top: 36px; padding-top: 24px; border-top: 1px solid #e6e8eb; text-align: center; font-size: 12px; color: #8b9aaa; }
    </style>
  </head>
  <body>
    <div class="top"><img src="${getClientOrigin()}/wordmark.png" width="168" height="18" alt="VANTARO" style="display:block;margin:0 auto;width:168px;height:18px;border:0;" /></div>
    <div class="wrap">
      <h1>${heading}</h1>
      <p class="lede">${lede}</p>
      <div class="card">
        <p class="label">Titel</p>
        <p class="value">Wiedervorlage: ${escapeHtml(leadName)}</p>
        <p class="label">Datum und Uhrzeit</p>
        <p class="value">${escapeHtml(whenLabel)}</p>
        <p class="label">Telefon</p>
        <p class="value">${escapeHtml(phone || 'Nicht hinterlegt')}</p>
      </div>
      ${windows ? `
      <a class="btn" href="${escapeHtml(googleUrl)}">${GOOGLE_ICON}<span>Google</span></a>
      <a class="btn" href="${escapeHtml(outlookUrl)}">${OUTLOOK_ICON}<span>Outlook</span></a>
      <p class="hint">Auf dem iPhone öffnet Apple Kalender über die VANTARO-App.</p>
      ` : `
      <a class="btn primary" id="apple-open" href="${escapeHtml(appUrl)}">${APPLE_ICON}<span>Apple</span></a>
      <a class="btn" href="${escapeHtml(googleUrl)}">${GOOGLE_ICON}<span>Google</span></a>
      <a class="btn" href="${escapeHtml(outlookUrl)}">${OUTLOOK_ICON}<span>Outlook</span></a>
      <p class="hint">Die VANTARO-App muss auf diesem iPhone installiert sein (Xcode → Run). Beim ersten Mal Kalender-Zugriff erlauben.</p>
      <script>
        (function () {
          var appUrl = ${JSON.stringify(appUrl)};
          var icsUrl = ${JSON.stringify(icsUrl)};
          var webcalUrl = ${JSON.stringify(webcalUrl)};
          var btn = document.getElementById('apple-open');
          if (${appleDevice ? 'true' : 'false'}) {
            window.setTimeout(function () { window.location.href = appUrl; }, 200);
          }
          if (!btn) return;
          btn.addEventListener('click', function (event) {
            event.preventDefault();
            window.location.href = appUrl;
            window.setTimeout(function () { window.location.href = webcalUrl; }, 800);
            window.setTimeout(function () { window.location.href = icsUrl; }, 1400);
          });
        })();
      </script>
      `}
      <p class="hint"><a href="${escapeHtml(leadUrl)}" style="color:#101827;font-weight:700;">Lead in VANTARO öffnen</a></p>
      <p class="foot">© ${year} VANTARO. Alle Rechte vorbehalten.</p>
    </div>
  </body>
</html>`;
}

router.get('/wiedervorlage', async (req, res) => {
  try {
    const event = await requireFollowUp(req, res);
    if (!event) return;

    const title = `Wiedervorlage: ${event.leadName}`;
    const details = [
      `Wiedervorlage für ${event.leadName}`,
      event.phone ? `Telefon: ${event.phone}` : '',
      event.leadUrl,
    ].filter(Boolean).join('\n');

    const ua = String(req.get('user-agent') || '');
    res
      .type('html')
      .send(appleCalendarPage({
        ...event,
        icsUrl: followUpIcsUrl(event.leadId, event.followUpAt),
        webcalUrl: followUpWebcalUrl(event.leadId, event.followUpAt),
        appUrl: followUpAppUrl(event.leadId, event.followUpAt),
        googleUrl: googleCalendarUrl({
          title,
          details,
          startAt: event.followUpAt,
        }),
        outlookUrl: outlookCalendarUrl({
          title,
          details,
          startAt: event.followUpAt,
        }),
        appleDevice: isAppleDevice(ua),
        windows: isWindows(ua),
      }));
  } catch (error) {
    console.error('Wiedervorlage calendar page failed:', error.message);
    res.status(500).type('text').send('Kalender-Eintrag konnte nicht erstellt werden.');
  }
});

router.get('/wiedervorlage.json', async (req, res) => {
  try {
    const query = loadFollowUp(req);
    if (!query) {
      return res.status(404).json({ error: 'Kalender-Eintrag wurde nicht gefunden.' });
    }

    const row = await getLeadById(query.leadId);
    if (!row || row.contact_status !== 'wiedervorlage' || !row.follow_up_at) {
      return res.status(404).json({ error: 'Kalender-Eintrag wurde nicht gefunden.' });
    }

    const stored = new Date(row.follow_up_at).toISOString();
    const requested = new Date(query.at).toISOString();
    if (stored !== requested) {
      return res.status(404).json({ error: 'Kalender-Eintrag wurde nicht gefunden.' });
    }

    const leadName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Lead';
    res.json({
      event: toFollowUpEventJson({
        leadId: query.leadId,
        leadName,
        followUpAt: row.follow_up_at,
        phone: row.phone || '',
        leadUrl: `${getClientOrigin()}/dashboard/leads/${query.leadId}`,
      }),
    });
  } catch (error) {
    console.error('Wiedervorlage JSON failed:', error.message);
    res.status(500).json({ error: 'Kalender-Eintrag konnte nicht geladen werden.' });
  }
});

router.get('/wiedervorlage.ics', async (req, res) => {
  try {
    const event = await requireFollowUp(req, res);
    if (!event) return;

    const ics = buildFollowUpIcs(event);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8; method=PUBLISH');
    res.setHeader('Content-Disposition', 'inline; filename="Wiedervorlage.ics"');
    res.send(ics);
  } catch (error) {
    console.error('Wiedervorlage ICS failed:', error.message);
    res.status(500).type('text').send('Kalender-Eintrag konnte nicht erstellt werden.');
  }
});

export default router;
