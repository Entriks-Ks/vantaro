import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Database, Link2Off, Link, Play, PlugZap, RefreshCw } from 'lucide-react';
import { api } from './api';
import { L } from './i18n';
import { Banner, Button, Card, Chip, ErrorBanner, KeyValue, Loading, Page, useActionDialog, useApi, useToast } from './ui';

const STATUS_TONE = { ok: 'ok', warning: 'warn', error: 'error', off: 'neutral' };
const statusText = (status) => ({
  ok: L('In Ordnung', 'OK'),
  warning: L('Prüfen', 'Check'),
  error: L('Gestört', 'Down'),
  off: L('Nicht eingerichtet', 'Not set up'),
}[status] || L('Nicht eingerichtet', 'Not set up'));

function IntegrationCard({ integration, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const dialog = useActionDialog();
  const toast = useToast();
  const tone = STATUS_TONE[integration.status] || 'neutral';

  const runTest = async (kind) => {
    setBusy(kind);
    setResult(null);
    try {
      const response = await api.post(`/integrations/${integration.id}/test`);
      setResult(response);
      if (kind === 'run') toast(response.message, response.ok ? 'ok' : 'error');
      onChanged();
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(null);
    }
  };

  const subscribe = () => dialog.open({
    title: L('TC-Dial Webhook registrieren', 'Register TC-Dial webhook'),
    effects: [
      L(
        'Bei TC-Dial wird der Webhook „agent-set-disposition“ auf die VANTARO-URL registriert.',
        'The "agent-set-disposition" webhook is registered with TC-Dial for the VANTARO URL.',
      ),
      L(
        'Neue Dispositionen aus dem Callcenter kommen danach automatisch als Leads an.',
        'New dispositions from the call centre then arrive automatically as leads.',
      ),
    ],
    reason: 'optional',
    confirmLabel: L('Registrieren', 'Register'),
    success: L('Webhook registriert.', 'Webhook registered.'),
    onConfirm: async () => {
      await api.post('/integrations/tcdial/subscribe');
      onChanged();
    },
  });

  const unsubscribe = () => dialog.open({
    title: L('TC-Dial Webhook abmelden', 'Unsubscribe TC-Dial webhook'),
    tone: 'danger',
    effects: [L(
      'TC-Dial sendet danach keine Leads mehr an VANTARO, bis der Webhook neu registriert wird.',
      'TC-Dial then stops sending leads to VANTARO until the webhook is registered again.',
    )],
    reason: 'required',
    confirmLabel: L('Abmelden', 'Unsubscribe'),
    success: L('Webhook abgemeldet.', 'Webhook unsubscribed.'),
    onConfirm: async ({ reason }) => {
      await api.del('/integrations/tcdial/subscribe', { reason });
      onChanged();
    },
  });

  const actions = integration.actions || [];

  return (
    <section className={`its-integration is-${tone}`} id={integration.id}>
      <header>
        <span className="its-integration-icon" aria-hidden="true"><PlugZap size={18} /></span>
        <div>
          <h2>{integration.name}</h2>
          <p>{integration.purpose}</p>
        </div>
        <Chip tone={tone}>{statusText(integration.status)}</Chip>
      </header>
      <p className="its-integration-summary">{integration.summary}</p>
      {integration.details?.length ? <KeyValue items={integration.details} /> : null}
      {result ? <Banner tone={result.ok ? 'ok' : 'error'}>{result.message}</Banner> : null}
      {actions.length ? (
        <footer>
          {actions.includes('test') ? (
            <Button size="sm" icon={RefreshCw} loading={busy === 'test'} onClick={() => runTest('test')}>
              {integration.id === 'email' ? L('Test-E-Mail an mich', 'Send me a test email') : L('Verbindung testen', 'Test connection')}
            </Button>
          ) : null}
          {actions.includes('run') ? (
            <Button size="sm" icon={Play} loading={busy === 'run'} onClick={() => runTest('run')}>{L('Jetzt ausführen', 'Run now')}</Button>
          ) : null}
          {actions.includes('subscribe') ? <Button size="sm" icon={Link} onClick={subscribe}>{L('Webhook registrieren', 'Register webhook')}</Button> : null}
          {actions.includes('unsubscribe') ? <Button size="sm" tone="ghost" icon={Link2Off} onClick={unsubscribe}>{L('Webhook abmelden', 'Unsubscribe webhook')}</Button> : null}
        </footer>
      ) : null}
      {dialog.element}
    </section>
  );
}

function SchemaCard() {
  const { data, error, loading, reload } = useApi('/integrations/schema');
  const missing = (data?.scripts || []).filter((script) => !script.ok);
  return (
    <Card
      title={L('Datenbank-Schema', 'Database schema')}
      description={L(
        'Prüft, ob alle SQL-Skripte aus server/supabase im aktuellen Supabase-Projekt ausgeführt wurden.',
        'Checks whether every SQL script from server/supabase has been run in the current Supabase project.',
      )}
      actions={<Button size="sm" icon={RefreshCw} loading={loading} onClick={reload}>{L('Erneut prüfen', 'Check again')}</Button>}
      className="its-schema"
    >
      <div id="schema" />
      <ErrorBanner error={error} onRetry={reload} />
      {!data && loading ? <Loading label={L('Schema wird geprüft …', 'Checking schema …')} /> : null}
      {data ? (
        missing.length ? (
          <Banner tone="warn">
            {L(
              <>
                <strong>{missing.length} Skript(e) fehlen.</strong> Ein Entwickler oder Admin muss sie im Supabase SQL Editor ausführen
                (Reihenfolge siehe README). Bis dahin schlagen die betroffenen Funktionen mit „Tabelle/Spalte fehlt“ fehl.
              </>,
              <>
                <strong>{missing.length} script(s) missing.</strong> A developer or admin has to run them in the Supabase SQL Editor
                (order: see README). Until then the affected features fail with "table/column missing".
              </>,
            )}
          </Banner>
        ) : <Banner tone="ok">{L('Alle Skripte sind ausgeführt – das Schema ist vollständig.', 'All scripts have been run – the schema is complete.')}</Banner>
      ) : null}
      {data ? (
        <ul className="its-schema-list">
          {data.scripts.map((script) => (
            <li key={script.file} className={script.ok ? 'is-ok' : 'is-missing'}>
              <Database size={14} aria-hidden="true" />
              <code>{script.file}</code>
              {script.ok ? <Chip tone="ok">{L('vorhanden', 'present')}</Chip> : <Chip tone="error">{L('fehlt', 'missing')}</Chip>}
              {!script.ok ? <small>{script.missing.join(', ')}</small> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export default function IntegrationsPage({ onChanged }) {
  const { data, error, loading, reload } = useApi('/integrations');
  const location = useLocation();

  useEffect(() => {
    if (!data || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [data, location.hash]);

  const changed = () => {
    reload();
    onChanged?.();
  };

  const env = data?.environment;
  const uptime = env ? `${Math.floor(env.uptimeSec / 3600)} h ${Math.floor((env.uptimeSec % 3600) / 60)} min` : '—';

  return (
    <Page
      title={L('Integrationen', 'Integrations')}
      description={L(
        'Status aller angebundenen Dienste, Webhooks und Hintergrund-Jobs – mit Test- und Reparaturfunktionen.',
        'Status of every connected service, webhook and background job – with test and repair functions.',
      )}
      actions={<Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button>}
    >
      <ErrorBanner error={error} onRetry={reload} />
      {!data && loading ? <Loading /> : null}
      {env ? (
        <Card title={L('Umgebung', 'Environment')}>
          <KeyValue items={[
            ['Frontend', env.frontend],
            ['API', env.api],
            [L('Laufzeit', 'Runtime'), `Node ${env.node} · ${env.deployed ? L('Produktion (Render)', 'Production (Render)') : L('lokal / Entwicklung', 'local / development')}`],
            [L('Server läuft seit', 'Server up for'), uptime],
          ]}
          />
        </Card>
      ) : null}
      <div className="its-integration-grid">
        {(data?.integrations || []).map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} onChanged={changed} />
        ))}
      </div>
      <SchemaCard />
    </Page>
  );
}
