import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, ExternalLink, FilePlus2, RefreshCw, RotateCcw } from 'lucide-react';
import { api } from './api';
import ActivityTimeline from './ActivityTimeline';
import { formatDateTime, formatEuro, label, mapOptions, PAYMENT_EVENT, PAYMENT_STATUS, REQUEST_STATUS, SCOPE } from './format';
import { L, pick } from './i18n';
import {
  ActionList,
  Banner,
  Button,
  Card,
  Chip,
  CopyId,
  DataTable,
  Drawer,
  EmptyState,
  ErrorBanner,
  JsonBlock,
  KeyValue,
  Loading,
  Page,
  Pagination,
  SearchInput,
  Segmented,
  Select,
  Stat,
  Tabs,
  Toolbar,
  useActionDialog,
  useApi,
  When,
} from './ui';

const STATUS_TONE = { paid: 'ok', pending: 'info', failed: 'error', refunded: 'neutral' };

const FLAG = {
  pending_stale: {
    tone: 'warn',
    text: ['Hängt', 'Stuck'],
    help: [
      'Checkout seit über 30 Minuten offen – Bankseite geschlossen oder Rückleitung fehlgeschlagen.',
      'Checkout open for more than 30 minutes – bank page closed or the redirect back failed.',
    ],
  },
  paid_without_request: {
    tone: 'error',
    text: ['Auftrag fehlt', 'Order missing'],
    help: [
      'Bezahlt, aber es wurde kein Lead-Auftrag angelegt. Der Berater bekommt keine Leads.',
      'Paid, but no lead order was created. The advisor receives no leads.',
    ],
  },
};

function eventTone(event) {
  if (event === 'payment_paid') return 'ok';
  if (['payment_failed', 'suspicious_activity', 'return_invalid_token'].includes(event)) return 'error';
  return 'neutral';
}

function PaymentStatus({ payment }) {
  return (
    <div className="its-cell-chips">
      <Chip tone={STATUS_TONE[payment.status]}>{label(PAYMENT_STATUS, payment.status)}</Chip>
      {(payment.flags || []).map((flag) => <Chip key={flag} tone={FLAG[flag].tone} icon={false}>{pick(FLAG[flag].text)}</Chip>)}
      {payment.testMode ? <Chip tone="neutral" icon={false}>Test</Chip> : null}
    </div>
  );
}

function PaymentDrawer({ id, onClose, onChanged }) {
  const { data, error, loading, reload } = useApi(id ? `/payments/${id}` : null);
  const [tab, setTab] = useState('overview');
  const dialog = useActionDialog();
  const navigate = useNavigate();
  useEffect(() => setTab('overview'), [id]);

  const refresh = useCallback(() => {
    reload();
    onChanged();
  }, [reload, onChanged]);

  const payment = data?.payment;

  const markFailed = () => dialog.open({
    title: L('Zahlung als abgebrochen markieren', 'Mark payment as cancelled'),
    tone: 'danger',
    description: `${payment.invoiceNumber} · ${formatEuro(payment.grossCents)}`,
    effects: [
      L(
        'Vorher wird bei der Bank geprüft, ob doch bezahlt wurde. Wenn ja, wird nichts geändert.',
        'The bank is asked first whether it was paid after all. If so, nothing is changed.',
      ),
      L(
        'Status wird „Fehlgeschlagen“, ein reservierter Rabatt wird wieder freigegeben.',
        'Status becomes "Failed" and a reserved discount is released again.',
      ),
      L('Zählt nicht als Fehlversuch des Beraters (keine Zahlungssperre).', 'Does not count as a failed attempt by the advisor (no payment lock).'),
    ],
    fields: [{
      name: 'force',
      label: L('Falls die Bank nicht erreichbar ist', 'If the bank cannot be reached'),
      type: 'checkbox',
      hint: L('Trotzdem abbrechen – ich bin sicher, dass nicht bezahlt wurde.', 'Cancel anyway – I am sure nothing was paid.'),
    }],
    reason: 'required',
    confirmLabel: L('Als abgebrochen markieren', 'Mark as cancelled'),
    success: L('Zahlung als abgebrochen markiert.', 'Payment marked as cancelled.'),
    onConfirm: async ({ reason, values }) => {
      await api.post(`/payments/${id}/mark-failed`, { reason, force: Boolean(values.force) });
      refresh();
    },
  });

  const actions = payment ? [
    {
      id: 'sync',
      icon: RotateCcw,
      label: L('Mit Bank abgleichen', 'Check with bank'),
      description: L(
        'Status bei ProCredit abfragen. Wurde bezahlt, wird der Auftrag angelegt und der Beleg versendet.',
        'Ask ProCredit for the status. If it was paid, the order is created and the receipt is sent.',
      ),
      hidden: payment.status !== 'pending',
      disabled: !payment.hasGatewayOrder,
      disabledReason: L(
        'Für diese Zahlung existiert keine Bestellung bei der Bank (Checkout nie gestartet).',
        'There is no order at the bank for this payment (checkout never started).',
      ),
      onClick: () => dialog.open({
        title: L('Mit Bank abgleichen', 'Check with bank'),
        effects: [
          L('Der aktuelle Status wird bei ProCredit abgefragt (nur lesend).', 'The current status is requested from ProCredit (read only).'),
          L(
            'Bezahlt → Status „Bezahlt“, Lead-Auftrag wird angelegt, Beleg geht an den Berater.',
            'Paid → status "Paid", the lead order is created and the receipt goes to the advisor.',
          ),
          L('Abgelehnt → Status „Fehlgeschlagen“. Noch offen → keine Änderung.', 'Declined → status "Failed". Still open → no change.'),
        ],
        reason: 'optional',
        confirmLabel: L('Abgleichen', 'Check'),
        success: (result) => L(`Ergebnis der Bank: ${result?.outcome || 'unbekannt'}.`, `Bank result: ${result?.outcome || 'unknown'}.`),
        onConfirm: async ({ reason }) => {
          const result = await api.post(`/payments/${id}/sync`, { reason });
          refresh();
          return result;
        },
      }),
    },
    {
      id: 'fail',
      icon: Ban,
      tone: 'warn',
      label: L('Als abgebrochen markieren', 'Mark as cancelled'),
      description: L(
        'Hängende Zahlung schließen, wenn der Berater den Checkout abgebrochen hat.',
        'Close a stuck payment when the advisor abandoned the checkout.',
      ),
      hidden: payment.status !== 'pending',
      onClick: markFailed,
    },
    {
      id: 'repair',
      icon: FilePlus2,
      label: L('Fehlenden Auftrag anlegen', 'Create missing order'),
      description: L(
        'Bezahltes Paket nachträglich als Lead-Auftrag anlegen, damit der Berater beliefert wird.',
        'Create the paid package as a lead order afterwards so the advisor gets their leads.',
      ),
      hidden: payment.status !== 'paid' || Boolean(payment.requestId),
      onClick: () => dialog.open({
        title: L('Lead-Auftrag nachträglich anlegen', 'Create lead order afterwards'),
        effects: [
          L(
            `Neuer Auftrag über ${payment.leadCount} Lead(s) (${payment.packageLabel}) für den Berater.`,
            `New order for ${payment.leadCount} lead(s) (${payment.packageLabel}) for the advisor.`,
          ),
          L('Admins werden wie bei einer normalen Bestellung benachrichtigt.', 'Admins are notified as for a normal purchase.'),
          L('Die Zahlung wird mit dem Auftrag verknüpft.', 'The payment is linked to the order.'),
        ],
        reason: 'required',
        confirmLabel: L('Auftrag anlegen', 'Create order'),
        success: L('Auftrag angelegt.', 'Order created.'),
        onConfirm: async ({ reason }) => {
          await api.post(`/payments/${id}/repair-request`, { reason });
          refresh();
        },
      }),
    },
    {
      id: 'berater',
      icon: ExternalLink,
      label: L('Berater öffnen', 'Open advisor'),
      description: L('Konto, weitere Zahlungen und Aufträge des Beraters ansehen.', 'See the advisor\'s account, other payments and orders.'),
      onClick: () => navigate(`/it-support/users?id=${payment.beraterId}`),
    },
  ] : [];

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={payment ? L(`Zahlung ${payment.invoiceNumber}`, `Payment ${payment.invoiceNumber}`) : L('Zahlung', 'Payment')}
      subtitle={payment ? <>{formatEuro(payment.grossCents)} · <CopyId value={payment.id} /></> : null}
      headerExtra={<Button size="sm" tone="ghost" icon={RefreshCw} onClick={reload} aria-label={L('Neu laden', 'Reload')} />}
    >
      {!data && loading ? <Loading /> : null}
      <ErrorBanner error={error} onRetry={reload} />
      {payment ? (
        <>
          <div className="its-drawer-chips"><PaymentStatus payment={payment} /></div>
          {(payment.flags || []).map((flag) => <Banner key={flag} tone={FLAG[flag].tone}>{pick(FLAG[flag].help)}</Banner>)}
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: L('Überblick', 'Overview') },
              { value: 'actions', label: L('Aktionen', 'Actions') },
              { value: 'events', label: L('Bank-Protokoll', 'Bank log'), count: data.events.length },
              { value: 'history', label: L('Verlauf', 'History'), count: data.activity.length },
              { value: 'tech', label: L('Technik', 'Technical') },
            ]}
          />
          {tab === 'overview' ? (
            <div className="its-stack">
              <KeyValue items={[
                [L('Berater', 'Advisor'), payment.berater ? `${payment.berater.fullName || '—'} (${payment.berater.email})` : payment.beraterId],
                [L('Paket', 'Package'), `${payment.packageLabel} · ${payment.leadCount} Leads · ${label(SCOPE, payment.scope)}`],
                [L('Betrag', 'Amount'), `${formatEuro(payment.grossCents)}${payment.discountCents ? L(` (Rabatt ${formatEuro(payment.discountCents)})`, ` (discount ${formatEuro(payment.discountCents)})`) : ''}`],
                ['Status', label(PAYMENT_STATUS, payment.status)],
                [L('Bankstatus', 'Bank status'), payment.pgStatus],
                [L('Karte', 'Card'), payment.cardLast4 ? `${payment.cardBrand || L('Karte', 'Card')} •••• ${payment.cardLast4}` : null],
                [L('Genehmigungscode', 'Approval code'), payment.approvalCode],
                [L('Rechnungsempfänger', 'Billed to'), [payment.billingName, payment.billingCompany, payment.billingEmail].filter(Boolean).join(' · ')],
                [L('Erstellt', 'Created'), formatDateTime(payment.createdAt)],
                [L('Bezahlt', 'Paid'), payment.paidAt ? formatDateTime(payment.paidAt) : null],
                [L('Modus', 'Mode'), payment.testMode ? 'Test' : 'Live'],
              ]}
              />
              <Card title={L('Auftrag', 'Order')}>
                {data.request ? (
                  <KeyValue items={[
                    ['Code', data.request.code || data.request.id],
                    ['Status', label(REQUEST_STATUS, data.request.status)],
                    ['Leads', String(data.request.requested_count)],
                    [L('Angelegt', 'Created'), formatDateTime(data.request.created_at)],
                  ]}
                  />
                ) : (
                  <p className="its-muted">
                    {payment.status === 'paid'
                      ? L('Kein Auftrag verknüpft.', 'No order linked.')
                      : L('Ein Auftrag entsteht erst nach erfolgreicher Zahlung.', 'An order is only created after a successful payment.')}
                  </p>
                )}
              </Card>
            </div>
          ) : null}
          {tab === 'actions' ? <ActionList actions={actions} /> : null}
          {tab === 'events' ? (
            data.events.length ? (
              <ul className="its-plain-list">
                {data.events.map((event) => (
                  <li key={event.id} className="is-block">
                    <div>
                      <Chip tone={eventTone(event.event)} icon={false}>{label(PAYMENT_EVENT, event.event)}</Chip>
                      <small>{formatDateTime(event.created_at)}{event.ip ? ` · IP ${event.ip}` : ''}</small>
                    </div>
                    {event.metadata && Object.keys(event.metadata).length ? <JsonBlock value={event.metadata} /> : null}
                  </li>
                ))}
              </ul>
            ) : <EmptyState title={L('Keine Bank-Ereignisse protokolliert', 'No bank events logged')} />
          ) : null}
          {tab === 'history' ? (
            <ActivityTimeline entries={data.activity} empty={L('IT-Support hat an dieser Zahlung noch nichts geändert.', 'IT Support has not changed anything on this payment yet.')} />
          ) : null}
          {tab === 'tech' ? (
            <KeyValue items={Object.entries(data.technical).map(([key, value]) => [key, value === null ? null : String(value)])} />
          ) : null}
          {dialog.element}
        </>
      ) : null}
    </Drawer>
  );
}

function AuditLog() {
  const [event, setEvent] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi('/payments/audit', { event, page, limit: 50 });
  const navigate = useNavigate();
  const columns = [
    { key: 'when', label: L('Zeit', 'Time'), render: (row) => formatDateTime(row.created_at) },
    { key: 'event', label: L('Ereignis', 'Event'), render: (row) => <Chip tone={eventTone(row.event)} icon={false}>{label(PAYMENT_EVENT, row.event)}</Chip> },
    { key: 'details', label: 'Details', render: (row) => <code className="its-code-inline">{JSON.stringify(row.metadata || {})}</code> },
    { key: 'ip', label: 'IP', render: (row) => row.ip || '—' },
  ];
  return (
    <>
      <Toolbar>
        <Select
          label={L('Ereignis', 'Event')}
          value={event}
          onChange={(value) => { setEvent(value); setPage(1); }}
          options={mapOptions(PAYMENT_EVENT, L('Alle', 'All'))}
        />
        <Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button>
      </Toolbar>
      <ErrorBanner error={error} onRetry={reload} />
      <Card flush>
        <DataTable
          columns={columns}
          rows={data?.events || []}
          loading={loading}
          onRowClick={(row) => (row.payment_id ? navigate(`/it-support/payments?id=${row.payment_id}`) : null)}
          empty={<EmptyState title={L('Keine Ereignisse', 'No events')} />}
        />
        <Pagination page={page} limit={50} total={data?.total || 0} onPage={setPage} />
      </Card>
    </>
  );
}

export default function PaymentsPage({ onChanged }) {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'list';
  const filters = {
    q: params.get('q') || '',
    status: params.get('status') || '',
    problem: params.get('problem') || '',
    page: Number(params.get('page')) || 1,
  };
  const openId = params.get('id');
  const { data, error, loading, reload } = useApi(view === 'list' ? '/payments' : null, { ...filters, limit: 25 });
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

  const columns = [
    {
      key: 'invoice',
      label: L('Rechnung', 'Invoice'),
      render: (payment) => (
        <div className="its-cell-main">
          <strong>{payment.invoiceNumber}</strong>
          <small>{payment.packageLabel}</small>
        </div>
      ),
    },
    {
      key: 'berater',
      label: L('Berater', 'Advisor'),
      render: (payment) => (
        <div className="its-cell-main">
          <strong>{payment.berater?.fullName || '—'}</strong>
          <small>{payment.berater?.email || payment.billingEmail || ''}</small>
        </div>
      ),
    },
    { key: 'amount', label: L('Betrag', 'Amount'), className: 'is-num', render: (payment) => formatEuro(payment.grossCents) },
    { key: 'status', label: 'Status', render: (payment) => <PaymentStatus payment={payment} /> },
    { key: 'created', label: L('Erstellt', 'Created'), render: (payment) => <When value={payment.createdAt} /> },
  ];

  return (
    <Page
      title={L('Zahlungen', 'Payments')}
      description={L(
        'Alle ProCredit-Zahlungen überwachen, hängende Checkouts klären und fehlgeschlagene Abläufe wiederholen.',
        'Monitor all ProCredit payments, resolve stuck checkouts and retry failed processes.',
      )}
      actions={view === 'list' ? <Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button> : null}
    >
      <Toolbar>
        <Segmented
          value={view}
          onChange={(value) => setParams(value === 'list' ? {} : { view: value }, { replace: true })}
          options={[
            { value: 'list', label: L('Zahlungen', 'Payments') },
            { value: 'audit', label: L('Zahlungsprotokoll (Bank & Sicherheit)', 'Payment log (bank & security)') },
          ]}
        />
      </Toolbar>

      {view === 'audit' ? <AuditLog /> : (
        <>
          <div className="its-stats is-compact">
            <Stat
              label={L('Bezahlt, Auftrag fehlt', 'Paid, order missing')}
              value={counts.paid_without_request}
              tone={counts.paid_without_request ? 'error' : 'ok'}
              onClick={() => update({ problem: 'paid_without_request', status: '' })}
            />
            <Stat
              label={L('Hängende Checkouts', 'Stuck checkouts')}
              value={counts.pending_stale}
              tone={counts.pending_stale ? 'warn' : 'ok'}
              hint={L('> 30 Minuten offen', 'open > 30 minutes')}
              onClick={() => update({ problem: 'pending_stale', status: '' })}
            />
            <Stat
              label={L('Fehlgeschlagen (24 h)', 'Failed (24 h)')}
              value={counts.failed_24h}
              tone={counts.failed_24h ? 'warn' : 'neutral'}
              onClick={() => update({ problem: 'failed_24h', status: '' })}
            />
            <Stat label={L('Bezahlt gesamt', 'Paid in total')} value={counts.paid} tone="neutral" onClick={() => update({ status: 'paid', problem: '' })} />
          </div>
          <Toolbar>
            <Segmented
              value={filters.status}
              onChange={(status) => update({ status, problem: '' })}
              options={[
                { value: '', label: L('Alle', 'All') },
                { value: 'pending', label: label(PAYMENT_STATUS, 'pending'), count: counts.pending },
                { value: 'paid', label: label(PAYMENT_STATUS, 'paid'), count: counts.paid },
                { value: 'failed', label: label(PAYMENT_STATUS, 'failed'), count: counts.failed },
                { value: 'refunded', label: label(PAYMENT_STATUS, 'refunded'), count: counts.refunded },
              ]}
            />
          </Toolbar>
          <Toolbar>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder={L('Rechnungsnr., Berater, E-Mail, Bestell-ID …', 'Invoice no., advisor, email, order ID …')} />
            <Select
              label={L('Problem', 'Problem')}
              value={filters.problem}
              onChange={(problem) => update({ problem })}
              options={[
                { value: '', label: '—' },
                { value: 'paid_without_request', label: L('Bezahlt, Auftrag fehlt', 'Paid, order missing') },
                { value: 'pending_stale', label: L('Hängender Checkout', 'Stuck checkout') },
                { value: 'failed_24h', label: L('Fehlgeschlagen (24 h)', 'Failed (24 h)') },
              ]}
            />
          </Toolbar>
          <ErrorBanner error={error} onRetry={reload} />
          <Card flush>
            <DataTable
              columns={columns}
              rows={data?.payments || []}
              loading={loading}
              onRowClick={(payment) => update({ id: payment.id })}
              activeKey={openId}
              empty={<EmptyState title={L('Keine Zahlungen gefunden', 'No payments found')} />}
            />
            <Pagination page={filters.page} limit={data?.limit || 25} total={data?.total || 0} onPage={(page) => update({ page })} />
          </Card>
        </>
      )}
      <PaymentDrawer id={openId} onClose={() => update({ id: '' })} onChanged={changed} />
    </Page>
  );
}
