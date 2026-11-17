import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCheck, CircleCheck, ExternalLink, RefreshCw, RotateCcw } from 'lucide-react';
import { api } from './api';
import { EVENT_LEVEL, EVENT_SOURCE, formatDateTime, label, mapOptions } from './format';
import { L, pick } from './i18n';
import {
  ActionList,
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  Drawer,
  EmptyState,
  ErrorBanner,
  JsonBlock,
  KeyValue,
  Page,
  Pagination,
  SearchInput,
  Segmented,
  Select,
  Toolbar,
  useActionDialog,
  useApi,
  When,
} from './ui';

const LEVEL_TONE = { error: 'error', warning: 'warn', info: 'info' };

/** Where to look next for each area. */
const NEXT_STEP = {
  email: {
    text: [
      'E-Mail-Versand unter Integrationen prüfen (Resend-Key, verifizierte Absender-Domain) und eine Test-E-Mail senden.',
      'Check email sending under Integrations (Resend key, verified sender domain) and send a test email.',
    ],
    path: '/it-support/integrations#email',
  },
  tcdial: {
    text: ['TC-Dial unter Integrationen prüfen: Verbindung testen, Webhook ggf. neu registrieren.', 'Check TC-Dial under Integrations: test the connection and re-register the webhook if needed.'],
    path: '/it-support/integrations#tcdial',
  },
  payments: {
    text: ['Betroffene Zahlungen unter Zahlungen prüfen und ggf. mit der Bank abgleichen.', 'Check the affected payments under Payments and check them with the bank if needed.'],
    path: '/it-support/payments?problem=pending_stale',
  },
  reminders: {
    text: ['Erinnerungs-Job unter Integrationen prüfen und manuell ausführen.', 'Check the reminder job under Integrations and run it manually.'],
    path: '/it-support/integrations#reminders',
  },
  database: {
    text: ['Datenbank-Schema prüfen – häufig fehlt ein SQL-Skript.', 'Check the database schema – often an SQL script is missing.'],
    path: '/it-support/integrations#schema',
  },
  calendar: {
    text: ['Google-Kalender-Anbindung unter Integrationen prüfen.', 'Check the Google Calendar connection under Integrations.'],
    path: '/it-support/integrations#calendar',
  },
  auth: {
    text: ['Betroffenes Konto unter Nutzer suchen und Anmeldestatus prüfen.', 'Find the affected account under Users and check its sign-in status.'],
    path: '/it-support/users',
  },
  leads: {
    text: ['Leads mit Datenproblemen unter Leads → Filter „Problem“ prüfen.', 'Check leads with data problems under Leads → "Problem" filter.'],
    path: '/it-support/leads',
  },
  it_support: {
    text: [
      'Einmalige Fehler direkt nach einem Deploy oder SQL-Skript sind meist eine kurze Supabase-Unterbrechung – dann als erledigt markieren. Tritt der Fehler wieder auf, Route und Details an einen Entwickler geben.',
      'One-off errors right after a deploy or an SQL script are usually a short Supabase interruption – mark them as resolved. If the error comes back, pass the route and details to a developer.',
    ],
    path: '/it-support/integrations#supabase',
  },
};

function EventDrawer({ event, onClose, onChanged }) {
  const dialog = useActionDialog();
  const navigate = useNavigate();
  if (!event) return null;
  const next = NEXT_STEP[event.source];

  const actions = [
    next ? {
      id: 'next',
      icon: ExternalLink,
      label: L('Ursache prüfen', 'Check the cause'),
      description: pick(next.text),
      onClick: () => navigate(next.path),
    } : null,
    !event.resolvedAt ? {
      id: 'resolve',
      icon: CircleCheck,
      label: L('Als erledigt markieren', 'Mark as resolved'),
      description: L(
        'Die Meldung verschwindet aus der Liste der offenen Fehler. Tritt der Fehler erneut auf, erscheint er wieder.',
        'The message leaves the list of open errors. If the error happens again, it reappears.',
      ),
      onClick: () => dialog.open({
        title: L('Meldung als erledigt markieren', 'Mark message as resolved'),
        reason: 'optional',
        confirmLabel: L('Erledigt', 'Resolve'),
        success: L('Als erledigt markiert.', 'Marked as resolved.'),
        onConfirm: async ({ reason }) => {
          await api.post(`/system/errors/${event.id}/resolve`, { reason });
          onChanged();
          onClose();
        },
      }),
    } : {
      id: 'reopen',
      icon: RotateCcw,
      label: L('Wieder öffnen', 'Reopen'),
      description: L('Die Meldung erscheint wieder in der Liste der offenen Fehler.', 'The message shows up in the list of open errors again.'),
      onClick: async () => {
        await api.post(`/system/errors/${event.id}/reopen`);
        onChanged();
        onClose();
      },
    },
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title={label(EVENT_LEVEL, event.level)}
      subtitle={L(
        `${label(EVENT_SOURCE, event.source)} · ${event.occurrences}× aufgetreten`,
        `${label(EVENT_SOURCE, event.source)} · occurred ${event.occurrences}×`,
      )}
    >
      <div className="its-drawer-chips">
        <Chip tone={LEVEL_TONE[event.level]}>{label(EVENT_LEVEL, event.level)}</Chip>
        <Chip tone="neutral" icon={false}>{label(EVENT_SOURCE, event.source)}</Chip>
        {event.resolvedAt ? <Chip tone="ok">{L('Erledigt', 'Resolved')}</Chip> : null}
      </div>
      <pre className="its-message">{event.message}</pre>
      <KeyValue items={[
        [L('Häufigkeit', 'Occurrences'), `${event.occurrences}×`],
        [L('Erstmals', 'First seen'), formatDateTime(event.firstSeenAt)],
        [L('Zuletzt', 'Last seen'), formatDateTime(event.lastSeenAt)],
        event.resolvedAt ? [L('Erledigt', 'Resolved'), formatDateTime(event.resolvedAt)] : null,
        event.resolutionNote ? [L('Notiz', 'Note'), event.resolutionNote] : null,
      ]}
      />
      {event.context && Object.keys(event.context).length ? (
        <>
          <h3 className="its-subhead">{L('Technische Details', 'Technical details')}</h3>
          <JsonBlock value={event.context} />
        </>
      ) : null}
      <h3 className="its-subhead">{L('Aktionen', 'Actions')}</h3>
      <ActionList actions={actions} />
      {dialog.element}
    </Drawer>
  );
}

export default function SystemErrorsPage({ onChanged }) {
  const [params, setParams] = useSearchParams();
  const filters = {
    state: params.get('state') || 'open',
    level: params.get('level') || 'problems',
    source: params.get('source') || '',
    q: params.get('q') || '',
    page: Number(params.get('page')) || 1,
  };
  const openId = params.get('id');
  const { data, error, loading, reload } = useApi('/system/errors', { ...filters, limit: 30 });
  const dialog = useActionDialog();
  const counts = data?.counts || {};

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in patch) && !('id' in patch)) next.delete('page');
    setParams(next, { replace: !('id' in patch) });
  };

  const changed = useCallback(() => {
    reload();
    onChanged?.();
  }, [reload, onChanged]);

  const specificLevel = ['error', 'warning', 'info'].includes(filters.level);
  const resolveAll = () => dialog.open({
    title: L('Offene Meldungen als erledigt markieren', 'Mark open messages as resolved'),
    effects: [
      L(
        `Betroffen: ${filters.source ? label(EVENT_SOURCE, filters.source) : 'alle Bereiche'}, ${specificLevel ? label(EVENT_LEVEL, filters.level) : 'alle Stufen'}.`,
        `Affects: ${filters.source ? label(EVENT_SOURCE, filters.source) : 'all areas'}, ${specificLevel ? label(EVENT_LEVEL, filters.level) : 'all levels'}.`,
      ),
      L('Treten die Fehler erneut auf, erscheinen sie wieder als offen.', 'If the errors happen again, they show up as open again.'),
    ],
    reason: 'optional',
    confirmLabel: L('Alle erledigen', 'Resolve all'),
    success: (result) => L(`${result?.resolved ?? 0} Meldung(en) erledigt.`, `${result?.resolved ?? 0} message(s) resolved.`),
    onConfirm: async ({ reason }) => {
      const result = await api.post('/system/errors/resolve-all', {
        reason,
        source: filters.source || undefined,
        level: specificLevel ? filters.level : undefined,
      });
      changed();
      return result;
    },
  });

  const openEvent = (data?.events || []).find((event) => event.id === openId) || null;

  const columns = [
    { key: 'level', label: L('Stufe', 'Level'), render: (event) => <Chip tone={LEVEL_TONE[event.level]}>{label(EVENT_LEVEL, event.level)}</Chip> },
    { key: 'source', label: L('Bereich', 'Area'), render: (event) => label(EVENT_SOURCE, event.source) },
    { key: 'message', label: L('Meldung', 'Message'), className: 'is-message', render: (event) => <span className="its-clamp">{event.message}</span> },
    { key: 'count', label: L('Anzahl', 'Count'), className: 'is-num', render: (event) => `${event.occurrences}×` },
    { key: 'last', label: L('Zuletzt', 'Last seen'), render: (event) => <When value={event.lastSeenAt} /> },
  ];

  const sources = Object.entries(counts.bySource || {}).sort((a, b) => b[1] - a[1]);

  return (
    <Page
      title={L('Systemfehler', 'System errors')}
      description={L(
        'Fehler, Warnungen und Ereignisse des Servers – automatisch erfasst, gruppiert und mit Hinweis auf die Ursache.',
        'Server errors, warnings and events – captured automatically, grouped, and with a hint to the cause.',
      )}
      actions={(
        <>
          {filters.state === 'open' && data?.events?.length
            ? <Button icon={CheckCheck} onClick={resolveAll}>{L('Alle erledigen', 'Resolve all')}</Button>
            : null}
          <Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button>
        </>
      )}
    >
      {data?.missingTable ? (
        <Banner tone="error">
          {L('Das Fehlerprotokoll ist noch nicht eingerichtet. Bitte ', 'The error log is not set up yet. Please run ')}
          <code>server/supabase/it_support.sql</code>
          {L(' im Supabase SQL Editor ausführen.', ' in the Supabase SQL Editor.')}
        </Banner>
      ) : null}
      {sources.length ? (
        <div className="its-source-chips">
          <span>{L('Offene Probleme nach Bereich:', 'Open problems by area:')}</span>
          {sources.map(([source, count]) => (
            <button key={source} type="button" className={filters.source === source ? 'is-active' : undefined} onClick={() => update({ source: filters.source === source ? '' : source })}>
              {label(EVENT_SOURCE, source)} <em>{count}</em>
            </button>
          ))}
        </div>
      ) : null}
      <Toolbar>
        <Segmented
          value={filters.state}
          onChange={(state) => update({ state })}
          options={[
            { value: 'open', label: L('Offen', 'Open'), count: counts.open },
            { value: 'resolved', label: L('Erledigt', 'Resolved') },
            { value: 'all', label: L('Alle', 'All') },
          ]}
        />
        <Select
          label={L('Stufe', 'Level')}
          value={filters.level}
          onChange={(level) => update({ level })}
          options={[
            { value: 'problems', label: L('Fehler & Warnungen', 'Errors & warnings') },
            { value: 'error', label: L('Nur Fehler', 'Errors only') },
            { value: 'warning', label: L('Nur Warnungen', 'Warnings only') },
            { value: 'info', label: L('Info (z. B. Webhooks)', 'Info (e.g. webhooks)') },
            { value: 'all', label: L('Alle', 'All') },
          ]}
        />
        <Select
          label={L('Bereich', 'Area')}
          value={filters.source}
          onChange={(source) => update({ source })}
          options={mapOptions(EVENT_SOURCE, L('Alle', 'All'))}
        />
        <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder={L('Meldung durchsuchen …', 'Search messages …')} />
      </Toolbar>
      <ErrorBanner error={error} onRetry={reload} />
      <Card flush>
        <DataTable
          columns={columns}
          rows={data?.events || []}
          loading={loading}
          onRowClick={(event) => update({ id: event.id })}
          activeKey={openId}
          empty={(
            <EmptyState title={filters.state === 'open' ? L('Keine offenen Meldungen', 'No open messages') : L('Keine Meldungen', 'No messages')}>
              {L('Neue Fehler erscheinen hier automatisch.', 'New errors appear here automatically.')}
            </EmptyState>
          )}
        />
        <Pagination page={filters.page} limit={data?.limit || 30} total={data?.total || 0} onPage={(page) => update({ page })} />
      </Card>
      {openEvent ? <EventDrawer event={openEvent} onClose={() => update({ id: '' })} onChanged={changed} /> : null}
      {dialog.element}
    </Page>
  );
}
