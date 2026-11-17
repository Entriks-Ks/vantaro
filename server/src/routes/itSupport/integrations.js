import { Router } from 'express';
import { pingDatabase, supabase, supabaseConfig } from '../../lib/supabase.js';
import { getProcreditConfig } from '../../lib/procredit.js';
import { classifyOrderStatus, getOrderDetails, isMockPayments, paymentProvider } from '../../lib/paymentGateway.js';
import { decryptSecret } from '../../lib/paymentCrypto.js';
import { hasCustomMailer, hasLeadsMailer, sendEnergyNoticeEmail } from '../../lib/mailer.js';
import { getTcDialConfig } from '../../lib/tcdial/config.js';
import {
  listTcDialWebhookChannels,
  subscribeAgentSetDisposition,
  unsubscribeAgentSetDisposition,
} from '../../lib/tcdial/client.js';
import { reminderJobState, tickFollowUpReminders } from '../../lib/followUpReminders.js';
import { getApiOrigin, getClientOrigin } from '../../lib/clientOrigin.js';
import { logItAction } from '../../lib/itSupportAudit.js';
import { fail, requireDb, route } from './common.js';
import { both, langOf, tr, translateMessage } from './i18n.js';

const router = Router();

/** Which SQL script creates which tables/columns. Used to tell IT Support exactly what to run. */
export const SCHEMA_SCRIPTS = [
  { file: 'leads.sql', checks: [['leads', ['id', 'first_name', 'last_name', 'status', 'assigned_to', 'source']]] },
  { file: 'lead_requests.sql', checks: [['lead_requests', ['id', 'berater_id', 'requested_count', 'status']], ['leads', ['request_id']]] },
  { file: 'lead_workflow.sql', checks: [['lead_complaints', ['id', 'reason', 'status', 'admin_note']], ['leads', ['broker_notes', 'refunded_at', 'reported_at']], ['lead_requests', ['lead_type', 'cancelled_at']]] },
  { file: 'lead_scope.sql', checks: [['leads', ['scope']], ['lead_requests', ['scope']]] },
  { file: 'lead_payments.sql', checks: [['lead_payments', ['id', 'invoice_number', 'gross_cents', 'status']]] },
  { file: 'lead_payments_procredit.sql', checks: [['lead_payments', ['pg_order_id', 'pg_order_password', 'pg_status', 'hpp_url', 'return_token']]] },
  { file: 'lead_payments_receipt.sql', checks: [['lead_payments', ['pg_approval_code', 'pg_tran_time', 'confirmation_sent_at']]] },
  { file: 'lead_payments_energy.sql', checks: [['lead_payments', ['territory', 'desired_timeframe']]] },
  { file: 'lead_follow_up.sql', checks: [['leads', ['contact_status', 'appointment_at', 'follow_up_at', 'follow_up_reminded_at']]] },
  { file: 'lead_schedule_remind.sql', checks: [['leads', ['appointment_reminded_at', 'appointment_soon_reminded_at', 'follow_up_soon_reminded_at']]] },
  { file: 'lead_close_outcome.sql', checks: [['leads', ['close_outcome']]] },
  { file: 'lead_external_id.sql', checks: [['leads', ['external_source', 'external_id']]] },
  { file: 'lead_request_code.sql', checks: [['lead_requests', ['code']]] },
  { file: 'lead_request_admin_seen.sql', checks: [['lead_requests', ['admin_seen_at']]] },
  { file: 'lead_request_fulfillment_mode.sql', checks: [['lead_requests', ['fulfillment_mode', 'auto_filled_at']]] },
  { file: 'lead_complaint_admin_seen.sql', checks: [['lead_complaints', ['admin_seen_at']]] },
  { file: 'lead_complaint_replacement.sql', checks: [['lead_complaints', ['replacement_lead_id']]] },
  { file: 'vertical.sql', checks: [['leads', ['vertical', 'energy_product', 'delivery_type']], ['lead_requests', ['vertical', 'territory']]] },
  { file: 'energy_portal.sql', checks: [['leads', ['energy_holder_id', 'calendar_sync_status', 'google_event_id']], ['energy_calendar_connections', ['user_id']], ['energy_complaints', ['id']], ['energy_delivery_lines', ['id']], ['energy_billing_profiles', ['company_id']]] },
  { file: 'berater_discounts.sql', checks: [['berater_discounts', ['id', 'berater_id']], ['lead_payments', ['list_cents', 'discount_cents', 'discount_snapshot']]] },
  { file: 'berater_discounts_expires.sql', checks: [['berater_discounts', ['expires_at']]] },
  { file: 'payment_audit_log.sql', checks: [['payment_audit_log', ['id', 'event', 'payment_id']]] },
  { file: 'it_support.sql', checks: [['it_support_audit_log', ['id', 'action', 'reason', 'summary_en']], ['system_events', ['id', 'occurrences', 'resolved_at']]] },
];

async function probe(table, columns, t) {
  const { error } = await supabase.from(table).select(columns.join(',')).limit(0);
  if (!error) return [];
  if (error.code === '42P01' || error.code === 'PGRST205' || /could not find the table|relation .* does not exist/i.test(error.message || '')) {
    return [t(`Tabelle ${table}`, `table ${table}`)];
  }
  const missing = [];
  await Promise.all(columns.map(async (column) => {
    const single = await supabase.from(table).select(column).limit(0);
    if (single.error) missing.push(`${table}.${column}`);
  }));
  return missing.length ? missing : [`${table}: ${error.message}`];
}

export async function checkSchema(lang = 'de') {
  if (!supabaseConfig.configured || !supabase) return { scripts: [], missingCount: 0 };
  const t = tr(lang);
  const scripts = await Promise.all(SCHEMA_SCRIPTS.map(async (script) => {
    const missing = (await Promise.all(script.checks.map(([table, columns]) => probe(table, columns, t)))).flat();
    return { file: `server/supabase/${script.file}`, ok: !missing.length, missing };
  }));
  return { scripts, missingCount: scripts.filter((script) => !script.ok).length };
}

function host(url) {
  try {
    return new URL(url).host;
  } catch {
    return url || '—';
  }
}

function when(value, lang) {
  return new Date(value).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', { timeZone: 'Europe/Berlin' });
}

async function lastEvent(source, level) {
  if (!supabase) return null;
  let query = supabase.from('system_events').select('message, occurrences, last_seen_at, level').eq('source', source);
  if (level) query = query.eq('level', level);
  const { data, error } = await query.order('last_seen_at', { ascending: false }).limit(1).maybeSingle();
  return error ? null : data;
}

async function openErrorCount(source) {
  if (!supabase) return 0;
  const { count, error } = await supabase.from('system_events').select('id', { count: 'exact', head: true })
    .eq('source', source).eq('level', 'error').is('resolved_at', null);
  return error ? 0 : count || 0;
}

async function supabaseIntegration(lang) {
  const t = tr(lang);
  const set = (value) => (value ? t('gesetzt', 'set') : t('fehlt', 'missing'));
  const start = Date.now();
  let reachable = false;
  let problem = null;
  try {
    await pingDatabase();
    reachable = true;
  } catch (error) {
    problem = error.message;
  }
  const latency = Date.now() - start;
  return {
    id: 'supabase',
    name: 'Supabase',
    purpose: t('Datenbank, Logins und Nutzerkonten', 'Database, sign-ins and user accounts'),
    status: !supabaseConfig.configured ? 'error' : (reachable ? 'ok' : 'error'),
    summary: !supabaseConfig.configured
      ? t('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.', 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing.')
      : (reachable ? t(`Erreichbar (${latency} ms)`, `Reachable (${latency} ms)`) : t(`Nicht erreichbar: ${problem}`, `Not reachable: ${problem}`)),
    details: [
      [t('Projekt', 'Project'), host(supabaseConfig.url)],
      ['Service role key', set(supabaseConfig.serviceRoleKey)],
      ['Anon key', set(supabaseConfig.anonKey)],
      [t('Antwortzeit', 'Response time'), reachable ? `${latency} ms` : '—'],
    ],
    actions: ['test'],
  };
}

async function procreditIntegration(lang) {
  const t = tr(lang);
  const config = getProcreditConfig();
  const provider = paymentProvider();
  const mock = isMockPayments();
  const encryption = Boolean(String(process.env.PAYMENT_ENCRYPTION_KEY || '').trim());
  let last = null;
  let failed24h = 0;
  let pending = 0;
  if (supabase) {
    const [{ data }, failed, open] = await Promise.all([
      supabase.from('lead_payments').select('status, created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('lead_payments').select('id', { count: 'exact', head: true }).eq('status', 'failed')
        .gt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
      supabase.from('lead_payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    last = data || null;
    failed24h = failed.count || 0;
    pending = open.count || 0;
  }
  const status = mock
    ? 'warning'
    : (!config.configured ? 'error' : ((!encryption || config.testMode) ? 'warning' : 'ok'));
  const summary = mock
    ? t('Mock-Zahlungen aktiv (nur Entwicklung, keine echte Bank).', 'Mock payments active (development only, no real bank).')
    : (!config.configured
      ? t(`Nicht eingerichtet: ${config.missing.join(', ')}`, `Not set up: ${config.missing.join(', ')}`)
      : (config.testMode ? t('Eingerichtet – Testmodus der Bank aktiv.', 'Set up – bank test mode is active.') : t('Eingerichtet – Live-Modus.', 'Set up – live mode.')));
  return {
    id: 'procredit',
    name: 'ProCredit Bank',
    purpose: t('Kartenzahlung für Lead-Pakete (Hosted Payment Page)', 'Card payments for lead packages (hosted payment page)'),
    status,
    summary,
    details: [
      [t('Anbieter', 'Provider'), provider === 'mock' ? t('Mock (lokal)', 'Mock (local)') : 'ProCredit'],
      [t('Modus', 'Mode'), config.testMode ? t('Test', 'Test') : 'Live'],
      [t('API-Host', 'API host'), host(config.apiBaseUrl)],
      ['Merchant ID', config.merchantId || '—'],
      [t('Zertifikate', 'Certificates'), config.hasCerts ? t('vorhanden', 'present') : t('fehlen', 'missing')],
      [t('Verschlüsselungsschlüssel', 'Encryption key'), encryption ? t('gesetzt', 'set') : t('fehlt', 'missing')],
      [t('Rückleitungs-URL', 'Return URL'), `${getApiOrigin().replace(/\/$/, '')}/api/payments/return`],
      [t('Offene Zahlungen', 'Open payments'), String(pending)],
      [t('Fehlgeschlagen (24 h)', 'Failed (24 h)'), String(failed24h)],
      [t('Letzte Zahlung', 'Latest payment'), last ? `${last.status} · ${when(last.created_at, lang)}` : '—'],
    ],
    actions: ['test'],
  };
}

async function emailIntegration(lang) {
  const t = tr(lang);
  const configured = hasCustomMailer();
  const leads = hasLeadsMailer();
  const openErrors = await openErrorCount('email');
  return {
    id: 'email',
    name: t('Resend (E-Mail)', 'Resend (email)'),
    purpose: t(
      'Bestätigungscodes, Passwort-Links, Zahlungsbelege, Termin-Erinnerungen',
      'Confirmation codes, password links, payment receipts, appointment reminders',
    ),
    status: !configured ? 'error' : (openErrors || !leads ? 'warning' : 'ok'),
    summary: !configured
      ? t('RESEND_API_KEY oder EMAIL_FROM fehlt – es werden keine E-Mails versendet.', 'RESEND_API_KEY or EMAIL_FROM is missing – no emails are sent.')
      : (openErrors
        ? t(`${openErrors} offene E-Mail-Fehler (siehe Systemfehler).`, `${openErrors} open email error(s) (see System errors).`)
        : (leads
          ? t('Versand eingerichtet.', 'Sending is set up.')
          : t('Lead-Absender (EMAIL_FROM_LEADS) fehlt – keine Termin-Erinnerungen.', 'Lead sender (EMAIL_FROM_LEADS) is missing – no appointment reminders.'))),
    details: [
      ['API key', process.env.RESEND_API_KEY?.trim() ? t('gesetzt', 'set') : t('fehlt', 'missing')],
      [t('Absender', 'Sender'), process.env.EMAIL_FROM?.trim() || '—'],
      [t('Lead-Absender', 'Lead sender'), process.env.EMAIL_FROM_LEADS?.trim() || (leads ? t('Standard', 'Default') : '—')],
      [t('Support-Postfach', 'Support inbox'), process.env.SUPPORT_EMAIL?.trim() || 'info@vantaro.io'],
      [t('Offene Fehler', 'Open errors'), String(openErrors)],
    ],
    actions: ['test'],
  };
}

async function tcdialIntegration(lang) {
  const t = tr(lang);
  const config = getTcDialConfig();
  const [received, openErrors] = await Promise.all([lastEvent('tcdial', 'info'), openErrorCount('tcdial')]);
  const status = !config.configured ? 'off' : (!config.webhookConfigured || openErrors ? 'warning' : 'ok');
  return {
    id: 'tcdial',
    name: 'TC-Dial',
    purpose: t('Lead-Import aus dem Callcenter per Webhook', 'Lead import from the call centre via webhook'),
    status,
    summary: !config.configured
      ? t('Nicht eingerichtet (TCDIAL_API_BASE_URL / TCDIAL_API_KEY).', 'Not set up (TCDIAL_API_BASE_URL / TCDIAL_API_KEY).')
      : (!config.webhookConfigured
        ? t('Webhook-Signaturprüfung nicht eingerichtet (TCDIAL_WEBHOOK_PUBLIC_KEY).', 'Webhook signature check not set up (TCDIAL_WEBHOOK_PUBLIC_KEY).')
        : (openErrors ? t(`${openErrors} offene Webhook-Fehler.`, `${openErrors} open webhook error(s).`) : t('Eingerichtet.', 'Set up.'))),
    details: [
      [t('API-Host', 'API host'), host(config.apiBaseUrl)],
      ['API key', config.apiKey ? t('gesetzt', 'set') : t('fehlt', 'missing')],
      ['Webhook URL', config.webhookUrl || `${getApiOrigin().replace(/\/$/, '')}/api/webhooks/tcdial/agent-set-disposition`],
      [t('Signaturprüfung', 'Signature check'), config.skipVerify
        ? t('AUS (TCDIAL_WEBHOOK_SKIP_VERIFY)', 'OFF (TCDIAL_WEBHOOK_SKIP_VERIFY)')
        : (config.webhookPublicKey ? t('aktiv', 'active') : t('fehlt', 'missing'))],
      [t('Status-Gruppen', 'Status groups'), config.callStatusGroups.join(', ') || '—'],
      [t('Kampagnen', 'Campaigns'), config.campaigns.join(', ') || t('alle', 'all')],
      [t('Webhooks empfangen', 'Webhooks received'), received
        ? t(`${received.occurrences}× · zuletzt ${when(received.last_seen_at, lang)}`, `${received.occurrences}× · last ${when(received.last_seen_at, lang)}`)
        : t('noch keine erfasst', 'none recorded yet')],
      [t('Offene Fehler', 'Open errors'), String(openErrors)],
    ],
    actions: config.configured ? ['test', 'subscribe', 'unsubscribe'] : [],
  };
}

async function calendarIntegration(lang) {
  const t = tr(lang);
  const configured = Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
  let connections = null;
  if (supabase) {
    const { count, error } = await supabase.from('energy_calendar_connections').select('user_id', { count: 'exact', head: true });
    connections = error ? null : count || 0;
  }
  const openErrors = await openErrorCount('calendar');
  return {
    id: 'calendar',
    name: t('Google Kalender', 'Google Calendar'),
    purpose: t('Termine der Energie-Partner im Google Kalender', 'Energy partners\' appointments in Google Calendar'),
    status: !configured ? 'off' : (openErrors ? 'warning' : 'ok'),
    summary: !configured
      ? t('Nicht eingerichtet (GOOGLE_CALENDAR_CLIENT_ID / _SECRET).', 'Not set up (GOOGLE_CALENDAR_CLIENT_ID / _SECRET).')
      : (openErrors ? t(`${openErrors} offene Kalender-Fehler.`, `${openErrors} open calendar error(s).`) : t('Eingerichtet.', 'Set up.')),
    details: [
      ['Client ID', process.env.GOOGLE_CALENDAR_CLIENT_ID ? t('gesetzt', 'set') : t('fehlt', 'missing')],
      ['Redirect URL', process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${getApiOrigin().replace(/\/$/, '')}/api/energy/calendar/callback`],
      [t('Verbundene Kalender', 'Connected calendars'), connections == null ? t('Tabelle fehlt (energy_portal.sql)', 'Table missing (energy_portal.sql)') : String(connections)],
      [t('Offene Fehler', 'Open errors'), String(openErrors)],
    ],
    actions: [],
  };
}

function remindersIntegration(lang) {
  const t = tr(lang);
  const job = reminderJobState();
  const lastRun = job.lastRun;
  const leadsMailer = hasLeadsMailer();
  const status = !job.started ? 'error' : (lastRun?.error ? 'error' : (!leadsMailer ? 'warning' : 'ok'));
  return {
    id: 'reminders',
    name: t('Erinnerungs-Job', 'Reminder job'),
    purpose: t('E-Mail-Erinnerungen an Berater vor Terminen und Wiedervorlagen', 'Email reminders to advisors before appointments and follow-ups'),
    status,
    summary: !job.started
      ? t('Job läuft nicht in diesem Server-Prozess.', 'The job is not running in this server process.')
      : (lastRun?.error
        ? t(`Letzter Lauf fehlgeschlagen: ${lastRun.error}`, `Last run failed: ${lastRun.error}`)
        : (!leadsMailer
          ? t('Läuft, aber ohne Lead-Mailer werden keine E-Mails versendet.', 'Running, but without a lead mailer no emails are sent.')
          : t(`Läuft alle ${job.intervalSec} s.`, `Runs every ${job.intervalSec} s.`))),
    details: [
      ['Status', job.running ? t('läuft gerade', 'running now') : (job.started ? t('aktiv', 'active') : t('gestoppt', 'stopped'))],
      [t('Intervall', 'Interval'), `${job.intervalSec} s`],
      [t('Letzter Lauf', 'Last run'), lastRun ? when(lastRun.at, lang) : t('seit Serverstart noch keiner', 'none since server start')],
      [t('Ergebnis', 'Result'), lastRun
        ? (lastRun.error
          ? t(`Fehler: ${lastRun.error}`, `Error: ${lastRun.error}`)
          : t(`${lastRun.sent || 0} gesendet, ${lastRun.skipped || 0} übersprungen`, `${lastRun.sent || 0} sent, ${lastRun.skipped || 0} skipped`))
        : '—'],
      [t('Externer Cron (CRON_SECRET)', 'External cron (CRON_SECRET)'), process.env.CRON_SECRET?.trim() ? t('eingerichtet', 'set up') : t('nicht eingerichtet', 'not set up')],
    ],
    actions: ['run'],
  };
}

export async function listIntegrations(lang = 'de') {
  const t = tr(lang);
  const builders = [
    ['supabase', 'Supabase', supabaseIntegration],
    ['procredit', 'ProCredit Bank', procreditIntegration],
    ['email', t('Resend (E-Mail)', 'Resend (email)'), emailIntegration],
    ['tcdial', 'TC-Dial', tcdialIntegration],
    ['calendar', t('Google Kalender', 'Google Calendar'), calendarIntegration],
    ['reminders', t('Erinnerungs-Job', 'Reminder job'), async (value) => remindersIntegration(value)],
  ];
  const results = await Promise.allSettled(builders.map(([, , build]) => build(lang)));
  return results.map((result, index) => (result.status === 'fulfilled'
    ? result.value
    : {
      id: builders[index][0],
      name: builders[index][1],
      status: 'error',
      summary: t(
        `Status konnte nicht ermittelt werden: ${result.reason?.message || result.reason}`,
        `Status could not be determined: ${result.reason?.message || result.reason}`,
      ),
      details: [],
      actions: [],
    }));
}

router.get('/', route(async (req, res) => {
  res.json({
    integrations: await listIntegrations(langOf(req)),
    environment: {
      frontend: getClientOrigin(),
      api: getApiOrigin(),
      node: process.version,
      deployed: process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER),
      uptimeSec: Math.round(process.uptime()),
    },
  });
}));

router.get('/schema', route(async (req, res) => {
  requireDb(req);
  res.json(await checkSchema(langOf(req)));
}));

/** Returns { ok, message: [German, English] }. */
async function runTest(id, req) {
  if (id === 'supabase') {
    const start = Date.now();
    await pingDatabase();
    const schema = await checkSchema();
    const ms = Date.now() - start;
    return {
      ok: !schema.missingCount,
      message: [
        `Datenbank erreichbar (${ms} ms). ${schema.missingCount ? `${schema.missingCount} SQL-Skript(e) fehlen.` : 'Schema vollständig.'}`,
        `Database reachable (${ms} ms). ${schema.missingCount ? `${schema.missingCount} SQL script(s) missing.` : 'Schema complete.'}`,
      ],
    };
  }
  if (id === 'procredit') {
    if (isMockPayments()) return { ok: true, message: ['Mock-Zahlungen aktiv – keine Bankverbindung nötig.', 'Mock payments active – no bank connection needed.'] };
    const config = getProcreditConfig();
    if (!config.configured) return { ok: false, message: [`Nicht eingerichtet: ${config.missing.join(', ')}`, `Not set up: ${config.missing.join(', ')}`] };
    const { data } = await supabase.from('lead_payments').select('id, invoice_number, pg_order_id, pg_order_password')
      .not('pg_order_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!data?.pg_order_password) {
      return {
        ok: true,
        message: [
          'Konfiguration vollständig. Noch keine Bestellung vorhanden, die zur Verbindungsprüfung abgefragt werden kann.',
          'Configuration complete. There is no order yet that could be queried to check the connection.',
        ],
      };
    }
    const order = await getOrderDetails(data.pg_order_id, decryptSecret(data.pg_order_password));
    const outcome = classifyOrderStatus(order);
    return {
      ok: true,
      message: [
        `Verbindung zur Bank funktioniert (Zertifikate gültig). Status der letzten Bestellung ${data.invoice_number}: ${outcome} (nur gelesen).`,
        `Connection to the bank works (certificates valid). Status of the latest order ${data.invoice_number}: ${outcome} (read only).`,
      ],
    };
  }
  if (id === 'email') {
    if (!hasCustomMailer()) return { ok: false, message: ['RESEND_API_KEY oder EMAIL_FROM fehlt.', 'RESEND_API_KEY or EMAIL_FROM is missing.'] };
    const en = langOf(req) === 'en';
    const sentAt = new Date().toLocaleString(en ? 'en-GB' : 'de-DE', { timeZone: 'Europe/Berlin' });
    await sendEnergyNoticeEmail({
      to: req.user.email,
      subject: en ? 'VANTARO IT Support: test email' : 'VANTARO IT-Support: Test-E-Mail',
      text: en
        ? `This test email was sent from the IT Support console on ${sentAt}. Sending email through Resend works.`
        : `Diese Test-E-Mail wurde am ${sentAt} aus der IT-Support-Konsole gesendet. Der E-Mail-Versand über Resend funktioniert.`,
    });
    return {
      ok: true,
      message: [
        `Test-E-Mail an ${req.user.email} gesendet. Bitte Posteingang (und Spam) prüfen.`,
        `Test email sent to ${req.user.email}. Please check the inbox (and spam).`,
      ],
    };
  }
  if (id === 'tcdial') {
    const channels = await listTcDialWebhookChannels();
    const list = Array.isArray(channels) ? channels : (channels?.data || channels?.channels || []);
    const count = Array.isArray(list) ? list.length : 0;
    return {
      ok: true,
      message: [`TC-Dial API erreichbar. ${count} Webhook-Kanal/Kanäle registriert.`, `TC-Dial API reachable. ${count} webhook channel(s) registered.`],
      data: channels,
    };
  }
  if (id === 'reminders') {
    const result = await tickFollowUpReminders();
    return {
      ok: !result.error,
      message: result.busy
        ? ['Der Job läuft gerade bereits.', 'The job is already running.']
        : (result.error
          ? [`Fehler: ${result.error}`, `Error: ${result.error}`]
          : [
            `${result.sent || 0} Erinnerung(en) gesendet, ${result.skipped || 0} übersprungen.`,
            `${result.sent || 0} reminder(s) sent, ${result.skipped || 0} skipped.`,
          ]),
    };
  }
  throw fail(tr(req)('Für diese Integration gibt es keinen Test.', 'There is no test for this integration.'), 404);
}

router.post('/:id/test', route(async (req, res) => {
  const id = String(req.params.id);
  const lang = langOf(req);
  let result;
  try {
    result = await runTest(id, req);
  } catch (error) {
    if (error.status === 404) throw error;
    console.error(`IT support integration test ${id} failed:`, error.message);
    const message = error.message || 'Test failed.';
    result = { ok: false, message: [message, translateMessage(message, 'en')] };
  }
  await logItAction(req, {
    action: id === 'reminders' ? 'reminders.run' : 'integration.test',
    targetType: 'integration',
    targetId: id,
    targetLabel: id,
    summary: both(
      `${result.ok ? 'Test erfolgreich' : 'Test fehlgeschlagen'}: ${result.message[0]}`,
      `${result.ok ? 'Test passed' : 'Test failed'}: ${result.message[1]}`,
    ),
  });
  res.json({ ...result, message: lang === 'en' ? result.message[1] : result.message[0] });
}));

router.post('/tcdial/subscribe', route(async (req, res) => {
  const subscription = await subscribeAgentSetDisposition({});
  await logItAction(req, {
    action: 'integration.tcdial_subscribe',
    targetType: 'integration',
    targetId: 'tcdial',
    targetLabel: 'TC-Dial',
    summary: both('Webhook „agent-set-disposition“ bei TC-Dial registriert', 'Webhook "agent-set-disposition" registered with TC-Dial'),
    after: { subscription },
  });
  res.json({ ok: true, subscription });
}));

router.delete('/tcdial/subscribe', route(async (req, res) => {
  const hookUrl = req.body?.hookUrl || undefined;
  await unsubscribeAgentSetDisposition(hookUrl);
  await logItAction(req, {
    action: 'integration.tcdial_unsubscribe',
    targetType: 'integration',
    targetId: 'tcdial',
    targetLabel: 'TC-Dial',
    reason: req.body?.reason || null,
    summary: both('Webhook „agent-set-disposition“ bei TC-Dial abgemeldet', 'Webhook "agent-set-disposition" unsubscribed from TC-Dial'),
  });
  res.json({ ok: true });
}));

export default router;
