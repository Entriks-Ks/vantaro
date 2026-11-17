import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  CircleCheck,
  CreditCard,
  ListChecks,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import ActivityTimeline, { targetPath } from './ActivityTimeline';
import { EVENT_SOURCE, label } from './format';
import { L } from './i18n';
import { Banner, Button, Card, Chip, EmptyState, ErrorBanner, Loading, Page, Stat, When } from './ui';

const STATUS_TONE = { ok: 'ok', warning: 'warn', error: 'error', off: 'neutral' };
const statusText = (status) => ({
  ok: L('In Ordnung', 'OK'),
  warning: L('Prüfen', 'Check'),
  error: L('Gestört', 'Down'),
  off: L('Nicht eingerichtet', 'Not set up'),
}[status]);
const SEVERITY_TONE = { error: 'error', warning: 'warn', info: 'info' };
const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

const APPOINTMENT_CHECKS = {
  appointment_reminder_missed: '/it-support/appointments?range=missed',
  follow_up_reminder_missed: '/it-support/appointments?range=missed',
};

function checkPath(check) {
  if (APPOINTMENT_CHECKS[check.id]) return APPOINTMENT_CHECKS[check.id];
  if (check.area === 'payments') return `/it-support/payments?problem=${check.id}`;
  return `/it-support/leads?problem=${check.id}`;
}

export default function Overview({ overview }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = overview;
  const title = L('Übersicht', 'Overview');

  if (!data && loading) return <Page title={title}><Loading /></Page>;

  const checks = (data?.checks || [])
    .filter((check) => check.count > 0)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count);
  const openProblems = checks.filter((check) => check.severity !== 'info').reduce((sum, check) => sum + check.count, 0);
  const brokenIntegrations = (data?.integrations || []).filter((entry) => entry.status === 'error');

  return (
    <Page
      title={title}
      description={L(
        'Systemzustand auf einen Blick: was gestört ist und was Aufmerksamkeit braucht.',
        'System health at a glance: what is broken and what needs attention.',
      )}
      actions={<Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button>}
    >
      <ErrorBanner error={error} onRetry={reload} />

      {data?.auditReady === false ? (
        <Banner tone="error">
          {L(
            <>
              <strong>Das Aktivitätsprotokoll ist noch nicht eingerichtet.</strong> Bitte <code>server/supabase/it_support.sql</code> im
              Supabase SQL Editor ausführen. Bis dahin sind alle Änderungen über diese Konsole gesperrt, damit jede Aktion nachvollziehbar bleibt.
            </>,
            <>
              <strong>The activity log is not set up yet.</strong> Please run <code>server/supabase/it_support.sql</code> in the
              Supabase SQL Editor. Until then, all changes through this console are blocked so every action stays traceable.
            </>,
          )}
        </Banner>
      ) : null}
      {data?.schema?.missingCount ? (
        <Banner
          tone="warn"
          action={<Button size="sm" onClick={() => navigate('/it-support/integrations#schema')}>{L('Details', 'Details')}</Button>}
        >
          {L(
            <><strong>{data.schema.missingCount} Datenbank-Skript(e) fehlen.</strong> Einige Funktionen der Plattform können dadurch fehlschlagen.</>,
            <><strong>{data.schema.missingCount} database script(s) missing.</strong> Some platform features may fail because of this.</>,
          )}
        </Banner>
      ) : null}

      <div className="its-stats">
        <Stat
          label={L('Offene Probleme', 'Open problems')}
          value={openProblems}
          tone={openProblems ? 'warn' : 'ok'}
          hint={openProblems ? L('aus der automatischen Datenprüfung', 'from the automatic data check') : L('Datenprüfung ohne Befund', 'Data check found nothing')}
          icon={TriangleAlert}
        />
        <Stat
          label={L('Systemfehler', 'System errors')}
          value={data?.errors ? data.errors.errors : '—'}
          tone={data?.errors?.errors ? 'error' : 'ok'}
          hint={data?.errors
            ? L(`${data.errors.warnings} Warnung(en) offen`, `${data.errors.warnings} open warning(s)`)
            : L('Fehlerprotokoll nicht verfügbar', 'Error log not available')}
          onClick={() => navigate('/it-support/errors')}
        />
        <Stat
          label={L('Leads im Pool', 'Leads in pool')}
          value={data?.totals?.poolLeads}
          hint={L(`von ${data?.totals?.leadTotal ?? '—'} Leads gesamt`, `of ${data?.totals?.leadTotal ?? '—'} leads in total`)}
          icon={ListChecks}
          onClick={() => navigate('/it-support/leads?assignment=unassigned')}
        />
        <Stat
          label={L('Anstehende Termine', 'Upcoming appointments')}
          value={data?.totals?.upcomingAppointments}
          hint={L('Termine & Wiedervorlagen', 'Appointments & follow-ups')}
          icon={CalendarClock}
          onClick={() => navigate('/it-support/appointments')}
        />
        <Stat
          label={L('Offene Zahlungen', 'Open payments')}
          value={data?.totals?.pendingPayments}
          hint={L('Checkout gestartet, nicht abgeschlossen', 'Checkout started, not completed')}
          icon={CreditCard}
          onClick={() => navigate('/it-support/payments?status=pending')}
        />
      </div>

      <div className="its-grid-2">
        <Card
          title={L('Braucht Aufmerksamkeit', 'Needs attention')}
          description={L('Automatische Datenprüfung über Leads, Termine und Zahlungen.', 'Automatic data check across leads, appointments and payments.')}
        >
          {checks.length ? (
            <ul className="its-issues">
              {checks.map((check) => (
                <li key={check.id}>
                  <button type="button" onClick={() => navigate(checkPath(check))}>
                    <Chip tone={SEVERITY_TONE[check.severity]}>{check.count}</Chip>
                    <span className="its-issue-text">
                      <strong>{check.label}</strong>
                      <small>{check.help}</small>
                    </span>
                    <em>{check.fixLabel ? L('Beheben', 'Fix') : L('Ansehen', 'View')}</em>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CircleCheck} title={L('Keine Auffälligkeiten', 'Nothing unusual')}>
              {L('Alle Datenprüfungen sind ohne Befund.', 'All data checks came back clean.')}
            </EmptyState>
          )}
        </Card>

        <Card
          title={L('Integrationen', 'Integrations')}
          description={brokenIntegrations.length
            ? L(`${brokenIntegrations.length} gestört`, `${brokenIntegrations.length} down`)
            : L('Externe Dienste und Hintergrund-Jobs', 'External services and background jobs')}
          actions={<Button size="sm" tone="ghost" onClick={() => navigate('/it-support/integrations')}>{L('Alle ansehen', 'View all')}</Button>}
        >
          <ul className="its-integrations-mini">
            {(data?.integrations || []).map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => navigate(`/it-support/integrations#${entry.id}`)}>
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{entry.summary}</small>
                  </span>
                  <Chip tone={STATUS_TONE[entry.status]}>{statusText(entry.status)}</Chip>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="its-grid-2">
        <Card
          title={L('Neueste Systemfehler', 'Latest system errors')}
          actions={<Button size="sm" tone="ghost" onClick={() => navigate('/it-support/errors')}>{L('Alle ansehen', 'View all')}</Button>}
        >
          {data?.errors === null ? (
            <p className="its-muted">
              {L('Fehlerprotokoll nicht verfügbar – ', 'Error log not available – run ')}
              <code>server/supabase/it_support.sql</code>
              {L(' ausführen.', '.')}
            </p>
          ) : (data?.errors?.recent || []).length ? (
            <ul className="its-error-mini">
              {data.errors.recent.map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => navigate(`/it-support/errors?id=${entry.id}`)}>
                    <Chip tone={entry.level === 'error' ? 'error' : 'warn'}>{label(EVENT_SOURCE, entry.source)}</Chip>
                    <span>{entry.message}</span>
                    <small>{entry.occurrences > 1 ? `${entry.occurrences}× · ` : ''}<When value={entry.lastSeenAt} /></small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CircleCheck} title={L('Keine offenen Fehler', 'No open errors')} />
          )}
        </Card>

        <Card
          title={L('Letzte Aktionen', 'Recent actions')}
          description={L('Was IT-Support zuletzt geändert hat', 'What IT Support changed recently')}
          actions={<Button size="sm" tone="ghost" onClick={() => navigate('/it-support/activity')}>{L('Protokoll', 'Log')}</Button>}
        >
          <ActivityTimeline
            entries={data?.activity || []}
            showTarget
            onOpenTarget={(entry) => {
              const path = targetPath(entry);
              if (path) navigate(path);
            }}
          />
        </Card>
      </div>
    </Page>
  );
}
