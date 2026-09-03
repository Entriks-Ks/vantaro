import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Pause, Radio, X } from 'lucide-react';
import {
  fetchAllRequests,
  fetchBeraterPipeline,
  leadTypeLabel,
  recallBeraterLead,
  requestStatusLabel,
  requestStatusTone,
  sendBeraterLeads,
  updateBeraterRequest,
} from '../../lib/berater';
import { formatLeadAddress, listLabels, statusLabel } from '../../lib/leads';
import { formatCardExpiry, formatCardMask } from '../../lib/payments';
import { leadScopeLabel } from '../../lib/scopes';
import { DashSeg } from './DashboardLayout';
import { formatDate, formatDateTime, formatEuroExact, initials } from './helpers';

function leadScopeOrDefault(scope) {
  return scope === 'regional' ? 'regional' : 'deutschlandweit';
}

function poolForRequest(availableLeads, request) {
  const scope = leadScopeOrDefault(request?.scope);
  return (availableLeads || []).filter(
    (lead) => leadScopeOrDefault(lead.scope) === scope && lead.status !== 'erledigt' && !lead.refundedAt,
  );
}

function leadsForRequest(requestLeads, requestId) {
  return (requestLeads || []).filter((lead) => lead.requestId === requestId && !lead.refundedAt);
}

function beraterName(request) {
  return request.berater?.fullName || request.berater?.email || 'Unbekannt';
}

function requestCode(request) {
  return request?.code || null;
}

function packageKindLabel(scope) {
  return scope === 'regional' ? 'Regional' : 'Exklusiv';
}

function progressPercent(request) {
  if (!request?.requestedCount) return 0;
  return Math.min(100, Math.round((request.validCount / request.requestedCount) * 100));
}

function progressCopy(request) {
  if (request.status === 'completed') return 'Alle Leads zugestellt';
  if (request.status === 'cancelled') return 'Belieferung pausiert';
  if (request.refundedCount > 0 && request.remaining > 0) {
    return `${request.refundedCount} erstattet · Ersatz offen`;
  }
  if (request.validCount > 0) return 'Leads werden zugestellt';
  return 'Wartet auf Zustellung';
}

function RequestStatusButtons({ entry, saving, onRun, className, withBeraterLink = false }) {
  const showPause = entry.status === 'active' || entry.status === 'cancelled';
  const beraterPath = entry.beraterId ? `/dashboard/berater/${entry.beraterId}` : '';

  if (!showPause && !(withBeraterLink && beraterPath)) return null;

  return (
    <div className={className}>
      {entry.status === 'active' ? (
        <button
          type="button"
          className="dash-btn dash-btn--ghost"
          disabled={Boolean(saving)}
          onClick={(event) => {
            event.stopPropagation();
            onRun(entry.id, { status: 'cancelled' }, 'Auftrag pausiert.');
          }}
        >
          Pausieren
        </button>
      ) : entry.status === 'cancelled' ? (
        <button
          type="button"
          className="dash-btn"
          disabled={Boolean(saving)}
          onClick={(event) => {
            event.stopPropagation();
            onRun(entry.id, { status: 'active' }, 'Auftrag fortgesetzt.');
          }}
        >
          Fortsetzen
        </button>
      ) : null}
      {withBeraterLink && beraterPath ? (
        <Link
          className="dash-btn dash-btn--ghost"
          to={beraterPath}
          onClick={(event) => event.stopPropagation()}
        >
          Berater öffnen
        </Link>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  const value = children == null || children === '' ? '—' : children;
  return (
    <div className="dash-drawer-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DrawerSection({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`dash-drawer-section${open ? ' is-open' : ''}`}>
      <button type="button" className="dash-drawer-section-toggle" onClick={() => setOpen((value) => !value)}>
        <span>
          <b>{title}</b>
          {!open && summary ? <em>{summary}</em> : null}
        </span>
        <ChevronDown size={16} />
      </button>
      {open ? <div className="dash-drawer-section-body">{children}</div> : null}
    </section>
  );
}

function RequestProgress({ request }) {
  const percent = progressPercent(request);
  const size = 128;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - percent / 100);
  const state = request.status === 'cancelled'
    ? 'paused'
    : request.status === 'completed'
      ? 'done'
      : 'live';

  return (
    <div className={`dash-request-progress is-${state}`}>
      <div className="dash-request-ring" aria-hidden="true">
        <svg viewBox={`0 0 ${size} ${size}`}>
          <circle className="dash-request-ring-track" cx={size / 2} cy={size / 2} r={radius} />
          <circle
            className="dash-request-ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        {state === 'live' ? <span className="dash-request-ring-orbit" /> : null}
        <div className="dash-request-ring-center">
          {state === 'done' ? <Check size={22} /> : state === 'paused' ? <Pause size={18} /> : <Radio size={16} />}
          <strong>{percent}%</strong>
        </div>
      </div>
      <div className="dash-request-progress-copy">
        <p>
          <span className="dash-request-live-dot" />
          {progressCopy(request)}
        </p>
        <strong>{request.validCount} von {request.requestedCount} Leads gültig</strong>
        <div className="dash-request-stats">
          <div>
            <span>Angefragt</span>
            <b>{request.requestedCount}</b>
          </div>
          <div>
            <span>Gültig</span>
            <b>{request.validCount}</b>
          </div>
          <div>
            <span>Erstattet</span>
            <b>{request.refundedCount || 0}</b>
          </div>
          <div>
            <span>Offen</span>
            <b>{request.remaining}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestDrawer({
  request,
  saving,
  onRun,
  onClose,
  pool,
  sentLeads,
  selectedIds,
  onToggleLead,
  onSendSelected,
  onSendNext,
  onRecall,
  fillLoading,
}) {
  const payment = request.payment;
  const canFill = request.status === 'active' && request.remaining > 0;
  const beraterSummary = [request.berater?.company, request.berater?.email].filter(Boolean).join(' · ') || beraterName(request);
  const paymentSummary = payment
    ? `${formatEuroExact(payment.grossCents)} · ${payment.invoiceNumber}`
    : 'Keine Zahlung hinterlegt';
  const historyBits = [
    request.activatedAt ? `Aktiv ${formatDate(request.activatedAt)}` : null,
    request.pausedAt ? `Pausiert ${formatDate(request.pausedAt)}` : null,
    request.notes,
  ].filter(Boolean);
  const sendSummary = fillLoading
    ? 'Laden…'
    : `${selectedIds.length} ausgewählt · ${request.remaining} offen · ${pool.length} im Pool`;
  const sentSummary = fillLoading ? 'Laden…' : `${sentLeads.length} zugestellt`;

  return (
    <div className="dash-drawer-root">
      <button type="button" className="dash-drawer-overlay" aria-label="Details schließen" onClick={onClose} />
      <aside className="dash-drawer dash-drawer--request" aria-labelledby="request-drawer-title">
        <div className="dash-drawer-head">
          <div className="dash-drawer-who">
            <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
              {initials(request.berater || {})}
            </span>
            <div>
              <div className="dash-lead-kicker">Anforderung{requestCode(request) ? ` · ${requestCode(request)}` : ''}</div>
              <h3 id="request-drawer-title">{beraterName(request)}</h3>
              <small>{formatDateTime(request.createdAt)}</small>
            </div>
          </div>
          <button type="button" className="dash-drawer-close" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="dash-drawer-body">
          <div className="dash-drawer-chips">
            <span className={`dash-badge dash-badge--${requestStatusTone(request.status)}`}>
              {requestStatusLabel(request.status)}
            </span>
            <span className="dash-badge dash-badge--muted">{packageKindLabel(request.scope)}</span>
            <span className="dash-badge dash-badge--muted">{leadTypeLabel(request.leadType)}</span>
          </div>

          <RequestProgress request={request} />

          <div className="dash-drawer-fields">
            <Field label="Code">{requestCode(request)}</Field>
            <Field label="Paket">{packageKindLabel(request.scope)}</Field>
            <Field label="Kategorie">{leadTypeLabel(request.leadType)}</Field>
            <Field label="Von">{beraterName(request)}</Field>
            <Field label="Gültig">{request.validCount}{request.refundedCount ? ` · ${request.refundedCount} erstattet` : ''}</Field>
          </div>

          <div className="dash-drawer-accordions" key={request.id}>
            <DrawerSection
              title="Leads senden"
              summary={sendSummary}
              defaultOpen={canFill || request.status === 'cancelled'}
            >
              {request.status === 'cancelled' ? (
                <p className="dash-panel-note">Setzen Sie die Anforderung fort, bevor Sie Leads senden.</p>
              ) : request.status === 'completed' ? (
                <p className="dash-panel-note">Anforderung ist erfüllt. Alle angefragten Leads wurden zugestellt.</p>
              ) : fillLoading ? (
                <p className="dash-panel-note">Pool wird geladen…</p>
              ) : pool.length ? (
                <div className="dash-replace-block">
                  <p className="dash-panel-note">
                    Nur freie Leads aus Paket <strong>{leadScopeLabel(request.scope)}</strong>.
                    Noch {request.remaining} offen.
                  </p>
                  <div className="dash-pick-list dash-pick-list--drawer dash-pick-list--request">
                    {pool.map((lead) => {
                      const checked = selectedIds.includes(lead.id);
                      const atLimit = !checked && selectedIds.length >= request.remaining;
                      return (
                        <label
                          key={lead.id}
                          className={`dash-pick-row${checked ? ' is-checked' : ''}${atLimit ? ' is-disabled' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleLead(lead.id)}
                            disabled={Boolean(saving) || !canFill || atLimit}
                          />
                          <span>
                            <strong>{lead.fullName}</strong>
                            <small>
                              {[formatLeadAddress(lead), listLabels(lead.insuranceStatus, 'insurance')]
                                .filter((value) => value && value !== '—')
                                .join(' · ')}
                            </small>
                          </span>
                          <em>{statusLabel(lead.status)}</em>
                        </label>
                      );
                    })}
                  </div>
                  <div className="dash-form-actions">
                    <button
                      type="button"
                      className="dash-btn"
                      disabled={Boolean(saving) || !selectedIds.length || !canFill}
                      onClick={onSendSelected}
                    >
                      Ausgewählte senden
                    </button>
                    <button
                      type="button"
                      className="dash-btn dash-btn--ghost"
                      disabled={Boolean(saving) || !pool.length || !canFill}
                      onClick={onSendNext}
                    >
                      Nächsten senden
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dash-empty dash-empty--compact">
                  <p>
                    Keine freien Leads im Pool für Paket {leadScopeLabel(request.scope)}.
                  </p>
                  <Link className="dash-btn dash-btn--ghost" to="/dashboard/leads" onClick={(event) => event.stopPropagation()}>
                    Zu den Leads
                  </Link>
                </div>
              )}
            </DrawerSection>

            <DrawerSection title="Zugestellte Leads" summary={sentSummary} defaultOpen={sentLeads.length > 0 && !canFill}>
              {fillLoading ? (
                <p className="dash-panel-note">Leads werden geladen…</p>
              ) : sentLeads.length ? (
                <div className="dash-sent-list dash-sent-list--drawer">
                  {sentLeads.map((lead) => (
                    <div key={lead.id} className="dash-sent-item">
                      <div className="dash-sent-item-copy">
                        <strong>{lead.fullName}</strong>
                        <small>
                          {[formatLeadAddress(lead), statusLabel(lead.status)]
                            .filter((value) => value && value !== '—')
                            .join(' · ')}
                        </small>
                      </div>
                      <div className="dash-sent-item-actions">
                        <Link
                          className="dash-btn dash-btn--ghost"
                          to={`/dashboard/leads/${lead.id}`}
                          state={{ from: '/dashboard/anfordern' }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          Öffnen
                        </Link>
                        <button
                          type="button"
                          className="dash-btn dash-btn--ghost"
                          disabled={Boolean(saving)}
                          onClick={() => onRecall(lead.id)}
                        >
                          Zurücknehmen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dash-panel-note">Dieser Anforderung wurden noch keine Leads zugestellt.</p>
              )}
            </DrawerSection>

            <DrawerSection title="Berater" summary={beraterSummary}>
              <div className="dash-drawer-fields">
                <Field label="Name">{beraterName(request)}</Field>
                <Field label="Firma">{request.berater?.company}</Field>
                <Field label="E-Mail">{request.berater?.email}</Field>
                <Field label="Telefon">{request.berater?.phone}</Field>
              </div>
            </DrawerSection>

            <DrawerSection title="Zahlung" summary={paymentSummary}>
              {payment ? (
                <div className="dash-drawer-fields">
                  <Field label="Rechnung">{payment.invoiceNumber}</Field>
                  <Field label="Betrag">{formatEuroExact(payment.grossCents)}</Field>
                  <Field label="Bezahlt am">{formatDateTime(payment.paidAt || payment.createdAt)}</Field>
                  <Field label="Karte">
                    {[
                      formatCardMask(payment),
                      payment.cardExpMonth ? formatCardExpiry(payment) : '',
                    ].filter(Boolean).join(' · ')}
                  </Field>
                  <Field label="Karteninhaber">{payment.cardHolder}</Field>
                  {payment.testMode ? <Field label="Modus">Testbetrieb</Field> : null}
                </div>
              ) : (
                <p className="dash-panel-note">Keine Zahlung hinterlegt.</p>
              )}
            </DrawerSection>

            {historyBits.length ? (
              <DrawerSection title="Verlauf" summary={historyBits[0]}>
                <div className="dash-drawer-fields">
                  <Field label="Angefordert">{formatDateTime(request.createdAt)}</Field>
                  {request.activatedAt ? <Field label="Aktiv seit">{formatDateTime(request.activatedAt)}</Field> : null}
                  {request.pausedAt ? <Field label="Pausiert am">{formatDateTime(request.pausedAt)}</Field> : null}
                  {request.notes ? <Field label="Notiz">{request.notes}</Field> : null}
                </div>
              </DrawerSection>
            ) : null}
          </div>
        </div>

        <RequestStatusButtons
          entry={request}
          saving={saving}
          onRun={onRun}
          withBeraterLink
          className="dash-drawer-actions"
        />
      </aside>
    </div>
  );
}

export function AdminRequests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('active');
  const [selectedId, setSelectedId] = useState('');
  const [pool, setPool] = useState([]);
  const [sentLeads, setSentLeads] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [fillLoading, setFillLoading] = useState(false);

  async function load() {
    const payload = await fetchAllRequests();
    setRequests(payload.requests || []);
    return payload;
  }

  async function loadFillData(request) {
    if (!request?.beraterId) {
      setPool([]);
      setSentLeads([]);
      setSelectedLeadIds([]);
      return;
    }
    setFillLoading(true);
    try {
      const payload = await fetchBeraterPipeline(request.beraterId);
      setPool(poolForRequest(payload.availableLeads, request));
      setSentLeads(leadsForRequest(payload.requestLeads, request.id));
      setSelectedLeadIds([]);
    } catch (err) {
      setError(err.message);
      setPool([]);
      setSentLeads([]);
    } finally {
      setFillLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const payload = await fetchAllRequests();
        if (!active) return;
        setRequests(payload.requests || []);
        setError('');
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const requestId = searchParams.get('request');
    if (!requestId) return;
    setSelectedId(requestId);
    setFilter('all');
  }, [searchParams]);

  function closeDrawer() {
    setSelectedId('');
    setPool([]);
    setSentLeads([]);
    setSelectedLeadIds([]);
    setSearchParams((prev) => {
      if (!prev.get('request')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('request');
      return next;
    }, { replace: true });
  }

  useEffect(() => {
    if (!selectedId) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [selectedId]);

  const visible = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter((entry) => entry.status === filter);
  }, [filter, requests]);

  const selected = requests.find((entry) => entry.id === selectedId) || null;
  const drawerOpen = Boolean(selected);

  useEffect(() => {
    if (!selected) {
      setPool([]);
      setSentLeads([]);
      setSelectedLeadIds([]);
      return undefined;
    }
    let active = true;
    setFillLoading(true);
    fetchBeraterPipeline(selected.beraterId)
      .then((payload) => {
        if (!active) return;
        setPool(poolForRequest(payload.availableLeads, selected));
        setSentLeads(leadsForRequest(payload.requestLeads, selected.id));
        setSelectedLeadIds([]);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setFillLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected?.id, selected?.beraterId, selected?.scope]);

  const activeCount = requests.filter((entry) => entry.status === 'active').length;
  const pausedCount = requests.filter((entry) => entry.status === 'cancelled').length;
  const completedCount = requests.filter((entry) => entry.status === 'completed').length;

  async function run(id, payload, success) {
    setSaving(id);
    setError('');
    setNotice('');
    try {
      await updateBeraterRequest(id, payload);
      const refreshed = await load();
      const next = (refreshed.requests || []).find((entry) => entry.id === id);
      if (next && selectedId === id) await loadFillData(next);
      if (success) setNotice(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  function toggleLead(leadId) {
    setSelectedLeadIds((current) => {
      if (current.includes(leadId)) return current.filter((item) => item !== leadId);
      if (!selected?.remaining || current.length >= selected.remaining) return current;
      return [...current, leadId];
    });
  }

  async function runFill(action, success) {
    if (!selected) return;
    const requestId = selected.id;
    setSaving(requestId);
    setError('');
    setNotice('');
    try {
      const result = await action();
      const refreshed = await load();
      const nextRequest = (refreshed.requests || []).find((entry) => entry.id === requestId)
        || (result?.request ? { ...selected, ...result.request } : selected);
      await loadFillData(nextRequest);
      if (success) setNotice(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  function sendSelected() {
    if (!selected || !selectedLeadIds.length) return;
    const count = selectedLeadIds.length;
    return runFill(
      () => sendBeraterLeads(selected.id, selectedLeadIds),
      `${count} Lead${count === 1 ? '' : 's'} gesendet.`,
    );
  }

  function sendNext() {
    if (!selected || !pool.length || !selected.remaining) return;
    const next = pool.slice(0, Math.min(1, selected.remaining)).map((lead) => lead.id);
    return runFill(() => sendBeraterLeads(selected.id, next), 'Nächster Lead gesendet.');
  }

  function recallLead(leadId) {
    if (!selected) return;
    return runFill(
      () => recallBeraterLead(selected.id, leadId),
      'Lead zurückgenommen.',
    );
  }

  return (
    <div className="dash-stack">
      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <div className="dash-metrics dash-metrics--three">
        <div className="dash-metric">
          <span>Aktiv</span>
          <strong>{loading ? '—' : activeCount}</strong>
          <small>empfangsberechtigt</small>
        </div>
        <div className="dash-metric">
          <span>Pausiert</span>
          <strong>{loading ? '—' : pausedCount}</strong>
          <small>vom Admin gestoppt</small>
        </div>
        <div className="dash-metric">
          <span>Erfüllt</span>
          <strong>{loading ? '—' : completedCount}</strong>
          <small>Menge geliefert</small>
        </div>
      </div>

      <section className="dash-panel">
        <div className="dash-toolbar">
          <DashSeg
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'active', label: 'Aktiv', count: loading ? null : activeCount },
              { id: 'cancelled', label: 'Pausiert', count: loading ? null : pausedCount },
              { id: 'completed', label: 'Erfüllt', count: loading ? null : completedCount },
              { id: 'all', label: 'Alle', count: loading ? null : requests.length },
            ]}
          />
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : visible.length ? (
          <div className="dash-lead-list">
            {visible.map((entry) => (
              <article
                key={entry.id}
                className={`dash-lead-row dash-request-row is-${entry.status === 'cancelled' ? 'paused' : entry.status}${selectedId === entry.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
                  {initials(entry.berater || {})}
                </span>
                <div className="dash-lead-row-main">
                  <strong>
                    {beraterName(entry)}
                    {requestCode(entry) ? <span className="dash-request-code"> · {requestCode(entry)}</span> : null}
                  </strong>
                  <span className="dash-lead-row-sub">
                    {packageKindLabel(entry.scope)} · {leadTypeLabel(entry.leadType)} · {entry.requestedCount} Leads
                    {entry.berater?.company ? ` · ${entry.berater.company}` : ''}
                  </span>
                  <span className="dash-request-track">
                    <span className={`dash-request-mini is-${entry.status === 'cancelled' ? 'paused' : entry.status}`}>
                      <span style={{ width: `${progressPercent(entry)}%` }} />
                    </span>
                    <small>{entry.validCount}/{entry.requestedCount}</small>
                  </span>
                </div>
                <div className="dash-request-meta">
                  <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                  <span className={`dash-badge dash-badge--${requestStatusTone(entry.status)}`}>
                    {requestStatusLabel(entry.status)}
                  </span>
                  {!drawerOpen ? (
                    <RequestStatusButtons
                      entry={entry}
                      saving={saving}
                      onRun={run}
                      className="dash-row-actions"
                    />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="dash-empty">
            <p>Keine Anforderungen für diesen Filter. Neue Berater-Anforderungen sind sofort aktiv.</p>
          </div>
        )}
      </section>

      {drawerOpen ? (
        <RequestDrawer
          request={selected}
          saving={saving}
          onRun={run}
          onClose={closeDrawer}
          pool={pool}
          sentLeads={sentLeads}
          selectedIds={selectedLeadIds}
          onToggleLead={toggleLead}
          onSendSelected={sendSelected}
          onSendNext={sendNext}
          onRecall={recallLead}
          fillLoading={fillLoading}
        />
      ) : null}
    </div>
  );
}
