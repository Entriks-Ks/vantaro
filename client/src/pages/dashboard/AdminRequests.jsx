import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAllRequests,
  leadTypeLabel,
  requestStatusLabel,
  requestStatusTone,
  updateBeraterRequest,
} from '../../lib/berater';
import { leadScopeLabel } from '../../lib/scopes';
import { formatCardExpiry, formatCardMask } from '../../lib/payments';
import { DashSeg } from './DashboardLayout';
import { formatDate, formatEuroExact, initials } from './helpers';

function beraterName(request) {
  return request.berater?.fullName || request.berater?.email || 'Unbekannt';
}

export function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('pending');

  async function load() {
    const payload = await fetchAllRequests();
    setRequests(payload.requests || []);
    return payload;
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

  const visible = useMemo(() => {
    if (filter === 'all') return requests;
    if (filter === 'open') {
      return requests.filter((entry) => entry.status === 'pending' || entry.status === 'active');
    }
    return requests.filter((entry) => entry.status === filter);
  }, [filter, requests]);

  const pendingCount = requests.filter((entry) => entry.status === 'pending').length;
  const activeCount = requests.filter((entry) => entry.status === 'active').length;
  const completedCount = requests.filter((entry) => entry.status === 'completed').length;

  async function run(id, payload, success) {
    setSaving(id);
    setError('');
    setNotice('');
    try {
      await updateBeraterRequest(id, payload);
      await load();
      if (success) setNotice(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="dash-stack">
      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <div className="dash-metrics dash-metrics--three">
        <div className="dash-metric dash-metric--signal">
          <span>Ausstehend</span>
          <strong>{loading ? '—' : pendingCount}</strong>
          <small>warten auf Freigabe</small>
        </div>
        <div className="dash-metric">
          <span>Aktiv</span>
          <strong>{loading ? '—' : activeCount}</strong>
          <small>empfangsberechtigt</small>
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
              { id: 'pending', label: 'Ausstehend', count: loading ? null : pendingCount },
              { id: 'active', label: 'Aktiv', count: loading ? null : activeCount },
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
              <article key={entry.id} className="dash-lead-row dash-request-row">
                <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
                  {initials(entry.berater || {})}
                </span>
                <div className="dash-lead-row-main">
                  <strong>{beraterName(entry)}</strong>
                  <span className="dash-lead-row-sub">
                    {[entry.berater?.company, entry.berater?.email].filter(Boolean).join(' · ')}
                  </span>
                  <span className="dash-lead-row-tags">
                    {leadScopeLabel(entry.scope)} · {leadTypeLabel(entry.leadType)} · {entry.requestedCount} angefordert · {entry.deliveredCount} zugestellt · {entry.validCount} gültig · {entry.remaining} offen
                    {entry.refundedCount ? ` · ${entry.refundedCount} erstattet` : ''}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </span>
                  {entry.payment ? (
                    <span className="dash-lead-row-tags">
                      Bezahlt · {entry.payment.invoiceNumber} · {formatEuroExact(entry.payment.grossCents)} · {formatCardMask(entry.payment)}
                      {entry.payment.cardExpMonth ? ` · ${formatCardExpiry(entry.payment)}` : ''}
                      {entry.payment.cardHolder ? ` · ${entry.payment.cardHolder}` : ''}
                      {entry.payment.testMode ? ' · Testbetrieb' : ''}
                    </span>
                  ) : (
                    <span className="dash-lead-row-tags">Keine Zahlung hinterlegt</span>
                  )}
                </div>
                <div className="dash-lead-row-side">
                  <span className={`dash-badge dash-badge--${requestStatusTone(entry.status)}`}>
                    {requestStatusLabel(entry.status)}
                  </span>
                  <small>{formatDate(entry.createdAt)}</small>
                  <div className="dash-row-actions">
                    {entry.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className="dash-btn"
                          disabled={Boolean(saving)}
                          onClick={() => run(entry.id, { status: 'active' }, 'Anforderung angenommen.')}
                        >
                          Annehmen
                        </button>
                        <button
                          type="button"
                          className="dash-btn dash-btn--ghost"
                          disabled={Boolean(saving)}
                          onClick={() => run(entry.id, { status: 'rejected' }, 'Anforderung abgelehnt.')}
                        >
                          Ablehnen
                        </button>
                      </>
                    ) : null}
                    {entry.status === 'active' ? (
                      <button
                        type="button"
                        className="dash-btn dash-btn--ghost"
                        disabled={Boolean(saving)}
                        onClick={() => run(entry.id, { status: 'cancelled' }, 'Auftrag deaktiviert.')}
                      >
                        Deaktivieren
                      </button>
                    ) : null}
                    {entry.beraterId ? (
                      <Link className="dash-btn dash-btn--ghost" to={`/dashboard/berater/${entry.beraterId}`}>
                        Leads
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="dash-empty">
            <p>Keine Anforderungen für diesen Filter. Neue Berater-Anforderungen erscheinen hier sofort.</p>
          </div>
        )}
      </section>
    </div>
  );
}
