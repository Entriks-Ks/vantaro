import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Sparkles, Hand } from 'lucide-react';
import {
  fetchAllRequests,
  fulfillmentModeLabel,
  isAutoFulfillment,
  leadTypeLabel,
  requestStatusLabel,
  requestStatusTone,
  updateBeraterRequest,
} from '../../lib/berater';
import { DashSeg } from './DashboardLayout';
import { formatDate, initials } from './helpers';
import {
  beraterName,
  isUnseenRequest,
  packageKindLabel,
  progressPercent,
  requestCode,
} from './requestHelpers';

function RequestStatusButtons({ entry, saving, onRun, className }) {
  if (entry.status !== 'active' && entry.status !== 'cancelled') return null;

  return (
    <div className={className}>
      {entry.status === 'active' ? (
        <button
          type="button"
          className="dash-btn dash-btn--ghost"
          disabled={Boolean(saving)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRun(entry.id, { status: 'cancelled' }, 'Auftrag pausiert.');
          }}
        >
          Pausieren
        </button>
      ) : (
        <button
          type="button"
          className="dash-btn"
          disabled={Boolean(saving)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRun(entry.id, { status: 'active' }, 'Auftrag fortgesetzt.');
          }}
        >
          Fortsetzen
        </button>
      )}
    </div>
  );
}

function FulfillmentModeControl({ entry, saving, onToggle }) {
  const isAuto = isAutoFulfillment(entry);
  const busy = saving === entry.id;
  const locked = entry.status === 'completed' || entry.status === 'rejected';

  if (locked) {
    return (
      <span className={`dash-req-mode-pill${isAuto ? ' is-auto' : ''}`} title="Belieferungsmodus">
        {isAuto ? <Sparkles size={12} aria-hidden="true" /> : <Hand size={12} aria-hidden="true" />}
        {fulfillmentModeLabel(entry.fulfillmentMode)}
      </span>
    );
  }

  return (
    <div
      className="dash-req-mode"
      role="group"
      aria-label="Belieferungsmodus"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className={`dash-req-mode__btn${!isAuto ? ' is-active' : ''}`}
        disabled={busy}
        aria-pressed={!isAuto}
        onClick={() => {
          if (!isAuto) return;
          onToggle(entry.id, 'manual');
        }}
      >
        <Hand size={12} aria-hidden="true" />
        Manuell
      </button>
      <button
        type="button"
        className={`dash-req-mode__btn${isAuto ? ' is-active is-auto' : ''}`}
        disabled={busy}
        aria-pressed={isAuto}
        onClick={() => {
          if (isAuto) return;
          onToggle(entry.id, 'auto');
        }}
      >
        <Sparkles size={12} aria-hidden="true" />
        Auto
      </button>
    </div>
  );
}

export function AdminRequests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');

  async function load() {
    const payload = await fetchAllRequests();
    setRequests(payload.requests || []);
    return payload;
  }

  useEffect(() => {
    const requestId = searchParams.get('request');
    if (requestId) {
      navigate(`/dashboard/anfordern/${requestId}`, { replace: true });
    }
  }, [searchParams, navigate]);

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
    const base = filter === 'all' ? requests : requests.filter((entry) => entry.status === filter);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((entry) => {
      const haystack = [
        beraterName(entry),
        requestCode(entry),
        entry.berater?.company,
        entry.berater?.email,
        leadTypeLabel(entry.leadType),
        packageKindLabel(entry.scope),
        fulfillmentModeLabel(entry.fulfillmentMode),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, query, requests]);

  const activeCount = requests.filter((entry) => entry.status === 'active').length;
  const unseenCount = requests.filter(isUnseenRequest).length;
  const pausedCount = requests.filter((entry) => entry.status === 'cancelled').length;
  const completedCount = requests.filter((entry) => entry.status === 'completed').length;

  async function run(id, payload, success) {
    setSaving(id);
    setError('');
    setNotice('');
    try {
      const result = await updateBeraterRequest(id, payload);
      await load();
      if (payload?.fulfillmentMode === 'auto') {
        const sent = Number(result?.autoFill?.selectedCount) || (result?.autoFill?.leads || []).length || 0;
        const left = Number(result?.request?.remaining);
        if (sent > 0) {
          setNotice(
            Number.isFinite(left) && left > 0
              ? `Automatik aktiv — ${sent} Lead${sent === 1 ? '' : 's'} sofort zugestellt · noch ${left} offen.`
              : `Automatik aktiv — ${sent} Lead${sent === 1 ? '' : 's'} sofort zugestellt.`,
          );
        } else {
          setNotice('Automatik aktiv — passende Leads werden sofort zugestellt, sobald sie im Pool sind.');
        }
      } else if (payload?.fulfillmentMode === 'manual') {
        setNotice('Manuelle Belieferung aktiv.');
      } else if (success) {
        setNotice(success);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  function setFulfillmentMode(id, mode) {
    return run(id, { fulfillmentMode: mode });
  }

  return (
    <div className="dash-stack">
      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <div className="dash-metrics dash-metrics--three">
        <div className="dash-metric">
          <span>Ungesehen</span>
          <strong>{loading ? '—' : unseenCount}</strong>
          <small>noch nicht geöffnet</small>
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
        <div className="dash-toolbar dash-toolbar--request">
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
          <label className="dash-req-search dash-req-search--toolbar">
            <Search size={15} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code, Berater, Firma…"
            />
          </label>
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : visible.length ? (
          <div className="dash-lead-list">
            {visible.map((entry) => (
              <Link
                key={entry.id}
                to={`/dashboard/anfordern/${entry.id}`}
                className={`dash-lead-row dash-request-row is-${entry.status === 'cancelled' ? 'paused' : entry.status}${isUnseenRequest(entry) ? ' is-unseen' : ''}${isAutoFulfillment(entry) ? ' is-auto' : ''}`}
              >
                <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
                  {initials(entry.berater || {})}
                </span>
                <div className="dash-lead-row-main">
                  <strong>
                    {beraterName(entry)}
                    {requestCode(entry) ? <span className="dash-request-code"> · {requestCode(entry)}</span> : null}
                    {isUnseenRequest(entry) ? <span className="dash-request-new">Neu</span> : null}
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
                  <div className="dash-request-meta__info">
                    <span className={`dash-badge dash-badge--${requestStatusTone(entry.status)}`}>
                      {requestStatusLabel(entry.status)}
                    </span>
                    <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                  </div>
                  <div className="dash-request-meta__controls">
                    <FulfillmentModeControl
                      entry={entry}
                      saving={saving}
                      onToggle={setFulfillmentMode}
                    />
                    <RequestStatusButtons
                      entry={entry}
                      saving={saving}
                      onRun={run}
                      className="dash-row-actions"
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dash-empty">
            <p>
              {query.trim()
                ? 'Keine Treffer für diese Suche.'
                : 'Keine Anforderungen für diesen Filter. Neue Berater-Anforderungen sind sofort aktiv und starten manuell.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
