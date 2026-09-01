import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  createBeraterRequest,
  fetchBeraterPipeline,
  fetchBeraterPipelines,
  LEAD_TYPE_OPTIONS,
  leadTypeLabel,
  recallBeraterLead,
  requestStatusLabel,
  requestStatusTone,
  sendBeraterLeads,
  updateBeraterRequest,
} from '../../lib/berater';
import { DEFAULT_LEAD_SCOPE, LEAD_SCOPE_OPTIONS, leadScopeLabel } from '../../lib/scopes';
import { complaintStatusLabel, isOpenComplaint } from '../../lib/complaints';
import { formatLeadAddress, listLabels, statusLabel } from '../../lib/leads';
import { LeadListItem } from './AdminLeads';
import { DashSeg } from './DashboardLayout';
import { formatCardExpiry, formatCardMask } from '../../lib/payments';
import { formatDate, formatEuroExact } from './helpers';

function beraterInitials(user) {
  const name = String(user?.fullName || '').trim();
  if (name) {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'B';
  }
  return String(user?.email || 'B').slice(0, 2).toUpperCase();
}

function progressPercent(request) {
  if (!request?.requestedCount) return 0;
  return Math.min(100, Math.round((request.deliveredCount / request.requestedCount) * 100));
}

function PipelineStatus({ request }) {
  if (!request) {
    return <span className="dash-badge dash-badge--muted">Kein Auftrag</span>;
  }
  return (
    <span className={`dash-badge dash-badge--${requestStatusTone(request.status)}`}>
      {requestStatusLabel(request.status)}
    </span>
  );
}

export function AdminBeraterList() {
  const [beraters, setBeraters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    fetchBeraterPipelines()
      .then((payload) => {
        if (active) setBeraters(payload.beraters || []);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasStatus = (entry, status) => (
    (entry.requests || []).some((item) => item.status === status)
    || entry.request?.status === status
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return beraters.filter((entry) => {
      const pending = hasStatus(entry, 'pending');
      const active = hasStatus(entry, 'active');
      if (filter === 'active' && !active) return false;
      if (filter === 'pending' && !pending) return false;
      if (filter === 'open' && !pending && !active) return false;
      if (query) {
        const haystack = `${entry.fullName} ${entry.email} ${entry.company}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [beraters, filter, search]);

  const activeCount = beraters.filter((entry) => hasStatus(entry, 'active')).length;
  const requestedCount = beraters.filter((entry) => hasStatus(entry, 'pending')).length;

  return (
    <div className="dash-stack">
      {error ? <div className="dash-alert">{error}</div> : null}

      <div className="dash-metrics dash-metrics--three">
        <div className="dash-metric">
          <span>Berater</span>
          <strong>{loading ? '—' : beraters.length}</strong>
          <small>Konten</small>
        </div>
        <div className="dash-metric">
          <span>Aktiv</span>
          <strong>{loading ? '—' : activeCount}</strong>
          <small>erhalten gerade Leads</small>
        </div>
        <div className="dash-metric dash-metric--signal">
          <span>Offene Anforderungen</span>
          <strong>{loading ? '—' : requestedCount}</strong>
          <small>noch nicht gestartet</small>
        </div>
      </div>

      <section className="dash-panel">
        <div className="dash-toolbar">
          <DashSeg
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'Alle', count: loading ? null : beraters.length },
              { id: 'open', label: 'Offen' },
              { id: 'active', label: 'Aktiv', count: loading ? null : activeCount },
              { id: 'pending', label: 'Ausstehend', count: loading ? null : requestedCount },
            ]}
          />
          <label className="dash-search">
            <span>Suche</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, E-Mail, Firma"
            />
          </label>
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : visible.length ? (
          <div className="dash-lead-list">
            {visible.map((entry) => {
              const request = entry.request;
              return (
                <Link key={entry.id} className="dash-lead-row" to={`/dashboard/berater/${entry.id}`}>
                  <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
                    {beraterInitials(entry)}
                  </span>
                  <div className="dash-lead-row-main">
                    <strong>{entry.fullName || entry.email}</strong>
                    <span className="dash-lead-row-sub">
                      {[entry.company, entry.email].filter(Boolean).join(' · ')}
                    </span>
                    {request ? (
                      <span className="dash-lead-row-tags">
                        {leadScopeLabel(request.scope)} · {request.deliveredCount} von {request.requestedCount} zugestellt · {request.validCount} gültig
                        {request.refundedCount ? ` · ${request.refundedCount} erstattet` : ''}
                        {request.notes ? ` · ${request.notes}` : ''}
                      </span>
                    ) : (
                      <span className="dash-lead-row-tags">{entry.assignedCount} Leads im Bestand</span>
                    )}
                  </div>
                  <div className="dash-lead-row-side">
                    <PipelineStatus request={request} />
                    {request ? (
                      <span className="dash-mini-progress" aria-hidden="true">
                        <span style={{ width: `${progressPercent(request)}%` }} />
                      </span>
                    ) : null}
                    <small>{formatDate(entry.createdAt)}</small>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="dash-empty">
            <p>Keine Berater für diesen Filter. Neue Konten erscheinen nach der Registrierung.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminBeraterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [count, setCount] = useState(10);
  const [notes, setNotes] = useState('');
  const [leadType, setLeadType] = useState('PKV');
  const [scope, setScope] = useState(DEFAULT_LEAD_SCOPE);
  const [selected, setSelected] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');

  function applyRequest(entry) {
    if (!entry) return;
    setSelectedRequestId(entry.id);
    setCount(entry.requestedCount);
    setNotes(entry.notes || '');
    setLeadType(entry.leadType || 'PKV');
    setScope(entry.scope || DEFAULT_LEAD_SCOPE);
  }

  async function load(preferredId = selectedRequestId) {
    const payload = await fetchBeraterPipeline(id);
    setData(payload);
    const open = (payload.requests || []).filter((entry) => (
      entry.status === 'pending' || entry.status === 'active'
    ));
    const next = open.find((entry) => entry.id === preferredId)
      || payload.request
      || open[0]
      || null;
    if (next) applyRequest(next);
    setSelected([]);
    return payload;
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBeraterPipeline(id)
      .then((payload) => {
        if (!active) return;
        setData(payload);
        if (payload.request) {
          setSelectedRequestId(payload.request.id);
          setCount(payload.request.requestedCount);
          setNotes(payload.request.notes || '');
          setLeadType(payload.request.leadType || 'PKV');
          setScope(payload.request.scope || DEFAULT_LEAD_SCOPE);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const berater = data?.berater;
  const requests = data?.requests || [];
  const openRequests = requests.filter((entry) => entry.status === 'pending' || entry.status === 'active');
  const request = openRequests.find((entry) => entry.id === selectedRequestId) || data?.request;
  const available = data?.availableLeads || [];
  const sent = data?.sentLeads || [];
  const requestLeads = (data?.requestLeads || []).filter((lead) => !request || lead.requestId === request.id);
  const refundedLeads = requestLeads.filter((lead) => lead.refundedAt);
  const requestScope = request?.scope || DEFAULT_LEAD_SCOPE;
  const matchingAvailable = available.filter((lead) => (lead.scope || DEFAULT_LEAD_SCOPE) === requestScope);
  const otherAvailable = available.filter((lead) => (lead.scope || DEFAULT_LEAD_SCOPE) !== requestScope);

  async function run(action, success) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      await load();
      if (success) setNotice(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleLead(leadId) {
    setSelected((current) => (
      current.includes(leadId)
        ? current.filter((item) => item !== leadId)
        : [...current, leadId]
    ));
  }

  if (loading) {
    return (
      <div className="dash-stack">
        <Link className="dash-back" to="/dashboard/berater">
          <ArrowLeft size={16} />
          Zurück zu Berater
        </Link>
        <div className="dash-empty"><p>Laden…</p></div>
      </div>
    );
  }

  if (!berater) {
    return (
      <div className="dash-stack">
        <Link className="dash-back" to="/dashboard/berater">
          <ArrowLeft size={16} />
          Zurück zu Berater
        </Link>
        {error ? <div className="dash-alert">{error}</div> : <div className="dash-empty"><p>Berater wurde nicht gefunden.</p></div>}
      </div>
    );
  }

  return (
    <div className="dash-stack">
      <Link className="dash-back" to="/dashboard/berater">
        <ArrowLeft size={16} />
        Zurück zu Berater
      </Link>

      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <section className="dash-panel dash-lead-hero">
        <div className="dash-lead-identity">
          <span className="dash-lead-avatar" aria-hidden="true">{beraterInitials(berater)}</span>
          <div>
            <div className="dash-lead-kicker">Berater</div>
            <h3>{berater.fullName || berater.email}</h3>
            <p>{[berater.company, berater.email].filter(Boolean).join(' · ')}</p>
            <div className="dash-lead-hero-meta">
              <PipelineStatus request={request} />
              <span>{data.assignedCount} Leads im Bestand</span>
            </div>
          </div>
        </div>
      </section>

      <div className="dash-metrics dash-metrics--four">
        <div className="dash-metric">
          <span>Angefragt</span>
          <strong>{request?.requestedCount || 0}</strong>
          <small>{request ? `${leadScopeLabel(request.scope)} · ${leadTypeLabel(request.leadType)}` : 'kein Auftrag'}</small>
        </div>
        <div className="dash-metric">
          <span>Zugestellt</span>
          <strong>{request?.deliveredCount || 0}</strong>
          <small>{request?.remaining || 0} noch offen</small>
        </div>
        <div className="dash-metric">
          <span>Gültig</span>
          <strong>{request?.validCount || 0}</strong>
          <small>{request?.refundedCount || 0} erstattet</small>
        </div>
        <div className="dash-metric">
          <span>Pool</span>
          <strong>{request ? matchingAvailable.length : (data.availableCount || 0)}</strong>
          <small>
            {request
              ? `${leadScopeLabel(requestScope)} im Pool${otherAvailable.length ? ` · ${otherAvailable.length} andere` : ''}`
              : 'unvergebene Leads'}
          </small>
        </div>
      </div>

      <section className="dash-panel">
        <div className="dash-panel-head">
          <strong>Auftrag</strong>
          <PipelineStatus request={request} />
        </div>

        {openRequests.length > 1 ? (
          <div className="dash-toolbar">
            <DashSeg
              value={request?.id || ''}
              onChange={(nextId) => {
                const next = openRequests.find((entry) => entry.id === nextId);
                if (next) {
                  applyRequest(next);
                  setSelected([]);
                }
              }}
              options={openRequests.map((entry) => ({
                id: entry.id,
                label: `${leadScopeLabel(entry.scope)} · ${requestStatusLabel(entry.status)}`,
                count: entry.requestedCount,
              }))}
            />
          </div>
        ) : null}

        {request ? (
          <>
            <div className="dash-progress-block">
              <div className="dash-progress-copy">
                <span>{leadScopeLabel(request.scope)} · {request.deliveredCount} von {request.requestedCount} zugestellt · {request.validCount} gültig</span>
                <span>{progressPercent(request)}%</span>
              </div>
              <div className="dash-progress">
                <span style={{ width: `${progressPercent(request)}%` }} />
              </div>
            </div>

            {request.payment ? (
              <p className="dash-panel-note">
                Bezahlt · {request.payment.invoiceNumber} · {formatEuroExact(request.payment.grossCents)} · {formatCardMask(request.payment)}
                {request.payment.cardHolder ? ` · ${request.payment.cardHolder}` : ''}
                {request.payment.cardExpMonth ? ` · ${formatCardExpiry(request.payment)}` : ''}
                {request.payment.testMode ? ' · Testbetrieb' : ''}
              </p>
            ) : null}

            <div className="dash-form">
              <label>
                Anzahl
                <input
                  type="number"
                  min={Math.max(1, request.validCount)}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                />
              </label>
              <label>
                Paket
                <select value={scope} onChange={(event) => setScope(event.target.value)}>
                  {LEAD_SCOPE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Kategorie
                <select value={leadType} onChange={(event) => setLeadType(event.target.value)}>
                  {LEAD_TYPE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="is-full">
                Notiz
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="z. B. 10 PKV-Leads gekauft"
                />
              </label>
            </div>

            <div className="dash-form-actions">
              {request.status === 'completed' ? (
                <p className="dash-panel-note">Auftrag erfüllt. Erhöhen Sie die Anzahl, um weitere Leads zu senden.</p>
              ) : request.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    className="dash-btn"
                    disabled={saving}
                    onClick={() => run(() => updateBeraterRequest(request.id, { status: 'active' }), 'Anforderung angenommen.')}
                  >
                    Annehmen
                  </button>
                  <button
                    type="button"
                    className="dash-btn dash-btn--ghost"
                    disabled={saving}
                    onClick={() => run(() => updateBeraterRequest(request.id, { status: 'rejected' }), 'Anforderung abgelehnt.')}
                  >
                    Ablehnen
                  </button>
                </>
              ) : request.status === 'active' ? (
                <button
                  type="button"
                  className="dash-btn dash-btn--ghost"
                  disabled={saving}
                  onClick={() => run(() => updateBeraterRequest(request.id, { status: 'cancelled' }), 'Auftrag deaktiviert.')}
                >
                  Deaktivieren
                </button>
              ) : null}
              <button
                type="button"
                className="dash-btn dash-btn--ghost"
                disabled={saving}
                onClick={() => run(
                  () => updateBeraterRequest(request.id, { requestedCount: request.requestedCount + 5, notes, leadType, scope }),
                  'Auftrag um 5 Leads erhöht.',
                )}
              >
                + 5 Leads
              </button>
              <button
                type="button"
                className="dash-btn dash-btn--ghost"
                disabled={saving}
                onClick={() => run(
                  () => updateBeraterRequest(request.id, { requestedCount: count, notes, leadType, scope }),
                  'Auftrag aktualisiert.',
                )}
              >
                Speichern
              </button>
            </div>
          </>
        ) : (
          <form
            className="dash-form"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () => createBeraterRequest(berater.id, { requestedCount: count, notes, leadType, scope }),
                'Auftrag angelegt.',
              );
            }}
          >
            <label>
              Anzahl
              <input
                type="number"
                min={1}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </label>
            <label>
              Paket
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                {LEAD_SCOPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Kategorie
              <select value={leadType} onChange={(event) => setLeadType(event.target.value)}>
                {LEAD_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="is-full">
              Notiz
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="z. B. Gekauft / angefordert über Partner"
              />
            </label>
            <div className="dash-form-actions is-full">
              <button type="submit" className="dash-btn" disabled={saving}>
                Auftrag anlegen
              </button>
            </div>
          </form>
        )}
      </section>

      {request && request.status === 'active' ? (
        <section className="dash-panel">
          <div className="dash-panel-head">
            <strong>Leads senden</strong>
            <span>
              {leadScopeLabel(requestScope)} · {selected.length} ausgewählt · {request.remaining} offen
            </span>
          </div>
          {matchingAvailable.length ? (
            <>
              <div className="dash-pick-list">
                {matchingAvailable.map((lead) => (
                  <label key={lead.id} className={`dash-pick-row${selected.includes(lead.id) ? ' is-checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selected.includes(lead.id)}
                      onChange={() => toggleLead(lead.id)}
                      disabled={saving}
                    />
                    <span>
                      <strong>{lead.fullName}</strong>
                      <small>
                        {[leadScopeLabel(lead.scope), formatLeadAddress(lead), listLabels(lead.insuranceStatus, 'insurance')]
                          .filter((item) => item && item !== '—')
                          .join(' · ')}
                      </small>
                    </span>
                    <em>{statusLabel(lead.status)}</em>
                  </label>
                ))}
              </div>
              {otherAvailable.length ? (
                <p className="dash-panel-note">
                  {otherAvailable.length} Lead{otherAvailable.length === 1 ? '' : 's'} im Pool sind {leadScopeLabel(otherAvailable[0].scope)} und passen nicht zu diesem Auftrag.
                </p>
              ) : null}
              <div className="dash-form-actions">
                <button
                  type="button"
                  className="dash-btn"
                  disabled={saving || !selected.length}
                  onClick={() => run(
                    () => sendBeraterLeads(request.id, selected),
                    `${selected.length} Lead${selected.length === 1 ? '' : 's'} gesendet.`,
                  )}
                >
                  Ausgewählte senden
                </button>
                <button
                  type="button"
                  className="dash-btn dash-btn--ghost"
                  disabled={saving || !matchingAvailable.length || !request.remaining}
                  onClick={() => {
                    const next = matchingAvailable.slice(0, Math.min(1, request.remaining)).map((lead) => lead.id);
                    return run(() => sendBeraterLeads(request.id, next), 'Nächster Lead gesendet.');
                  }}
                >
                  Nächsten senden
                </button>
              </div>
            </>
          ) : (
            <div className="dash-empty">
              <p>
                Keine unvergebenen {leadScopeLabel(requestScope)}-Leads im Pool.
                {otherAvailable.length
                  ? ` ${otherAvailable.length} andere Leads liegen im Bestand, passen aber nicht zu diesem Paket.`
                  : ' Importieren oder legen Sie zuerst passende Leads an.'}
              </p>
              <button type="button" className="dash-btn dash-btn--ghost" onClick={() => navigate('/dashboard/leads')}>
                Zu den Leads
              </button>
            </div>
          )}
        </section>
      ) : null}

      <section className="dash-panel">
        <div className="dash-panel-head">
          <strong>Gesendete Leads</strong>
          <span>{sent.length}</span>
        </div>
        {sent.length ? (
          <div className="dash-sent-list">
            {sent.map((lead) => (
              <div key={lead.id} className="dash-sent-item">
                <LeadListItem lead={lead} />
                {isOpenComplaint(lead.complaint) ? (
                  <span className="dash-badge dash-badge--warn">{complaintStatusLabel(lead.complaint.status)}</span>
                ) : null}
                {request && lead.requestId === request.id && !isOpenComplaint(lead.complaint) ? (
                  <button
                    type="button"
                    className="dash-btn dash-btn--ghost"
                    disabled={saving}
                    onClick={() => run(
                      () => recallBeraterLead(request.id, lead.id),
                      'Lead zurückgenommen.',
                    )}
                  >
                    Zurücknehmen
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty"><p>Diesem Berater wurden noch keine Leads gesendet.</p></div>
        )}
      </section>

      {refundedLeads.length ? (
        <section className="dash-panel">
          <div className="dash-panel-head">
            <strong>Erstattete Leads</strong>
            <span>{refundedLeads.length}</span>
          </div>
          <div className="dash-sent-list">
            {refundedLeads.map((lead) => (
              <div key={lead.id} className="dash-sent-item">
                <LeadListItem lead={lead} />
                <span className="dash-badge dash-badge--new">Erstattet</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
