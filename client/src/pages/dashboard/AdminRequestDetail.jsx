import { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  fetchAllRequests,
  fetchBeraterPipeline,
  leadTypeLabel,
  markRequestSeen,
  requestStatusLabel,
  requestStatusTone,
  autoFillBeraterRequest,
  fulfillmentModeLabel,
  isAutoFulfillment,
  sendBeraterLeads,
  updateBeraterRequest,
} from '../../lib/berater';
import {
  employmentLabel,
  formatLeadAddress,
  formatLeadDate,
  formatPremium,
  listLabels,
  statusLabel,
} from '../../lib/leads';
import { leadScopeLabel } from '../../lib/scopes';
import {
  EXISTING_PV_OPTIONS,
  energyLeadTypeOf,
  energyTypeLabel,
  normalizeVertical,
} from '../../lib/vertical';
import { sortLeadsByProximity } from '../../lib/googleMaps';
import { useDashboard } from '../../hooks/useDashboard';
import { formatDateTime, initials } from './helpers';
import { formatDistance } from './leads';
import {
  MATCH_TIERS,
  isAppointmentRequest,
  matchTierLabel,
  pickBestLeads,
} from './leadMatching';
import {
  beraterBusinessAddress,
  beraterName,
  formatBeraterAddress,
  isUnseenRequest,
  leadsForRequest,
  packageKindLabel,
  poolForRequest,
  progressCopy,
  progressPercent,
  requestCode,
  requestWorkflowStep,
} from './requestHelpers';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Pause,
  Radio,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Wand2,
  X,
} from 'lucide-react';

const WORKFLOW_STEPS = [
  { id: 'requested', label: 'Angefordert' },
  { id: 'fulfill', label: 'Beliefern' },
  { id: 'deliver', label: 'Zustellung' },
  { id: 'done', label: 'Erfüllt' },
];

const POOL_PAGE_SIZE = 15;

function DetailRow({ label, children }) {
  const value = children == null || children === '' ? '—' : children;
  return (
    <div className="dash-req-lead-panel__row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function isEnergyLead(lead) {
  return normalizeVertical(lead?.vertical) === 'energy';
}

function isAppointmentLead(lead) {
  return lead?.deliveryType === 'appointment';
}

function energyPackageLabel(lead) {
  const type = energyLeadTypeOf(lead);
  return type ? energyTypeLabel(type) : '';
}

function existingPvLabel(value) {
  return EXISTING_PV_OPTIONS.find((option) => option.id === value)?.label || '';
}

function EnergyPreviewGroups({ lead }) {
  const appointment = isAppointmentLead(lead);
  const showHeating = lead.energyProduct === 'heat_pump'
    || Boolean(lead.heatingSystem || lead.energySource || lead.replacementTimeframe);

  return (
    <>
      <section className="dash-req-lead-panel__group">
        <h3>Kontakt</h3>
        <div className="dash-req-lead-panel__list">
          <DetailRow label="E-Mail">{lead.email}</DetailRow>
          <DetailRow label="Telefon">{lead.phone}</DetailRow>
          <DetailRow label="Bundesland">{lead.state}</DetailRow>
        </div>
      </section>

      <section className="dash-req-lead-panel__group">
        <h3>{appointment ? 'Termin' : 'Lead'}</h3>
        <div className="dash-req-lead-panel__list">
          <DetailRow label="Paket">{energyPackageLabel(lead)}</DetailRow>
          <DetailRow label="Art">{appointment ? 'Termin' : 'Lead'}</DetailRow>
          {appointment ? (
            <DetailRow label="Termin am">
              {lead.appointmentAt ? formatDateTime(lead.appointmentAt) : null}
            </DetailRow>
          ) : null}
          <DetailRow label="Zeitrahmen">{lead.timeframe}</DetailRow>
          <DetailRow label="Bedarf">{lead.energyNeed}</DetailRow>
        </div>
      </section>

      {lead.callSummary ? (
        <section className="dash-req-lead-panel__group">
          <h3>Gesprächszusammenfassung</h3>
          <p className="dash-req-lead-panel__note">{lead.callSummary}</p>
        </section>
      ) : null}

      <section className="dash-req-lead-panel__group">
        <h3>Objekt &amp; Verbrauch</h3>
        <div className="dash-req-lead-panel__list">
          <DetailRow label="Eigentümer">{lead.ownerStatus}</DetailRow>
          <DetailRow label="Baujahr">{lead.constructionYear}</DetailRow>
          <DetailRow label="Stromverbrauch">{lead.annualConsumption}</DetailRow>
          <DetailRow label="PV vorhanden">{existingPvLabel(lead.existingPv)}</DetailRow>
          <DetailRow label="Dach / Gebäude">{lead.roofNotes}</DetailRow>
        </div>
      </section>

      {showHeating ? (
        <section className="dash-req-lead-panel__group">
          <h3>Heizung</h3>
          <div className="dash-req-lead-panel__list">
            <DetailRow label="Aktuelle Heizung">{lead.heatingSystem}</DetailRow>
            <DetailRow label="Energieträger">{lead.energySource}</DetailRow>
            <DetailRow label="Austausch">{lead.replacementTimeframe}</DetailRow>
          </div>
        </section>
      ) : null}
    </>
  );
}

function InsurancePreviewGroups({ lead }) {
  return (
    <>
      <section className="dash-req-lead-panel__group">
        <h3>Kontakt</h3>
        <div className="dash-req-lead-panel__list">
          <DetailRow label="E-Mail">{lead.email}</DetailRow>
          <DetailRow label="Telefon">{lead.phone}</DetailRow>
          <DetailRow label="Geburtsdatum">{formatLeadDate(lead.dateOfBirth)}</DetailRow>
        </div>
      </section>

      <section className="dash-req-lead-panel__group">
        <h3>Profil</h3>
        <div className="dash-req-lead-panel__list">
          <DetailRow label="Beruf">{employmentLabel(lead.employmentStatus)}</DetailRow>
          <DetailRow label="Beitrag">{formatPremium(lead.monthlyPremium)}</DetailRow>
          <DetailRow label="Personenkreis">{listLabels(lead.coverageCircle, 'coverage')}</DetailRow>
        </div>
      </section>

      <section className="dash-req-lead-panel__group">
        <h3>Versicherung</h3>
        <div className="dash-req-lead-panel__list">
          <DetailRow label="Status">{listLabels(lead.insuranceStatus, 'insurance')}</DetailRow>
          <DetailRow label="Anliegen">{listLabels(lead.mainConcerns, 'concern')}</DetailRow>
          <DetailRow label="Gesellschaft">{lead.currentInsurer}</DetailRow>
        </div>
      </section>
    </>
  );
}

function poolRowMeta(lead) {
  const detail = isEnergyLead(lead)
    ? [
      energyPackageLabel(lead),
      isAppointmentLead(lead) && lead.appointmentAt ? formatDateTime(lead.appointmentAt) : '',
    ]
    : [listLabels(lead.insuranceStatus, 'insurance')];
  return [formatLeadAddress(lead), ...detail].filter((value) => value && value !== '—');
}

function LeadPreviewPanel({ lead, onClose }) {
  if (!lead) {
    return (
      <section className="dash-panel dash-req-lead-panel">
        <div className="dash-req-lead-panel__head">
          <div>
            <strong>Lead-Details</strong>
            <p>Lead aus dem Pool auswählen</p>
          </div>
        </div>
        <div className="dash-req-lead-panel__empty">
          <span className="dash-req-lead-panel__empty-icon" aria-hidden="true">
            {initials({ fullName: '?' })}
          </span>
          <p>Klicken Sie auf einen Lead in der Liste, um Details hier zu sehen.</p>
        </div>
      </section>
    );
  }

  const distance = formatDistance(lead.distanceKm);
  const energy = isEnergyLead(lead);
  const packageChip = energy ? energyPackageLabel(lead) : leadScopeLabel(lead.scope);

  return (
    <section className="dash-panel dash-req-lead-panel">
      <div className="dash-req-lead-panel__head">
        <div>
          <strong>Lead-Details</strong>
          <p>Vorschau aus dem Pool</p>
        </div>
        <button type="button" className="dash-text-btn" onClick={onClose}>
          Schließen
        </button>
      </div>

      <div className="dash-req-lead-panel__body">
        <div className="dash-req-lead-panel__hero">
          <span className="dash-lead-avatar dash-lead-avatar--md" aria-hidden="true">
            {initials({ fullName: lead.fullName })}
          </span>
          <div className="dash-req-lead-panel__hero-copy">
            <strong>{lead.fullName || '—'}</strong>
            <small>{formatLeadAddress(lead)}</small>
            <div className="dash-req-lead-panel__chips">
              <span className="dash-badge dash-badge--muted">{statusLabel(lead.status)}</span>
              {packageChip ? <span className="dash-badge dash-badge--muted">{packageChip}</span> : null}
              {energy && isAppointmentLead(lead) ? (
                <span className="dash-badge dash-badge--ok">Termin</span>
              ) : null}
              {distance ? <span className="dash-badge dash-badge--muted">{distance}</span> : null}
            </div>
          </div>
        </div>

        <div className="dash-req-lead-panel__groups">
          {energy ? <EnergyPreviewGroups lead={lead} /> : <InsurancePreviewGroups lead={lead} />}

          {lead.notes ? (
            <section className="dash-req-lead-panel__group">
              <h3>Notiz</h3>
              <p className="dash-req-lead-panel__note">{lead.notes}</p>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RequestProgress({ request }) {
  const percent = progressPercent(request);
  const step = requestWorkflowStep(request);
  const size = 112;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - percent / 100);
  const state = request.status === 'cancelled'
    ? 'paused'
    : request.status === 'completed'
      ? 'done'
      : 'live';
  const paused = request.status === 'cancelled';

  return (
    <div className={`dash-request-progress is-${state}`}>
      <div className="dash-request-progress__main">
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
            {state === 'done' ? <Check size={20} /> : state === 'paused' ? <Pause size={16} /> : <Radio size={14} />}
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

      <ol className={`dash-req-steps${paused ? ' is-paused' : ''}`} aria-label="Workflow">
        {WORKFLOW_STEPS.map((entry, index) => {
          const done = index < step || (request.status === 'completed' && index <= step);
          const current = index === step && request.status !== 'completed';
          return (
            <li
              key={entry.id}
              className={`dash-req-steps__step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
            >
              <span className="dash-req-steps__dot" aria-hidden="true">
                {done && !current ? <Check size={11} /> : index + 1}
              </span>
              <span className="dash-req-steps__label">
                {paused && index === 1 ? 'Pausiert' : entry.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AiPickModal({ request, result, checkedIds, saving, error, onToggle, onSend, onClose }) {
  const unit = isAppointmentRequest(request) ? 'Termine' : 'Leads';
  const code = requestCode(request);

  return createPortal(
    <div className="dash-confirm-root dash-assign-modal-root" role="dialog" aria-modal="true" aria-labelledby="ai-pick-title">
      <button
        type="button"
        className="dash-confirm-overlay"
        aria-label="Schließen"
        onClick={saving ? undefined : onClose}
      />
      <div className={`dash-assign-modal dash-ai-pick${result.ok ? '' : ' is-short'}`}>
        <header className="dash-assign-modal__head">
          <div>
            <div className="dash-lead-kicker">
              KI-Auswahl{code ? ` · ${code}` : ''}
            </div>
            <h3 id="ai-pick-title">
              {result.ok ? `${result.picks.length} ${unit} ausgewählt` : 'Nicht genug Leads für den KI-Generator'}
            </h3>
            <p>
              {result.ok
                ? `Beste Treffer für ${result.needed} offene Plätze aus ${result.available} ${unit} im Pool`
                : `${result.available} von ${result.needed} benötigten ${unit} im Pool`}
            </p>
          </div>
          <button
            type="button"
            className="dash-assign-modal__close"
            aria-label="Schließen"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {result.ok ? (
          <div className="dash-ai-pick__legend">
            {MATCH_TIERS.map((tier) => (
              <span key={tier.id} className={`dash-ai-pick__chip is-${tier.id}`}>
                {tier.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="dash-ai-pick__warning">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>
              Der KI-Generator braucht mindestens so viele passende {unit} im Pool, wie offene Plätze vorhanden sind.
              Füllen Sie den Pool auf oder wählen Sie die vorhandenen {unit} manuell aus.
            </p>
          </div>
        )}

        {result.ok ? (
          <div className="dash-assign-modal__list dash-ai-pick__list">
            {result.picks.map(({ lead, tier, score, reasons }) => {
              const checked = checkedIds.includes(lead.id);
              return (
                <label
                  key={lead.id}
                  className={`dash-ai-pick__row is-${tier}${checked ? ' is-checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(lead.id)}
                    disabled={saving}
                  />
                  <span className="dash-ai-pick__copy">
                    <strong>{lead.fullName || '—'}</strong>
                    <small>{formatLeadAddress(lead)}</small>
                    <span className="dash-ai-pick__reasons">
                      {reasons.map((reason) => <em key={reason}>{reason}</em>)}
                    </span>
                  </span>
                  <span className={`dash-ai-pick__badge is-${tier}`} title={`${score} / 100`}>
                    {matchTierLabel(tier)}
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}

        <footer className="dash-assign-modal__foot">
          {error ? <div className="dash-alert">{error}</div> : null}
          <div className="dash-confirm-actions">
            <button type="button" className="dash-btn dash-btn--ghost" onClick={onClose} disabled={saving}>
              {result.ok ? 'Abbrechen' : 'Schließen'}
            </button>
            {result.ok ? (
              <button
                type="button"
                className="dash-btn dash-btn--ok"
                disabled={saving || !checkedIds.length}
                onClick={onSend}
              >
                <Send size={15} aria-hidden="true" />
                {saving ? 'Wird gesendet…' : `Senden (${checkedIds.length})`}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function AdminRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh: refreshDashboard } = useDashboard();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pool, setPool] = useState([]);
  const [sentLeads, setSentLeads] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [fillLoading, setFillLoading] = useState(false);
  const [proximitySorting, setProximitySorting] = useState(false);
  const [proximityMeta, setProximityMeta] = useState({ sorted: false, mode: null, originLabel: '' });
  const [poolQuery, setPoolQuery] = useState('');
  const [poolVisibleCount, setPoolVisibleCount] = useState(POOL_PAGE_SIZE);
  const [previewLeadId, setPreviewLeadId] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiCheckedIds, setAiCheckedIds] = useState([]);
  const poolScrollRef = useRef(null);

  const canFill = request?.status === 'active' && request?.remaining > 0;
  const isAuto = isAutoFulfillment(request);
  const beraterPath = request?.beraterId ? `/dashboard/berater/${request.beraterId}` : '';

  const filteredPool = useMemo(() => {
    const q = poolQuery.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((lead) => {
      const haystack = [
        lead.fullName,
        formatLeadAddress(lead),
        statusLabel(lead.status),
        formatDistance(lead.distanceKm),
        ...(lead.insuranceStatus || []),
        energyPackageLabel(lead),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [pool, poolQuery]);

  const visiblePool = useMemo(
    () => filteredPool.slice(0, poolVisibleCount),
    [filteredPool, poolVisibleCount],
  );
  const poolHasMore = poolVisibleCount < filteredPool.length;
  const previewLead = useMemo(() => {
    if (!previewLeadId) return null;
    return pool.find((lead) => lead.id === previewLeadId)
      || sentLeads.find((lead) => lead.id === previewLeadId)
      || null;
  }, [previewLeadId, pool, sentLeads]);

  useEffect(() => {
    setPoolVisibleCount(POOL_PAGE_SIZE);
    setPreviewLeadId('');
    if (poolScrollRef.current) poolScrollRef.current.scrollTop = 0;
  }, [request?.id, poolQuery, pool.length]);

  function onPoolScroll(event) {
    if (!poolHasMore) return;
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 96) return;
    setPoolVisibleCount((count) => Math.min(count + POOL_PAGE_SIZE, filteredPool.length));
  }

  async function buildSortedPool(availableLeads, entry, berater) {
    const scoped = poolForRequest(availableLeads, entry);
    const origin = beraterBusinessAddress(berater) || beraterBusinessAddress(entry?.berater);
    const originLabel = formatBeraterAddress(origin);

    if (!origin || !scoped.length) {
      return {
        leads: scoped,
        meta: { sorted: false, mode: null, originLabel },
      };
    }

    try {
      const result = await sortLeadsByProximity(scoped, origin);
      return {
        leads: result.leads,
        meta: {
          sorted: result.sorted,
          mode: result.mode,
          originLabel: result.originLabel || originLabel,
        },
      };
    } catch {
      return {
        leads: scoped,
        meta: { sorted: false, mode: null, originLabel },
      };
    }
  }

  async function loadRequest(requestId) {
    const payload = await fetchAllRequests();
    const next = (payload.requests || []).find((entry) => entry.id === requestId) || null;
    setRequest(next);
    if (next && !notesDirty) setNotesDraft(next.notes || '');
    return next;
  }

  async function loadFillData(entry) {
    if (!entry?.beraterId) {
      setPool([]);
      setSentLeads([]);
      setSelectedLeadIds([]);
      setPreviewLeadId('');
      setProximityMeta({ sorted: false, mode: null, originLabel: '' });
      setProximitySorting(false);
      return;
    }
    setFillLoading(true);
    try {
      const payload = await fetchBeraterPipeline(entry.beraterId);
      const scoped = poolForRequest(payload.availableLeads, entry);
      const origin = beraterBusinessAddress(payload.berater) || beraterBusinessAddress(entry?.berater);
      setPool(scoped);
      setSentLeads(leadsForRequest(payload.requestLeads, entry.id));
      setSelectedLeadIds([]);
      setPreviewLeadId('');
      setProximityMeta({
        sorted: false,
        mode: null,
        originLabel: formatBeraterAddress(origin),
      });
      setFillLoading(false);

      if (!origin || !scoped.length) {
        setProximitySorting(false);
        return;
      }

      setProximitySorting(true);
      const result = await buildSortedPool(payload.availableLeads, entry, payload.berater);
      startTransition(() => {
        setPool(result.leads);
        setProximityMeta(result.meta);
        setProximitySorting(false);
      });
    } catch (err) {
      setError(err.message);
      setPool([]);
      setSentLeads([]);
      setProximitySorting(false);
      setFillLoading(false);
    }
  }

  async function acknowledgeSeen(requestId, entry) {
    if (!requestId || (entry && !isUnseenRequest(entry))) return;
    try {
      const payload = await markRequestSeen(requestId);
      if (payload?.request) {
        setRequest((prev) => (prev?.id === requestId ? { ...prev, ...payload.request } : prev));
      }
      refreshDashboard({ silent: true }).catch(() => {});
    } catch {
      /* next poll corrects */
    }
  }

  useEffect(() => {
    if (!id) return undefined;
    let active = true;

    async function refresh() {
      try {
        const next = await loadRequest(id);
        if (!active) return;
        setError('');
        if (next) acknowledgeSeen(id, next);
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
  }, [id]);

  useEffect(() => {
    if (!request?.id || !request?.beraterId) {
      setPool([]);
      setSentLeads([]);
      setProximityMeta({ sorted: false, mode: null, originLabel: '' });
      setProximitySorting(false);
      return undefined;
    }
    let active = true;
    setFillLoading(true);

    fetchBeraterPipeline(request.beraterId)
      .then(async (payload) => {
        if (!active) return;
        const scoped = poolForRequest(payload.availableLeads, request);
        const origin = beraterBusinessAddress(payload.berater) || beraterBusinessAddress(request?.berater);
        setPool(scoped);
        setSentLeads(leadsForRequest(payload.requestLeads, request.id));
        setProximityMeta({
          sorted: false,
          mode: null,
          originLabel: formatBeraterAddress(origin),
        });
        setFillLoading(false);

        if (isAutoFulfillment(request) || !origin || !scoped.length) {
          setProximitySorting(false);
          return;
        }

        setProximitySorting(true);
        const result = await buildSortedPool(payload.availableLeads, request, payload.berater);
        if (!active) return;
        startTransition(() => {
          setPool(result.leads);
          setProximityMeta(result.meta);
          setProximitySorting(false);
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setFillLoading(false);
        setProximitySorting(false);
      });

    return () => {
      active = false;
    };
  }, [request?.id, request?.beraterId, request?.scope, request?.validCount, request?.remaining, request?.fulfillmentMode]);

  const proximityMessage = useMemo(() => {
    if (!proximityMeta.originLabel) {
      return 'Keine Berater-Adresse';
    }
    if (proximitySorting || (fillLoading && !pool.length)) {
      return `Berechne Nähe zu ${proximityMeta.originLabel}…`;
    }
    if (proximityMeta.sorted && proximityMeta.mode === 'geo') {
      return `Nähe: ${proximityMeta.originLabel}`;
    }
    if (proximityMeta.sorted && proximityMeta.mode === 'zip') {
      return `PLZ-Nähe: ${proximityMeta.originLabel}`;
    }
    return `Standort: ${proximityMeta.originLabel}`;
  }, [proximityMeta, proximitySorting, fillLoading, pool.length]);

  async function runUpdate(payload, success) {
    if (!request) return false;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateBeraterRequest(request.id, payload);
      const next = await loadRequest(request.id);
      if (next) await loadFillData(next);
      if (typeof success === 'string' && success) setNotice(success);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function runFill(action, success) {
    if (!request) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      const next = await loadRequest(request.id);
      if (next) await loadFillData(next);
      if (success) setNotice(success);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function toggleLead(leadId) {
    setSelectedLeadIds((current) => {
      if (current.includes(leadId)) return current.filter((item) => item !== leadId);
      if (!request?.remaining || current.length >= request.remaining) return current;
      return [...current, leadId];
    });
  }

  function sendSelected() {
    if (!request || !selectedLeadIds.length) return;
    const count = selectedLeadIds.length;
    return runFill(
      () => sendBeraterLeads(request.id, selectedLeadIds),
      `${count} Lead${count === 1 ? '' : 's'} gesendet.`,
    );
  }

  function openAiPick() {
    if (!request) return;
    const result = pickBestLeads(pool, request);
    setError('');
    setAiResult(result);
    setAiCheckedIds(result.ok ? result.picks.map((entry) => entry.lead.id) : []);
  }

  function closeAiPick() {
    setAiResult(null);
    setAiCheckedIds([]);
  }

  function toggleAiPick(leadId) {
    setAiCheckedIds((current) => (
      current.includes(leadId) ? current.filter((item) => item !== leadId) : [...current, leadId]
    ));
  }

  async function sendAiPicks() {
    if (!request || !aiCheckedIds.length) return;
    const ids = [...aiCheckedIds];
    const unit = isAppointmentRequest(request) ? 'Termin' : 'Lead';
    const ok = await runFill(
      () => sendBeraterLeads(request.id, ids),
      `${ids.length} ${unit}${ids.length === 1 ? '' : unit === 'Termin' ? 'e' : 's'} per KI-Auswahl gesendet.`,
    );
    if (ok) closeAiPick();
  }

  function disableAutoFulfillment() {
    return runUpdate(
      { fulfillmentMode: 'manual' },
      'Manuelle Belieferung aktiv — Sie wählen Leads selbst aus.',
    );
  }

  function runAutoFillNow() {
    if (!request) return;
    return runFill(async () => {
      const result = await autoFillBeraterRequest(request.id);
      const count = Number(result?.selectedCount) || (result?.leads || []).length;
      setNotice(
        result?.message
          || (count
            ? `${count} Lead${count === 1 ? '' : 's'} automatisch zugestellt.`
            : 'Keine passenden Leads im Pool gefunden.'),
      );
      return result;
    });
  }

  async function saveNotes() {
    const ok = await runUpdate({ notes: notesDraft }, 'Notiz gespeichert.');
    if (ok) setNotesDirty(false);
  }

  if (!id) return <Navigate to="/dashboard/anfordern" replace />;

  if (loading) {
    return (
      <div className="dash-stack">
        <Link className="dash-back" to="/dashboard/anfordern">
          <ArrowLeft size={16} /> Zurück zu Anforderungen
        </Link>
        <div className="dash-empty"><p>Laden…</p></div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="dash-stack">
        <Link className="dash-back" to="/dashboard/anfordern">
          <ArrowLeft size={16} /> Zurück zu Anforderungen
        </Link>
        <div className="dash-empty">
          <p>Anforderung wurde nicht gefunden.</p>
          <button type="button" className="dash-btn dash-btn--ghost" onClick={() => navigate('/dashboard/anfordern')}>
            Zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-stack dash-req-detail">
      <Link className="dash-back" to="/dashboard/anfordern">
        <ArrowLeft size={16} /> Zurück zu Anforderungen
      </Link>

      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <header className="dash-req-hero">
        <div className="dash-req-hero__main">
          <span className="dash-lead-avatar" aria-hidden="true">
            {initials(request.berater || {})}
          </span>
          <div className="dash-req-hero__copy">
            <div className="dash-lead-kicker">
              Anforderung{requestCode(request) ? ` · ${requestCode(request)}` : ''}
            </div>
            <h2>{beraterName(request)}</h2>
            <p>
              {packageKindLabel(request.scope)} · {leadTypeLabel(request.leadType)} · {request.requestedCount}{' '}
              {String(request.leadType || '').includes('APPOINTMENT') ? 'Termine' : 'Leads'}
              {request.berater?.company ? ` · ${request.berater.company}` : ''}
            </p>
            <div className="dash-drawer-chips">
              <span className={`dash-badge dash-badge--${requestStatusTone(request.status)}`}>
                {requestStatusLabel(request.status)}
              </span>
              <span className={`dash-badge dash-badge--${isAuto ? 'ok' : 'muted'}`}>
                {fulfillmentModeLabel(request.fulfillmentMode)}
              </span>
              <span className="dash-badge dash-badge--muted">{packageKindLabel(request.scope)}</span>
              <span className="dash-badge dash-badge--muted">{leadTypeLabel(request.leadType)}</span>
              {request.reportedCount > 0 ? (
                <span className="dash-badge dash-badge--warn">{request.reportedCount} Reklamation{request.reportedCount === 1 ? '' : 'en'}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="dash-req-hero__actions">
          {request.status === 'active' ? (
            <button
              type="button"
              className="dash-btn dash-btn--red"
              disabled={saving}
              onClick={() => runUpdate({ status: 'cancelled' }, 'Auftrag pausiert.')}
            >
              Pausieren
            </button>
          ) : null}
          {request.status === 'cancelled' ? (
            <button
              type="button"
              className="dash-btn"
              disabled={saving}
              onClick={() => runUpdate({ status: 'active' }, 'Auftrag fortgesetzt.')}
            >
              Fortsetzen
            </button>
          ) : null}
          {beraterPath ? (
            <Link className="dash-btn dash-btn--green" to={beraterPath}>
              Berater öffnen
            </Link>
          ) : null}
        </div>
      </header>

      <div className="dash-req-top">
        <section className="dash-panel dash-req-progress-card">
          <div className="dash-panel-head">
            <div>
              <strong>Fortschritt</strong>
              <p className="dash-panel-lede">Lieferstand und Workflow</p>
            </div>
            <small>{formatDateTime(request.createdAt)}</small>
          </div>
          <RequestProgress request={request} />
        </section>

        <section className="dash-panel dash-req-notes-card">
          <div className="dash-req-notes-card__head">
            <span className="dash-req-notes-card__icon" aria-hidden="true">
              <StickyNote size={16} />
            </span>
            <div>
              <strong>Interne Notiz</strong>
              <p>Arbeitsnotiz für die Bearbeitung — nur Admins</p>
            </div>
          </div>
          <label className="dash-req-notes">
            <span className="sr-only">Interne Notiz</span>
            <textarea
              value={notesDraft}
              onChange={(event) => {
                setNotesDraft(event.target.value);
                setNotesDirty(true);
              }}
              placeholder="Kurze Notiz hinterlassen…"
              disabled={saving}
            />
          </label>
          <div className="dash-req-notes-card__foot">
            <span className={`dash-req-notes-card__hint${notesDirty ? ' is-dirty' : ''}`}>
              {notesDirty ? 'Ungespeicherte Änderungen' : 'Automatisch nur beim Speichern übernommen'}
            </span>
            <button
              type="button"
              className={`dash-btn${notesDirty ? '' : ' dash-btn--ghost'}`}
              disabled={saving || !notesDirty}
              onClick={saveNotes}
            >
              Speichern
            </button>
          </div>
        </section>
      </div>

      <div className={`dash-req-layout${isAuto ? ' is-auto' : ''}`}>
        {isAuto ? (
          <section className="dash-panel dash-req-send dash-req-auto">
            <div className="dash-panel-head">
              <div>
                <strong>Automatische Belieferung</strong>
                <p className="dash-panel-lede">
                  Sofortige Zustellung — nicht warten bis die volle Anzahl im Pool ist
                </p>
              </div>
              <span className="dash-badge dash-badge--ok">Automatisch</span>
            </div>

            <div className="dash-req-auto__body">
              <div className="dash-req-auto__hero">
                <span className="dash-req-auto__icon" aria-hidden="true">
                  <Sparkles size={18} />
                </span>
                <div>
                  <strong>
                    {request.status === 'completed'
                      ? 'Anforderung ist erfüllt'
                      : request.status === 'cancelled'
                        ? 'Automatik pausiert'
                        : request.remaining > 0
                          ? `${request.remaining} Lead${request.remaining === 1 ? '' : 's'} noch offen`
                          : 'Keine offenen Plätze'}
                  </strong>
                  <p>
                    {request.status === 'cancelled'
                      ? 'Setzen Sie die Anforderung fort, damit die Automatik wieder sofort zustellt.'
                      : request.status === 'completed'
                        ? 'Alle angefragten Leads wurden zugestellt. Zugestellte Leads sehen Sie unten.'
                        : 'Beim Aktivieren der Automatik werden passende Leads sofort zugestellt (nächste zuerst). Jeder neue passende Pool-Lead (Import, manuell, TC-Dial) wird automatisch dieser Anforderung zugewiesen, bis sie erfüllt ist.'}
                  </p>
                </div>
              </div>

              <div className="dash-req-auto__stats">
                <div>
                  <span>Offen</span>
                  <b>{request.remaining}</b>
                </div>
                <div>
                  <span>Gültig</span>
                  <b>{request.validCount}</b>
                </div>
                <div>
                  <span>Paket</span>
                  <b>{leadScopeLabel(request.scope)}</b>
                </div>
                <div>
                  <span>Zuletzt auto</span>
                  <b>{request.autoFilledAt ? formatDateTime(request.autoFilledAt) : '—'}</b>
                </div>
              </div>

              <div className="dash-req-auto__actions">
                {canFill ? (
                  <button
                    type="button"
                    className="dash-btn dash-btn--ghost"
                    disabled={Boolean(saving)}
                    onClick={runAutoFillNow}
                    title="Erneut versuchen, offene Plätze mit aktuellen Pool-Leads zu füllen"
                  >
                    <Wand2 size={15} aria-hidden="true" />
                    <span>Offene nachfüllen</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="dash-btn dash-btn--ghost"
                  disabled={Boolean(saving) || request.status === 'completed'}
                  onClick={disableAutoFulfillment}
                >
                  Auf manuell umstellen
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
          <section className="dash-panel dash-req-send">
            <div className="dash-panel-head">
              <div>
                <strong>Leads senden</strong>
                <p className="dash-panel-lede">
                  Pool für Paket {leadScopeLabel(request.scope)} — passende freie Leads auswählen und zustellen
                </p>
              </div>
              {request.status === 'active' && request.remaining > 0 ? (
                <button
                  type="button"
                  className="dash-btn dash-ai-btn"
                  disabled={Boolean(saving) || fillLoading || proximitySorting}
                  onClick={openAiPick}
                  title="Die passendsten Leads für diese Anforderung automatisch vorschlagen"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  KI-Auswahl
                </button>
              ) : null}
            </div>

            {request.status === 'cancelled' ? (
              <p className="dash-panel-note">Setzen Sie die Anforderung fort, bevor Sie Leads senden.</p>
            ) : request.status === 'completed' ? (
              <p className="dash-panel-note">Anforderung ist erfüllt. Alle angefragten Leads wurden zugestellt.</p>
            ) : (
              <div className="dash-req-send__body">
                <div className="dash-req-send__tools">
                  <div className="dash-req-send__search-block">
                    <label className="dash-req-search dash-req-search--grow">
                      <Search size={15} />
                      <input
                        type="text"
                        value={poolQuery}
                        onChange={(event) => setPoolQuery(event.target.value)}
                        placeholder="Name, Ort oder Status…"
                        disabled={fillLoading || !pool.length}
                      />
                    </label>
                    <p className={`dash-req-send__proximity${proximityMeta.originLabel ? '' : ' is-muted'}`}>
                      <span>{proximityMessage}</span>
                    </p>
                  </div>
                </div>

                {fillLoading ? (
                  <p className="dash-panel-note">Pool wird geladen…</p>
                ) : filteredPool.length ? (
                  <div
                    ref={poolScrollRef}
                    className="dash-req-pool"
                    onScroll={onPoolScroll}
                  >
                    {visiblePool.map((lead) => {
                      const checked = selectedLeadIds.includes(lead.id);
                      const atLimit = !checked && selectedLeadIds.length >= request.remaining;
                      const disabled = Boolean(saving) || !canFill || atLimit;
                      const previewed = previewLeadId === lead.id;
                      const meta = poolRowMeta(lead);
                      const distance = formatDistance(lead.distanceKm);
                      const distanceTone = distance
                        ? (Number(lead.distanceKm) < 10 ? ' is-near' : ' is-far')
                        : ' is-empty';
                      return (
                        <div
                          key={lead.id}
                          className={`dash-req-pool__row${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}${previewed ? ' is-preview' : ''}`}
                        >
                          <button
                            type="button"
                            className={`dash-req-pool__check${checked ? ' is-on' : ''}`}
                            aria-pressed={checked}
                            aria-label={`${lead.fullName || 'Lead'} ${checked ? 'abwählen' : 'auswählen'}`}
                            disabled={disabled}
                            onClick={() => toggleLead(lead.id)}
                          >
                            {checked ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
                          </button>
                          <button
                            type="button"
                            className="dash-req-pool__open"
                            aria-pressed={previewed}
                            onClick={() => setPreviewLeadId((current) => (
                              current === lead.id ? '' : lead.id
                            ))}
                          >
                            <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
                              {initials({ fullName: lead.fullName })}
                            </span>
                            <span className="dash-req-pool__copy">
                              <strong>{lead.fullName || '—'}</strong>
                              <small>{meta.length ? meta.join(' · ') : '—'}</small>
                            </span>
                            <span className={`dash-req-pool__distance${distanceTone}`}>
                              {distance || '—'}
                            </span>
                            <span className="dash-req-pool__status">{statusLabel(lead.status)}</span>
                          </button>
                        </div>
                      );
                    })}
                    <div className="dash-req-pool__footer">
                      {poolHasMore ? (
                        <button
                          type="button"
                          className="dash-text-btn"
                          onClick={() => setPoolVisibleCount((count) => (
                            Math.min(count + POOL_PAGE_SIZE, filteredPool.length)
                          ))}
                        >
                          Mehr laden ({visiblePool.length} von {filteredPool.length})
                        </button>
                      ) : (
                        <span>{filteredPool.length} Leads im Pool</span>
                      )}
                    </div>
                  </div>
                ) : pool.length ? (
                  <p className="dash-panel-note">Keine Treffer in der Pool-Suche.</p>
                ) : (
                  <div className="dash-empty dash-empty--compact">
                    <p>Keine freien Leads im Pool für Paket {leadScopeLabel(request.scope)}.</p>
                    <Link className="dash-btn dash-btn--ghost" to="/dashboard/leads">
                      Zu den Leads
                    </Link>
                  </div>
                )}

                {pool.length ? (
                  <div className="dash-req-send__bar">
                    <div className="dash-req-send__bar-copy">
                      <strong>
                        {selectedLeadIds.length
                          ? `${selectedLeadIds.length} ausgewählt`
                          : 'Keine Auswahl'}
                      </strong>
                      <span>
                        {selectedLeadIds.length
                          ? `von ${request.remaining} offenen Plätzen`
                          : 'Leads markieren, dann senden'}
                      </span>
                    </div>
                    <div className="dash-req-send__bar-actions">
                      <button
                        type="button"
                        className="dash-btn"
                        disabled={Boolean(saving) || !canFill || !selectedLeadIds.length}
                        onClick={sendSelected}
                      >
                        <Send size={15} aria-hidden="true" />
                        <span>Senden{selectedLeadIds.length ? ` (${selectedLeadIds.length})` : ''}</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>

        <aside className="dash-req-side">
          <LeadPreviewPanel
            lead={previewLead}
            onClose={() => setPreviewLeadId('')}
          />
        </aside>
          </>
        )}

          <section className="dash-panel dash-req-delivered">
            <div className="dash-panel-head">
              <div>
                <strong>Zugestellte Leads</strong>
                <p className="dash-panel-lede">
                  {fillLoading ? 'Laden…' : `${sentLeads.length} zugestellt`}
                </p>
              </div>
            </div>

            {fillLoading ? (
              <p className="dash-panel-note">Leads werden geladen…</p>
            ) : sentLeads.length ? (
              <div className="dash-sent-list">
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
                        state={{ from: `/dashboard/anfordern/${request.id}` }}
                      >
                        Öffnen
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dash-panel-note">Dieser Anforderung wurden noch keine Leads zugestellt.</p>
            )}
          </section>
      </div>

      {aiResult ? (
        <AiPickModal
          request={request}
          result={aiResult}
          checkedIds={aiCheckedIds}
          saving={Boolean(saving)}
          error={error}
          onToggle={toggleAiPick}
          onSend={sendAiPicks}
          onClose={closeAiPick}
        />
      ) : null}
    </div>
  );
}
