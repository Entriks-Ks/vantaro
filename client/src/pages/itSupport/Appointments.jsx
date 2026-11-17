import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BellRing, CalendarClock, CalendarX, ExternalLink, Play, RefreshCw } from 'lucide-react';
import { api } from './api';
import { CONTACT_STATUS, formatDateTime, formatRelative, label, toLocalInput, VERTICAL } from './format';
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
  KeyValue,
  Page,
  SearchInput,
  Segmented,
  Select,
  Toolbar,
  useActionDialog,
  useApi,
  useToast,
  When,
} from './ui';

const TYPE_LABEL = { termin: ['Termin', 'Appointment'], wiedervorlage: ['Wiedervorlage', 'Follow-up'] };

const REMINDER = {
  sent: { tone: 'ok', text: ['Gesendet', 'Sent'] },
  due: { tone: 'info', text: ['Wird gesendet', 'Sending soon'] },
  scheduled: { tone: 'neutral', text: ['Geplant', 'Scheduled'] },
  missed: { tone: 'error', text: ['Nicht gesendet', 'Not sent'] },
  no_berater: { tone: 'warn', text: ['Kein Berater', 'No advisor'] },
  inactive: { tone: 'neutral', text: ['—', '—'] },
};

function ReminderChip({ state }) {
  const entry = REMINDER[state] || REMINDER.inactive;
  return <Chip tone={entry.tone} icon={state !== 'inactive'}>{pick(entry.text)}</Chip>;
}

function AppointmentDrawer({ entry, onClose, onChanged }) {
  const dialog = useActionDialog();
  const navigate = useNavigate();
  if (!entry) return null;
  const typeLabel = pick(TYPE_LABEL[entry.type]);
  const lower = typeLabel.toLowerCase();

  const actions = [
    {
      id: 'move',
      icon: CalendarClock,
      label: entry.active ? L(`${typeLabel} verschieben`, `Move ${lower}`) : L(`${typeLabel} wieder aktivieren`, `Reactivate ${lower}`),
      description: entry.active
        ? L('Neues Datum setzen, z. B. wenn der Berater den falschen Tag eingetragen hat.', 'Set a new date, e.g. if the advisor entered the wrong day.')
        : L('Gesprächsstatus wieder auf diesen Eintrag setzen und Datum bestätigen.', 'Set the conversation status back to this entry and confirm the date.'),
      onClick: () => dialog.open({
        title: L(`${typeLabel} ändern`, `Change ${lower}`),
        description: L(`${entry.leadName} · bisher ${formatDateTime(entry.at)}`, `${entry.leadName} · currently ${formatDateTime(entry.at)}`),
        effects: [
          L(`Gesprächsstatus wird „${typeLabel}“, das Datum wird übernommen.`, `Conversation status becomes "${typeLabel}" and the date is saved.`),
          L('Erinnerungen werden für das neue Datum neu geplant.', 'Reminders are rescheduled for the new date.'),
          entry.vertical === 'energy'
            ? L('Ein verbundener Google Kalender des Partners wird aktualisiert.', 'A connected Google Calendar of the partner is updated.')
            : null,
        ].filter(Boolean),
        fields: [
          { name: 'at', label: L('Neues Datum & Uhrzeit', 'New date & time'), type: 'datetime-local', required: true },
          ...(entry.assignedTo ? [{
            name: 'notify',
            label: L('Berater informieren', 'Notify advisor'),
            type: 'checkbox',
            hint: L('E-Mail mit dem neuen Termin an den Berater senden.', 'Send the advisor an email with the new date.'),
          }] : []),
        ],
        initialValues: { at: toLocalInput(entry.at), notify: false },
        reason: 'optional',
        confirmLabel: L('Speichern', 'Save'),
        success: L(`${typeLabel} gespeichert.`, `${typeLabel} saved.`),
        onConfirm: async ({ reason, values }) => {
          await api.patch(`/appointments/${entry.leadId}`, {
            type: entry.type,
            at: new Date(values.at).toISOString(),
            notify: Boolean(values.notify),
            reason,
          });
          onChanged();
          onClose();
        },
      }),
    },
    {
      id: 'reminders',
      icon: BellRing,
      label: L('Erinnerungen erneut senden', 'Resend reminders'),
      description: L(
        'Versand-Markierung zurücksetzen. Der Job prüft beim nächsten Lauf neu, ob eine Erinnerung fällig ist.',
        'Reset the "sent" markers. The job checks again on its next run whether a reminder is due.',
      ),
      hidden: !entry.remindedAt && !entry.soonRemindedAt && entry.reminder !== 'missed',
      onClick: () => dialog.open({
        title: L('Erinnerungen zurücksetzen', 'Reset reminders'),
        effects: [
          L('Die Markierungen „1 Stunde vorher“ und „15 Minuten vorher“ werden gelöscht.', 'The "1 hour before" and "15 minutes before" markers are cleared.'),
          L(
            'Liegt der Termin noch in der Zukunft, wird die Erinnerung zum passenden Zeitpunkt erneut gesendet.',
            'If the date is still in the future, the reminder is sent again at the right time.',
          ),
          L('Für vergangene Termine wird keine Erinnerung mehr gesendet.', 'No reminder is sent for dates in the past.'),
        ],
        reason: 'optional',
        confirmLabel: L('Zurücksetzen', 'Reset'),
        success: L('Erinnerungen zurückgesetzt.', 'Reminders reset.'),
        onConfirm: async ({ reason }) => {
          await api.post(`/appointments/${entry.leadId}/reset-reminders`, { type: entry.type, reason });
          onChanged();
          onClose();
        },
      }),
    },
    {
      id: 'cancel',
      icon: CalendarX,
      tone: 'danger',
      label: L(`${typeLabel} entfernen`, `Remove ${lower}`),
      description: L(
        'Datum löschen, z. B. bei Testeinträgen oder doppelt angelegten Terminen.',
        'Delete the date, e.g. for test entries or duplicate appointments.',
      ),
      onClick: () => dialog.open({
        title: L(`${typeLabel} entfernen`, `Remove ${lower}`),
        tone: 'danger',
        effects: [
          L('Das Datum wird gelöscht, es werden keine Erinnerungen mehr verschickt.', 'The date is deleted and no more reminders are sent.'),
          entry.active
            ? L('Gesprächsstatus wird „Kontaktiert“.', 'Conversation status becomes "Contacted".')
            : L('Gesprächsstatus bleibt unverändert.', 'Conversation status stays unchanged.'),
          entry.vertical === 'energy'
            ? L('Ein verbundener Google-Kalender-Eintrag wird entfernt.', 'A connected Google Calendar event is removed.')
            : null,
        ].filter(Boolean),
        fields: entry.active && entry.assignedTo
          ? [{
            name: 'notify',
            label: L('Berater informieren', 'Notify advisor'),
            type: 'checkbox',
            hint: L('Absage per E-Mail an den Berater senden.', 'Send the advisor a cancellation email.'),
          }]
          : [],
        reason: 'required',
        confirmLabel: L('Entfernen', 'Remove'),
        success: L(`${typeLabel} entfernt.`, `${typeLabel} removed.`),
        onConfirm: async ({ reason, values }) => {
          await api.post(`/appointments/${entry.leadId}/cancel`, { type: entry.type, reason, notify: Boolean(values.notify) });
          onChanged();
          onClose();
        },
      }),
    },
    {
      id: 'lead',
      icon: ExternalLink,
      label: L('Lead öffnen', 'Open lead'),
      description: L('Alle Daten, Zuweisung und Verlauf des Leads ansehen.', 'See all data, assignment and history of the lead.'),
      onClick: () => navigate(`/it-support/leads?id=${entry.leadId}`),
    },
  ];

  return (
    <Drawer open onClose={onClose} title={`${typeLabel}: ${entry.leadName}`} subtitle={formatDateTime(entry.at)}>
      <div className="its-drawer-chips">
        <Chip tone={entry.active ? 'info' : 'neutral'}>{entry.active ? L('Aktiv', 'Active') : L('Veraltet', 'Stale')}</Chip>
        <ReminderChip state={entry.reminder} />
      </div>
      {entry.stale ? (
        <Banner tone="warn">
          {L(
            `Der Lead steht auf „${label(CONTACT_STATUS, entry.contactStatus)}“, dieses Datum ist also nicht mehr aktiv. Es erscheint in keinem Kalender – entfernen, falls es nicht mehr gebraucht wird.`,
            `The lead's status is "${label(CONTACT_STATUS, entry.contactStatus)}", so this date is no longer active. It appears in no calendar – remove it if it is no longer needed.`,
          )}
        </Banner>
      ) : null}
      {entry.reminder === 'missed' ? (
        <Banner tone="error">
          {L(
            'Die Erinnerung an den Berater wurde nie versendet. Prüfen Sie unter „Integrationen“ den E-Mail-Versand und den Erinnerungs-Job.',
            'The reminder to the advisor was never sent. Check email sending and the reminder job under "Integrations".',
          )}
        </Banner>
      ) : null}
      <KeyValue items={[
        [L('Wann', 'When'), `${formatDateTime(entry.at)} (${formatRelative(entry.at)})`],
        ['Lead', entry.leadName],
        [L('Telefon', 'Phone'), entry.leadPhone],
        [L('Ort', 'City'), entry.leadCity],
        [L('Bereich', 'Area'), label(VERTICAL, entry.vertical)],
        [L('Berater', 'Advisor'), entry.assignedTo ? `${entry.assignedToName || '—'} (${entry.assignedToEmail || ''})` : L('nicht zugewiesen', 'not assigned')],
        [L('Erinnerung 1 h vorher', 'Reminder 1 h before'), entry.remindedAt ? formatDateTime(entry.remindedAt) : L('nicht gesendet', 'not sent')],
        [L('Erinnerung 15 min vorher', 'Reminder 15 min before'), entry.soonRemindedAt ? formatDateTime(entry.soonRemindedAt) : L('nicht gesendet', 'not sent')],
        entry.calendarSyncStatus ? ['Google Calendar', entry.calendarSyncStatus] : null,
      ]}
      />
      <h3 className="its-subhead">{L('Aktionen', 'Actions')}</h3>
      <ActionList actions={actions} />
      {dialog.element}
    </Drawer>
  );
}

export default function AppointmentsPage({ onChanged }) {
  const [params, setParams] = useSearchParams();
  const range = params.get('range') || 'upcoming';
  const type = params.get('type') || 'all';
  const q = params.get('q') || '';
  const [openKey, setOpenKey] = useState(null);
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const { data, error, loading, reload } = useApi('/appointments', { range, type, q });

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const changed = useCallback(() => {
    reload();
    onChanged?.();
  }, [reload, onChanged]);

  const runJob = async () => {
    setRunning(true);
    try {
      const { result } = await api.post('/appointments/run-reminders');
      toast(
        result.busy
          ? L('Der Job läuft bereits.', 'The job is already running.')
          : (result.error
            ? L(`Fehler: ${result.error}`, `Error: ${result.error}`)
            : L(`${result.sent || 0} Erinnerung(en) gesendet.`, `${result.sent || 0} reminder(s) sent.`)),
        result.error ? 'error' : 'ok',
      );
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const counts = data?.counts || {};
  const job = data?.job;
  const openEntry = (data?.appointments || []).find((entry) => entry.key === openKey) || null;

  const columns = [
    {
      key: 'at',
      label: L('Wann', 'When'),
      render: (entry) => (
        <div className="its-cell-main">
          <strong>{formatDateTime(entry.at)}</strong>
          <small><When value={entry.at} /></small>
        </div>
      ),
    },
    { key: 'type', label: L('Art', 'Type'), render: (entry) => <Chip tone={entry.type === 'termin' ? 'info' : 'neutral'} icon={false}>{pick(TYPE_LABEL[entry.type])}</Chip> },
    {
      key: 'lead',
      label: 'Lead',
      render: (entry) => (
        <div className="its-cell-main">
          <strong>{entry.leadName}</strong>
          <small>{entry.leadPhone || entry.leadCity || '—'}</small>
        </div>
      ),
    },
    { key: 'berater', label: L('Berater', 'Advisor'), render: (entry) => entry.assignedToName || entry.assignedToEmail || <span className="its-muted">—</span> },
    { key: 'reminder', label: L('Erinnerung', 'Reminder'), render: (entry) => <ReminderChip state={entry.reminder} /> },
    {
      key: 'state',
      label: L('Zustand', 'State'),
      render: (entry) => (entry.stale
        ? <Chip tone="warn">{L('Veraltet', 'Stale')}</Chip>
        : <Chip tone="ok" icon={false}>{L('Aktiv', 'Active')}</Chip>),
    },
  ];

  const lastRun = job?.lastRun;

  return (
    <Page
      title={L('Termine', 'Appointments')}
      description={L(
        'Termine und Wiedervorlagen aller Berater: Fehler korrigieren, Erinnerungen prüfen und Einträge zurücksetzen.',
        'Appointments and follow-ups of all advisors: correct errors, check reminders and reset entries.',
      )}
      actions={<Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button>}
    >
      {job ? (
        <Banner
          tone={!job.started || lastRun?.error ? 'error' : 'info'}
          action={<Button size="sm" icon={Play} loading={running} onClick={runJob}>{L('Jetzt ausführen', 'Run now')}</Button>}
        >
          <strong>{L('Erinnerungs-Job:', 'Reminder job:')}</strong>{' '}
          {job.started
            ? L(`läuft alle ${job.intervalSec} s`, `runs every ${job.intervalSec} s`)
            : L('läuft in diesem Server-Prozess nicht', 'is not running in this server process')}
          {lastRun
            ? L(
              ` · letzter Lauf ${formatDateTime(lastRun.at)}${lastRun.error ? ` – Fehler: ${lastRun.error}` : ` – ${lastRun.sent || 0} gesendet`}`,
              ` · last run ${formatDateTime(lastRun.at)}${lastRun.error ? ` – error: ${lastRun.error}` : ` – ${lastRun.sent || 0} sent`}`,
            )
            : ''}
        </Banner>
      ) : null}

      <Toolbar>
        <Segmented
          value={range}
          onChange={(value) => update({ range: value })}
          options={[
            { value: 'today', label: L('Heute', 'Today'), count: counts.today },
            { value: 'upcoming', label: L('Anstehend', 'Upcoming'), count: counts.upcoming },
            { value: 'past', label: L('Vergangen', 'Past') },
            { value: 'missed', label: L('Erinnerung fehlt', 'Reminder missing'), count: counts.missed, alert: true },
            { value: 'no_berater', label: L('Ohne Berater', 'No advisor'), count: counts.noBerater, alert: true },
            { value: 'stale', label: L('Veraltet', 'Stale'), count: counts.stale, alert: true },
            { value: 'all', label: L('Alle', 'All') },
          ]}
        />
      </Toolbar>
      <Toolbar>
        <SearchInput value={q} onChange={(value) => update({ q: value })} placeholder={L('Lead, E-Mail, Telefon, Ort …', 'Lead, email, phone, city …')} />
        <Select
          label={L('Art', 'Type')}
          value={type}
          onChange={(value) => update({ type: value === 'all' ? '' : value })}
          options={[
            { value: 'all', label: L('Alle', 'All') },
            { value: 'termin', label: L('Termine', 'Appointments') },
            { value: 'wiedervorlage', label: L('Wiedervorlagen', 'Follow-ups') },
          ]}
        />
      </Toolbar>

      <ErrorBanner error={error} onRetry={reload} />
      <Card flush>
        <DataTable
          columns={columns}
          rows={data?.appointments || []}
          rowKey={(entry) => entry.key}
          loading={loading}
          onRowClick={(entry) => setOpenKey(entry.key)}
          activeKey={openKey}
          empty={<EmptyState title={L('Keine Einträge in dieser Ansicht', 'No entries in this view')} />}
        />
        {data?.total > (data?.appointments || []).length ? (
          <div className="its-pager">
            <span>
              {L(
                `${data.appointments.length} von ${data.total} angezeigt – Suche verfeinern.`,
                `${data.appointments.length} of ${data.total} shown – refine the search.`,
              )}
            </span>
          </div>
        ) : null}
      </Card>
      {openEntry ? <AppointmentDrawer entry={openEntry} onClose={() => setOpenKey(null)} onChanged={changed} /> : null}
    </Page>
  );
}
