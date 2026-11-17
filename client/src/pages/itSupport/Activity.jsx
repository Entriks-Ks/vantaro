import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import ActivityTimeline, { targetPath } from './ActivityTimeline';
import { label, TARGET_TYPE } from './format';
import { L, pick } from './i18n';
import { Banner, Button, Card, ErrorBanner, Loading, Page, Pagination, SearchInput, Select, Toolbar, useApi } from './ui';

const AREAS = [
  { value: '', label: ['Alle', 'All'] },
  { value: 'lead.', label: ['Leads', 'Leads'] },
  { value: 'appointment.', label: ['Termine', 'Appointments'] },
  { value: 'user.', label: ['Nutzer', 'Users'] },
  { value: 'payment.', label: ['Zahlungen', 'Payments'] },
  { value: 'integration.', label: ['Integrationen', 'Integrations'] },
  { value: 'reminders.', label: ['Erinnerungs-Job', 'Reminder job'] },
  { value: 'system_event.', label: ['Systemfehler', 'System errors'] },
];

const PERIODS = [
  { value: '', label: ['Gesamter Zeitraum', 'All time'] },
  { value: '1', label: ['Letzte 24 Stunden', 'Last 24 hours'] },
  { value: '7', label: ['Letzte 7 Tage', 'Last 7 days'] },
  { value: '30', label: ['Letzte 30 Tage', 'Last 30 days'] },
];

const asOptions = (list) => list.map((entry) => ({ value: entry.value, label: pick(entry.label) }));

export default function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = {
    q: params.get('q') || '',
    action: params.get('action') || '',
    actorId: params.get('actorId') || '',
    days: params.get('days') || '',
    targetType: params.get('targetType') || '',
    targetId: params.get('targetId') || '',
    page: Number(params.get('page')) || 1,
  };
  // Rounded to the hour so the request key stays stable between renders.
  const hour = 3600 * 1000;
  const since = filters.days
    ? new Date(Math.floor(Date.now() / hour) * hour - Number(filters.days) * 24 * hour).toISOString()
    : '';
  const { data, error, loading, reload } = useApi('/system/activity', {
    q: filters.q,
    action: filters.action,
    actorId: filters.actorId,
    targetType: filters.targetType,
    targetId: filters.targetId,
    since,
    page: filters.page,
    limit: 50,
  });

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <Page
      title={L('Aktivitätsprotokoll', 'Activity log')}
      description={L(
        'Jede Änderung über die IT-Support-Konsole – wer, wann, was, warum, mit Vorher- und Nachher-Werten. Einträge können nicht verändert werden.',
        'Every change made through the IT Support console – who, when, what and why, with before and after values. Entries cannot be changed.',
      )}
      actions={<Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button>}
    >
      {data?.missingTable ? (
        <Banner tone="error">
          {L('Das Aktivitätsprotokoll ist noch nicht eingerichtet. Bitte ', 'The activity log is not set up yet. Please run ')}
          <code>server/supabase/it_support.sql</code>
          {L(' im Supabase SQL Editor ausführen.', ' in the Supabase SQL Editor.')}
        </Banner>
      ) : null}
      <Toolbar>
        <SearchInput
          value={filters.q}
          onChange={(q) => update({ q })}
          placeholder={L('Zusammenfassung, Ziel, Begründung, Person …', 'Summary, target, reason, person …')}
        />
        <Select label={L('Bereich', 'Area')} value={filters.action} onChange={(action) => update({ action })} options={asOptions(AREAS)} />
        <Select
          label={L('Person', 'Person')}
          value={filters.actorId}
          onChange={(actorId) => update({ actorId })}
          options={[{ value: '', label: L('Alle', 'All') }, ...(data?.actors || []).map((actor) => ({ value: actor.id, label: actor.email }))]}
        />
        <Select label={L('Zeitraum', 'Period')} value={filters.days} onChange={(days) => update({ days })} options={asOptions(PERIODS)} />
      </Toolbar>
      {filters.targetId ? (
        <Banner
          tone="info"
          action={<Button size="sm" onClick={() => update({ targetId: '', targetType: '' })}>{L('Filter entfernen', 'Remove filter')}</Button>}
        >
          {L('Nur Einträge zu ', 'Only entries for ')}{label(TARGET_TYPE, filters.targetType, L('Ziel', 'target'))} <code>{filters.targetId}</code>.
        </Banner>
      ) : null}
      <ErrorBanner error={error} onRetry={reload} />
      <Card>
        {!data && loading ? <Loading /> : (
          <ActivityTimeline
            entries={data?.activity || []}
            showTarget
            onOpenTarget={(entry) => {
              const path = targetPath(entry);
              if (path) navigate(path);
            }}
            empty={L('Keine Einträge für diese Filter.', 'No entries for these filters.')}
          />
        )}
        <Pagination page={filters.page} limit={50} total={data?.total || 0} onPage={(page) => update({ page })} />
      </Card>
    </Page>
  );
}
