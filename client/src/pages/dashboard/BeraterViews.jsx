import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Check, ChevronDown, ChevronRight, Eye, EyeOff, FileText, Flag, LayoutGrid, List, Shield, User, Wand2, X } from 'lucide-react';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import AddressMap from '../../components/AddressMap';
import PhoneField, { isValidMobile } from '../../components/PhoneField';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import { didGoogleMapsAuthFail, geocodeAddress, hasGoogleMapsKey, isInGermany, reverseGeocode } from '../../lib/googleMaps';
import {
  fetchMyRequests,
} from '../../lib/berater';
import {
  COMPLAINT_REASON_OPTIONS,
  complaintReasonLabel,
  complaintStatusLabel,
  isOpenComplaint,
  reportLead,
} from '../../lib/complaints';
import {
  employmentLabel,
  fetchLead,
  fetchMyLeads,
  formatLeadAddress,
  formatLeadDate,
  formatPremium,
  listLabels,
  updateLead,
} from '../../lib/leads';
import { LEGAL_FORMS, fileToAvatarDataUrl, generatePassword, validatePassword } from '../../lib/profile';
import { firstName, formatDate, formatDateTime, formatEuroExact, greeting, initials } from './helpers';
import { MIN_LEAD_PACK, PACKAGES, packageById, packTotalCents } from './packages';
import { DEFAULT_LEAD_SCOPE, leadScopeLabel } from '../../lib/scopes';
import { checkoutLeadPackage, fetchMyPayments, formatCardMask, formatCardNumberInput, formatExpiryInput, TEST_CARD } from '../../lib/payments';
import {
  LEAD_STATUSES,
  PRODUCT_FILTERS,
  VIEW_MODES,
  formatDistance,
  leadPriceCents,
  leadProductCode,
  leadQualityLabel,
  pipelineStatusOf,
  statusLabel,
} from './leads';

function leadProduct(lead) {
  const filter = PRODUCT_FILTERS.find((option) => option.id === leadProductCode(lead));
  return filter?.label || leadProductCode(lead);
}

function withPipeline(lead, leadStatuses) {
  const status = pipelineStatusOf(lead, leadStatuses);
  return {
    ...lead,
    status,
    productCode: leadProductCode(lead),
    product: leadProduct(lead),
    quality: leadQualityLabel(lead),
    priceCents: leadPriceCents(lead),
    address: formatLeadAddress(lead),
    name: lead.fullName,
  };
}

function LeadReportPanel({ lead, onReported }) {
  const complaint = lead?.complaint;
  const openComplaint = isOpenComplaint(complaint);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('invalid');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  function closeModal() {
    setOpen(false);
    setError('');
    setComment('');
    setReason('invalid');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await reportLead(lead.id, { reason, comment });
      closeModal();
      onReported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (complaint) {
    return (
      <div className="broker-detail-side-block broker-detail-report-block is-submitted">
        <div className={`broker-detail-report-done broker-detail-report-done--${complaint.status}`}>
          <span className="broker-detail-report-done-icon" aria-hidden="true">
            <Check size={18} />
          </span>
          <div>
            <strong>{complaintStatusLabel(complaint.status)}</strong>
            <span>{complaintReasonLabel(complaint.reason)}</span>
            {complaint.comment ? <em>{complaint.comment}</em> : null}
            {complaint.status === 'declined' && complaint.adminNote ? (
              <span><strong>Antwort Admin:</strong> {complaint.adminNote}</span>
            ) : null}
            <small>{formatDate(complaint.createdAt)}</small>
          </div>
        </div>
        {complaint.status === 'declined' ? (
          <button type="button" className="broker-text-btn" onClick={() => setOpen(true)}>
            Erneut reklamieren
          </button>
        ) : openComplaint ? (
          <p className="broker-muted-note">Die Reklamation liegt dem Admin zur Prüfung vor.</p>
        ) : null}
        {open ? <ReportModal lead={lead} reason={reason} setReason={setReason} comment={comment} setComment={setComment} error={error} saving={saving} onClose={closeModal} onSubmit={handleSubmit} panelRef={panelRef} /> : null}
      </div>
    );
  }

  return (
    <>
      <div className="broker-detail-side-block broker-detail-report-block">
        <button type="button" className="broker-report-trigger" onClick={() => setOpen(true)}>
          <span className="broker-report-trigger-icon" aria-hidden="true">
            <Flag size={18} />
          </span>
          <span className="broker-report-trigger-copy">
            <strong>Lead reklamieren</strong>
            <small>Admin prüft und erstattet oder lehnt ab</small>
          </span>
          <ChevronRight size={16} className="broker-report-trigger-caret" aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <ReportModal
          lead={lead}
          reason={reason}
          setReason={setReason}
          comment={comment}
          setComment={setComment}
          error={error}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
          panelRef={panelRef}
        />
      ) : null}
    </>
  );
}

function ReportModal({
  lead,
  reason,
  setReason,
  comment,
  setComment,
  error,
  saving,
  onClose,
  onSubmit,
  panelRef,
}) {
  return (
    <div className="broker-modal broker-report-modal-wrap" role="dialog" aria-modal="true">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={onClose} />
      <form ref={panelRef} className="broker-modal__panel broker-report-modal" onSubmit={onSubmit}>
        <div className="broker-report-modal__head">
          <div className="broker-report-modal__intro">
            <span className="broker-report-modal__badge">Reklamation</span>
            <h2>Lead reklamieren</h2>
            <p className="broker-report-modal__lead">{lead.fullName}</p>
          </div>
          <button type="button" className="broker-report-close" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>
        <div className="broker-report-modal__body">
          {error ? <div className="broker-alert">{error}</div> : null}
          <label>
            Grund
            <select value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving}>
              {COMPLAINT_REASON_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Zusatzinfo (freiwillig)
            <textarea
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={saving}
              placeholder="Was ist an diesem Lead nicht korrekt?"
            />
          </label>
        </div>
        <div className="broker-report-actions">
          <button type="submit" className="broker-save broker-save--inline" disabled={saving}>
            {saving ? 'Wird gesendet⬦' : 'Reklamation senden'}
          </button>
          <button type="button" className="broker-text-btn" disabled={saving} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}

export function BeraterHome() {
  const { user } = useAuth();
  const { leadStatuses } = useBroker();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchMyLeads()
      .then((payload) => {
        if (!active) return;
        setLeads(payload.leads || []);
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

  const pipelineLeads = useMemo(
    () => leads.map((lead) => withPipeline(lead, leadStatuses)),
    [leads, leadStatuses],
  );

  const stats = useMemo(() => {
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((status) => [status.id, 0]));
    pipelineLeads.forEach((lead) => {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    });
    return {
      total: pipelineLeads.length,
      neu: byStatus.neu || 0,
      kontaktiert: byStatus.kontaktiert || 0,
      termin: byStatus.termin || 0,
      wiedervorlage: byStatus.wiedervorlage || 0,
      abgeschlossen: byStatus.abgeschlossen || 0,
    };
  }, [pipelineLeads]);

  const recent = pipelineLeads.slice(0, 5);

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Lead-Übersicht</div>
          <h1>{greeting()}, <em>{firstName(user)}</em></h1>
          <p className="lede">Pipeline und Bestand Ihrer Chancen — ohne Zahlungsfokus.</p>
        </div>
      </div>

      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-home-metrics broker-home-metrics--leads">
        <div className="broker-home-metric is-signal">
          <span>Im Bestand</span>
          <strong>{loading ? '—' : stats.total}</strong>
          <small>Aktive Leads</small>
        </div>
        <div className="broker-home-metric">
          <span>Neu</span>
          <strong>{loading ? '—' : stats.neu}</strong>
          <small>Noch nicht kontaktiert</small>
        </div>
        <div className="broker-home-metric">
          <span>In Bearbeitung</span>
          <strong>{loading ? '—' : stats.kontaktiert + stats.termin + stats.wiedervorlage}</strong>
          <small>{stats.kontaktiert} kontaktiert · {stats.termin} Termin · {stats.wiedervorlage} Wiedervorlage</small>
        </div>
        <div className="broker-home-metric">
          <span>Abgeschlossen</span>
          <strong>{loading ? '—' : stats.abgeschlossen}</strong>
          <small>Vorgänge beendet</small>
        </div>
      </div>

      <div className="broker-home-actions">
        <Link className="btn btn-primary" to="/dashboard/leads">Zu Meine Leads</Link>
        <Link className="btn btn-outline" to="/dashboard/leads">Kanban öffnen</Link>
      </div>

      <section className="broker-panel broker-home-recent">
        <div className="broker-panel-header">
          <div>
            <h2>Aktuelle Leads</h2>
            <p>Schnellzugriff auf Ihren Bestand</p>
          </div>
          <Link to="/dashboard/leads" className="broker-text-btn">Alle anzeigen</Link>
        </div>
        {loading ? (
          <div className="broker-empty">
            <strong>Leads werden geladen</strong>
            <p>Einen Moment bitte.</p>
          </div>
        ) : recent.length ? (
          <ul className="broker-home-lead-list">
            {recent.map((lead) => (
              <li key={lead.id}>
                <Link to={`/dashboard/leads/${lead.id}`}>
                  <span>
                    <strong>{lead.name}</strong>
                    <small>{lead.productCode} · {statusLabel(lead.status)}</small>
                  </span>
                  <b className={`broker-status broker-status--${lead.status}`}>{statusLabel(lead.status)}</b>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Leads</strong>
            <p>Zugewiesene Chancen erscheinen hier und unter Meine Leads.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function LeadCard({ lead, onOpen }) {
  const distance = formatDistance(lead.distanceKm);

  return (
    <article
      className="broker-panel broker-lead-card is-clickable"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(lead.id);
        }
      }}
    >
      <div className="broker-lead-top">
        <div>
          <div className="broker-lead-name">{lead.name}</div>
          <div className="broker-lead-address">{lead.address}</div>
        </div>
        <span className={`broker-status broker-status--${lead.status}`}>{statusLabel(lead.status)}</span>
      </div>
      <div className="broker-lead-meta">
        {distance ? <span>{distance} entfernt</span> : null}
        <span>{lead.productCode || leadProductCode(lead)}</span>
        <span>{lead.quality || 'Exklusiv'}</span>
      </div>
      {lead.notes ? <p className="broker-lead-note">{lead.notes}</p> : null}
      <div className="broker-lead-bottom">
        <div className="broker-lead-price">
          {formatEuroExact(lead.priceCents)}
          <span>bezahlt</span>
        </div>
        <span className="broker-muted-action">Details öffnen</span>
      </div>
    </article>
  );
}

function LeadListRow({ lead, onOpen }) {
  return (
    <button type="button" className="broker-list-row" onClick={() => onOpen(lead.id)}>
      <span className="broker-list-name">
        <strong>{lead.name}</strong>
        <small>{lead.address}</small>
      </span>
      <span className="broker-list-meta">{lead.productCode || leadProductCode(lead)}</span>
      <span className="broker-list-meta">{lead.quality}</span>
      <span className={`broker-status broker-status--${lead.status}`}>{statusLabel(lead.status)}</span>
      <span className="broker-list-price">{formatEuroExact(lead.priceCents)}</span>
    </button>
  );
}

export function BeraterLeads() {
  const navigate = useNavigate();
  const { leadStatuses } = useBroker();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [product, setProduct] = useState('all');
  const [view, setView] = useState('kanban');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    let active = true;
    fetchMyLeads()
      .then((payload) => {
        if (!active) return;
        setLeads(payload.leads || []);
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

  const visible = useMemo(() => (
    leads
      .map((lead) => withPipeline(lead, leadStatuses))
      .filter((lead) => product === 'all' || lead.productCode === product)
  ), [leads, leadStatuses, product]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [product, view]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, page, pageSize]);

  const openLead = (id) => navigate(`/dashboard/leads/${id}`);

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Gekaufte Chancen</div>
          <h1>Meine <em>Leads</em></h1>
          <p className="lede">Kanban oder Liste — klicken Sie einen Lead für alle Details.</p>
        </div>
      </div>

      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-filterbar">
        <div className="broker-tabs" role="tablist" aria-label="Ansicht">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={view === mode.id}
              className={view === mode.id ? 'is-active' : undefined}
              onClick={() => setView(mode.id)}
            >
              {mode.id === 'kanban' ? <LayoutGrid size={14} /> : <List size={14} />}
              {mode.label}
            </button>
          ))}
        </div>
        <label htmlFor="productFilter">Produkt</label>
        <select id="productFilter" value={product} onChange={(event) => setProduct(event.target.value)}>
          {PRODUCT_FILTERS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <span className="broker-filter-count">
          {loading ? 'Laden…' : `${visible.length} in Ihrem Bestand`}
        </span>
      </div>

      {loading ? (
        <div className="broker-panel broker-empty">
          <strong>Leads werden geladen</strong>
          <p>Einen Moment bitte.</p>
        </div>
      ) : !visible.length ? (
        <div className="broker-panel broker-empty">
          <strong>Noch keine Leads gekauft</strong>
          <p>Sobald Ihnen Chancen zugestellt werden, erscheinen sie hier in Ihrem Bestand.</p>
        </div>
      ) : view === 'list' ? (
        <>
          <div className="broker-panel broker-list-panel">
            <div className="broker-list-head" aria-hidden="true">
              <span>Kontakt</span>
              <span>Produkt</span>
              <span>Qualität</span>
              <span>Status</span>
              <span>Preis</span>
            </div>
            <div className="broker-list-body">
              {pageItems.map((lead) => (
                <LeadListRow key={lead.id} lead={lead} onOpen={openLead} />
              ))}
            </div>
          </div>
          {visible.length > pageSize ? (
            <div className="broker-pagination">
              <button
                type="button"
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Zurück
              </button>
              <span>
                Seite {page} von {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Weiter
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="broker-kanban">
          {LEAD_STATUSES.map((column) => {
            const items = visible.filter((lead) => lead.status === column.id);
            return (
              <section key={column.id} className="broker-kanban-column">
                <header>
                  <div>
                    <strong>{column.label}</strong>
                    <small>{column.hint}</small>
                  </div>
                  <span className="broker-count">{items.length}</span>
                </header>
                <div className="broker-kanban-stack">
                  {items.length ? items.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onOpen={openLead} />
                  )) : (
                    <div className="broker-kanban-empty">Keine Leads</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BeraterLeadDetail() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { showToast, leadStatuses, setLeadStatus } = useBroker();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const payload = await fetchLead(leadId);
    setLead(payload.lead);
    setNotes(payload.lead?.notes || '');
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [leadId]);

  async function saveNotes() {
    if (!lead || notes === (lead.notes || '')) return;
    setSaving(true);
    setError('');
    try {
      const payload = await updateLead(lead.id, { notes });
      setLead((current) => ({ ...current, ...payload.lead, complaint: current?.complaint }));
      showToast('Notizen gespeichert.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="broker-page">
        <div className="broker-panel broker-empty">
          <strong>Lead wird geladen</strong>
          <p>Einen Moment bitte.</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return <Navigate to="/dashboard/leads" replace />;
  }

  const view = withPipeline(lead, leadStatuses);
  const status = view.status;
  const pkg = packageById(lead.scope === 'regional' ? 'pkv-regional' : 'pkv-deutschlandweit');
  const employment = lead.employmentStatus === 'sonstiges' && lead.employmentOther
    ? lead.employmentOther
    : employmentLabel(lead.employmentStatus);

  return (
    <div className="broker-page">
      <button type="button" className="broker-back" onClick={() => navigate('/dashboard/leads')}>
        <ArrowLeft size={16} />
        Zurück zu Meine Leads
      </button>

      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-heading">
        <div>
          <div className="eyebrow">Lead-Details</div>
          <h1>{view.name}</h1>
          <p className="lede">{view.product} · {view.address}</p>
        </div>
        <span className={`broker-status broker-status--lg broker-status--${status}`}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="broker-detail-grid">
        <section className="broker-panel broker-detail-main">
          <h2>Kontaktdaten</h2>
          <dl className="broker-detail-dl">
            <div>
              <dt>Adresse</dt>
              <dd>{view.address}</dd>
            </div>
            <div>
              <dt>Telefon</dt>
              <dd>
                {lead.phone ? (
                  <a href={`tel:${String(lead.phone).replace(/\s/g, '')}`}>{lead.phone}</a>
                ) : '—'}
              </dd>
            </div>
            <div>
              <dt>E-Mail</dt>
              <dd>
                {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}
              </dd>
            </div>
            <div>
              <dt>Beruf / Situation</dt>
              <dd>{employment}</dd>
            </div>
            <div>
              <dt>Geburtsdatum</dt>
              <dd>{formatLeadDate(lead.dateOfBirth)}</dd>
            </div>
          </dl>

          <h2>Chance</h2>
          <dl className="broker-detail-dl">
            <div>
              <dt>Produkt</dt>
              <dd>{view.product}</dd>
            </div>
            <div>
              <dt>Qualität</dt>
              <dd>{view.quality}</dd>
            </div>
            <div>
              <dt>Paket</dt>
              <dd>{pkg?.label || '—'}</dd>
            </div>
            <div>
              <dt>Preis</dt>
              <dd>{formatEuroExact(view.priceCents)}</dd>
            </div>
            <div>
              <dt>Versicherung</dt>
              <dd>{listLabels(lead.insuranceStatus, 'insurance')}</dd>
            </div>
            <div>
              <dt>Monatlicher Beitrag</dt>
              <dd>{formatPremium(lead.monthlyPremium)}</dd>
            </div>
          </dl>

          <h2>Hinweis</h2>
          <p className="broker-detail-note">{lead.notes || 'Kein Hinweis hinterlegt.'}</p>
        </section>

        <aside className="broker-panel broker-detail-side">
          <h2>Bearbeitungsstatus</h2>
          <p>Verschieben Sie den Lead im Pipeline-Status.</p>
          <div className="broker-status-picker">
            {LEAD_STATUSES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={[
                  status === option.id ? 'is-active' : '',
                  option.id === 'wiedervorlage' && status === option.id ? 'is-wiedervorlage' : '',
                ].filter(Boolean).join(' ') || undefined}
                onClick={() => setLeadStatus(lead.id, option.id)}
              >
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>

          <LeadReportPanel
            lead={lead}
            onReported={() => {
              load().catch((err) => setError(err.message));
              showToast('Reklamation gesendet. Der Admin sieht sie unter Reklamationen.');
            }}
          />

          <h2>Notizen</h2>
          <p className="broker-detail-side-hint">Sichtbar für Sie und den Admin.</p>
          <textarea
            className="broker-detail-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={saveNotes}
            placeholder="z. B. Rückruf vereinbart, offene Fragen…"
            rows={5}
            disabled={saving}
          />

          <Link className="btn btn-outline broker-detail-link" to="/dashboard/zahlung">
            Kontingent prüfen
          </Link>
        </aside>
      </div>
    </div>
  );
}

export function BeraterPayments() {
  const { user } = useAuth();
  const { activePackageId, selectPackage, activePackage } = useBroker();
  const [qtyByPackage, setQtyByPackage] = useState(() => (
    Object.fromEntries(PACKAGES.map((pkg) => [pkg.id, MIN_LEAD_PACK]))
  ));
  const [payments, setPayments] = useState([]);
  const [leadsUsed, setLeadsUsed] = useState(0);
  const [pendingByScope, setPendingByScope] = useState({});
  const [checkout, setCheckout] = useState(null);
  const [card, setCard] = useState({ holder: '', number: '', expiry: '', cvc: '' });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadBilling() {
    const [leadPayload, requestPayload, paymentPayload] = await Promise.all([
      fetchMyLeads(),
      fetchMyRequests(),
      fetchMyPayments().catch(() => ({ payments: [] })),
    ]);
    setLeadsUsed((leadPayload.leads || []).length);
    const pending = {};
    for (const entry of requestPayload.requests || []) {
      if (entry.status === 'pending') pending[entry.scope || DEFAULT_LEAD_SCOPE] = true;
    }
    setPendingByScope(pending);
    setPayments(paymentPayload.payments || []);
  }

  useEffect(() => {
    let active = true;
    loadBilling().catch(() => {
      if (active) setLeadsUsed(0);
    });
    return () => {
      active = false;
    };
  }, []);

  const leadQuota = payments
    .filter((entry) => entry.status === 'paid')
    .reduce((sum, entry) => sum + (entry.leadCount || 0), 0);
  const leadsRemaining = Math.max(0, leadQuota - leadsUsed);
  const quotaLabel = `${leadsUsed}/${leadQuota || 0}`;
  const progressPct = leadQuota ? Math.min(100, Math.round((leadsUsed / leadQuota) * 100)) : 0;
  const company = user?.profile?.company || '—';
  const billingEmail = user?.email || '—';
  const customerNumber = user?.customerNumber || '—';
  const billingName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || user?.fullName
    || '—';
  const checkoutPkg = checkout ? packageById(checkout.packageId) : null;
  const checkoutQty = checkout?.qty || MIN_LEAD_PACK;
  const checkoutNet = checkoutPkg ? packTotalCents(checkoutPkg, checkoutQty) : 0;
  const checkoutTax = Math.round(checkoutNet * 0.19);
  const checkoutGross = checkoutNet + checkoutTax;

  const setQty = (packageId, next) => {
    const value = Math.max(MIN_LEAD_PACK, Math.round(Number(next) / MIN_LEAD_PACK) * MIN_LEAD_PACK);
    setQtyByPackage((prev) => ({ ...prev, [packageId]: value }));
  };

  const fillTestCard = () => {
    setCard({
      holder: TEST_CARD.holder,
      number: formatCardNumberInput(TEST_CARD.number),
      expiry: TEST_CARD.expiry,
      cvc: TEST_CARD.cvc,
    });
  };

  const confirmPay = async () => {
    if (!checkoutPkg || paying) return;
    setPaying(true);
    setError('');
    setNotice('');
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      const [expMonth, expYear] = String(card.expiry || '').split('/');
      await checkoutLeadPackage({
        packageId: checkoutPkg.id,
        requestedCount: checkoutQty,
        card: {
          holder: card.holder,
          number: card.number,
          expMonth,
          expYear,
          cvc: card.cvc,
        },
      });
      selectPackage(checkoutPkg.id);
      setCheckout(null);
      setCard({ holder: '', number: '', expiry: '', cvc: '' });
      await loadBilling();
      setNotice(`${checkoutPkg.label} ist bezahlt. Der Admin sieht die Anforderung und die Zahlungsdaten.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="broker-page">
      <div className="broker-heading broker-billing-heading">
        <div>
          <div className="eyebrow">Abrechnung</div>
          <h1>Zah<em>lung</em></h1>
          <p className="lede">
            Paket wählen, Testzahlung durchführen, Anforderung geht an den Admin.
            Mindestabnahme {MIN_LEAD_PACK} Leads. Keine echte Bankverbindung.
          </p>
        </div>
        <Link className="btn btn-outline" to="/dashboard/unternehmen">
          Rechnungsdaten bearbeiten
        </Link>
      </div>

      <div className="broker-billing-summary">
        <article className="broker-panel broker-billing-card">
          <span className="broker-billing-kicker">Nutzung</span>
          <strong className="broker-billing-metric">{quotaLabel}</strong>
          <p>{leadsUsed} zugewiesen · {leadsRemaining} noch verfügbar</p>
          <div className="broker-quota-bar broker-quota-bar--light" aria-hidden="true">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <small>Kontingent aus bezahlten Paketen</small>
        </article>

        <article className="broker-panel broker-billing-card">
          <span className="broker-billing-kicker">Aktuelles Paket</span>
          <strong className="broker-billing-metric-text">{activePackage?.label || 'Kein Paket'}</strong>
          <p>{activePackage?.title || 'Wählen Sie unten ein Paket.'}</p>
          <small>Mindestabnahme {MIN_LEAD_PACK} Leads</small>
        </article>

        <article className="broker-panel broker-billing-card">
          <span className="broker-billing-kicker">Rechnung an</span>
          <strong className="broker-billing-metric-text">{company}</strong>
          <p>{billingName}</p>
          <small>{billingEmail} · Kd.-Nr. {customerNumber}</small>
        </article>
      </div>

      {notice ? <div className="broker-alert broker-alert--ok">{notice}</div> : null}
      {error ? <div className="broker-alert">{error}</div> : null}

      <section className="broker-billing-section">
        <div className="broker-billing-section-head">
          <div>
            <h2>Pakete</h2>
            <p>Deutschlandweit oder regional wählen, dann mit Testdaten bezahlen. Der Admin nimmt die Anforderung danach manuell an.</p>
          </div>
        </div>

        <div className="broker-packages">
          {PACKAGES.map((pkg) => {
            const active = activePackageId === pkg.id;
            const qty = qtyByPackage[pkg.id] || MIN_LEAD_PACK;
            const net = packTotalCents(pkg, qty);
            const tax = Math.round(net * 0.19);
            const gross = net + tax;
            return (
              <article
                key={pkg.id}
                className={`broker-package-card${pkg.featured ? ' is-featured' : ''}${active ? ' is-active' : ''}`}
              >
                <div className="broker-package-label">{pkg.label}</div>
                <h2>{pkg.title}</h2>
                <p>{pkg.description}</p>
                <div className="broker-package-rows">
                  <div>
                    <span>Preis je Lead</span>
                    <strong>{formatEuroExact(pkg.packCents)}</strong>
                  </div>
                  <div>
                    <span>Mindestmenge</span>
                    <strong>{MIN_LEAD_PACK} <small>Leads</small></strong>
                  </div>
                </div>

                <label className="broker-qty-field">
                  Menge (ab {MIN_LEAD_PACK}, Schritte von 10)
                  <div className="broker-qty-controls">
                    <button
                      type="button"
                      onClick={() => setQty(pkg.id, qty - MIN_LEAD_PACK)}
                      disabled={qty <= MIN_LEAD_PACK}
                      aria-label="Weniger"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={MIN_LEAD_PACK}
                      step={MIN_LEAD_PACK}
                      value={qty}
                      onChange={(event) => setQty(pkg.id, event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setQty(pkg.id, qty + MIN_LEAD_PACK)}
                      aria-label="Mehr"
                    >
                      +
                    </button>
                  </div>
                </label>

                <div className="broker-checkout-summary">
                  <div><span>Netto</span><strong>{formatEuroExact(net)}</strong></div>
                  <div><span>MwSt. 19%</span><strong>{formatEuroExact(tax)}</strong></div>
                  <div className="is-total"><span>Gesamt</span><strong>{formatEuroExact(gross)}</strong></div>
                </div>

                <div className="broker-package-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={paying || pendingByScope[pkg.scope]}
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setCheckout({ packageId: pkg.id, qty });
                    }}
                  >
                    {pendingByScope[pkg.scope]
                      ? 'Anforderung ausstehend'
                      : `Weiter zur Zahlung · ${qty} Leads`}
                  </button>
                  {!active ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => selectPackage(pkg.id)}
                    >
                      Als Paket merken
                    </button>
                  ) : (
                    <span className="broker-package-active">Aktives Paket</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {checkoutPkg ? (
        <div
          className="broker-checkout-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !paying) setCheckout(null);
          }}
        >
          <div className="broker-checkout-panel broker-checkout-panel--pay">
            <div className="broker-checkout-brand">VANTARO · Testbetrieb</div>
            <h2 id="checkout-title">Zahlung</h2>
            <p>
              {checkoutPkg.label} · {checkoutQty} Leads · {formatEuroExact(checkoutGross)} inkl. MwSt.
            </p>
            <dl className="broker-checkout-details">
              <div>
                <dt>Rechnung an</dt>
                <dd>{company}<small>{billingEmail}</small></dd>
              </div>
              <div>
                <dt>Paket</dt>
                <dd>{checkoutPkg.title}</dd>
              </div>
              <div>
                <dt>Netto</dt>
                <dd>{formatEuroExact(checkoutNet)}</dd>
              </div>
              <div>
                <dt>MwSt. 19%</dt>
                <dd>{formatEuroExact(checkoutTax)}</dd>
              </div>
              <div className="is-total">
                <dt>Gesamt</dt>
                <dd>{formatEuroExact(checkoutGross)}</dd>
              </div>
            </dl>

            <form
              className="broker-card-form"
              onSubmit={(event) => {
                event.preventDefault();
                confirmPay();
              }}
            >
              <label>
                Name auf der Karte
                <input
                  value={card.holder}
                  onChange={(event) => setCard((current) => ({ ...current, holder: event.target.value }))}
                  autoComplete="cc-name"
                  disabled={paying}
                  required
                />
              </label>
              <label>
                Kartennummer
                <input
                  value={card.number}
                  onChange={(event) => setCard((current) => ({
                    ...current,
                    number: formatCardNumberInput(event.target.value),
                  }))}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="4242 4242 4242 4242"
                  disabled={paying}
                  required
                />
              </label>
              <div className="broker-card-row">
                <label>
                  Gültig bis
                  <input
                    value={card.expiry}
                    onChange={(event) => setCard((current) => ({
                      ...current,
                      expiry: formatExpiryInput(event.target.value),
                    }))}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    disabled={paying}
                    required
                  />
                </label>
                <label>
                  CVC
                  <input
                    value={card.cvc}
                    onChange={(event) => setCard((current) => ({
                      ...current,
                      cvc: event.target.value.replace(/\D/g, '').slice(0, 4),
                    }))}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    disabled={paying}
                    required
                  />
                </label>
              </div>
              <button type="button" className="broker-text-btn" disabled={paying} onClick={fillTestCard}>
                Testdaten einfügen
              </button>
              <p className="broker-checkout-note">
                Testbetrieb — keine echte Belastung. Karte, Ablaufdatum und CVC sind Testdaten
                (z. B. 4242 4242 4242 4242 · 12/30 · 123).
              </p>
              <div className="broker-checkout-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={paying}
                  onClick={() => setCheckout(null)}
                >
                  Zurück
                </button>
                <button type="submit" className="btn btn-primary" disabled={paying}>
                  {paying ? 'Zahlung wird geprüft⬦' : `Jetzt zahlen · ${formatEuroExact(checkoutGross)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="broker-panel broker-invoice-panel">
        <div className="broker-panel-header">
          <div>
            <h2>Rechnungen</h2>
            <p>Bezahlte Testzahlungen — PDF folgt später</p>
          </div>
        </div>

        {payments.length ? (
          <div className="broker-invoice-table-wrap">
            <table className="broker-invoice-table">
              <thead>
                <tr>
                  <th>Rechnung</th>
                  <th>Datum</th>
                  <th>Beschreibung</th>
                  <th>Zahlung</th>
                  <th>Status</th>
                  <th>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <span className="broker-invoice-id">
                        <FileText size={14} />
                        {invoice.invoiceNumber}
                      </span>
                    </td>
                    <td>{formatDateTime(invoice.paidAt || invoice.createdAt)}</td>
                    <td>
                      <strong>{invoice.packageLabel}</strong>
                      <small>{invoice.leadCount} Leads · {leadScopeLabel(invoice.scope)}</small>
                    </td>
                    <td>
                      <strong>{formatCardMask(invoice)}</strong>
                      <small>{invoice.cardHolder || '—'}</small>
                    </td>
                    <td>
                      <span className="broker-invoice-status is-paid">Bezahlt</span>
                    </td>
                    <td>
                      <strong>{formatEuroExact(invoice.grossCents)}</strong>
                      <small>inkl. MwSt.</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Rechnungen</strong>
            <p>Nach der ersten Testzahlung erscheinen Rechnungen hier.</p>
          </div>
        )}
      </section>

      <p className="broker-muted-note">
        Testbetrieb ohne Bank oder Zahlungsanbieter. Nach der Zahlung erscheint die Anforderung
        beim Admin zur manuellen Annahme.
      </p>
    </div>
  );
}

function ProfileNav({ active }) {
  const links = [
    { id: 'profil', to: '/dashboard/profil', label: 'Profil', icon: User },
    { id: 'unternehmen', to: '/dashboard/unternehmen', label: 'Unternehmen', icon: Building2 },
    { id: 'sicherheit', to: '/dashboard/sicherheit', label: 'Sicherheit', icon: Shield },
  ];

  return (
    <nav className="broker-profile-nav" aria-label="Einstellungen">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.id}
            to={link.to}
            className={active === link.id ? 'is-active' : undefined}
          >
            <Icon size={16} strokeWidth={2} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsShell({ active, eyebrow, title, lede, children }) {
  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </div>
      </div>
      <div className="broker-settings-layout">
        <ProfileNav active={active} />
        <div className="broker-settings-main">{children}</div>
      </div>
    </div>
  );
}

function personalForm(user) {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    avatarUrl: user?.avatarUrl || '',
  };
}

function companyForm(user) {
  const business = user?.profile?.businessAddress || {};
  return {
    company: user?.profile?.company || '',
    legalForm: user?.profile?.legalForm || '',
    businessStreet: business.street || '',
    businessZip: business.zip || '',
    businessCity: business.city || '',
    billingSame: true,
    website: user?.profile?.website || '',
  };
}

const LEGAL_FORM_META = {
  GmbH: 'Gesellschaft mit beschränkter Haftung',
  'UG (haftungsbeschränkt)': 'Unternehmergesellschaft',
  AG: 'Aktiengesellschaft',
  'e.K.': 'Eingetragener Kaufmann / Kauffrau',
  GbR: 'Gesellschaft bürgerlichen Rechts',
  OHG: 'Offene Handelsgesellschaft',
  KG: 'Kommanditgesellschaft',
  PartG: 'Partnerschaftsgesellschaft',
  'Freiberufler / Einzelunternehmen': 'Selbstständig ohne Gesellschaft',
  Sonstige: 'Andere Rechtsform',
};

function FieldLabel({ children, required = false }) {
  return (
    <span className="broker-field-caption">
      {children}
      {required ? <span className="broker-req" aria-hidden="true"> *</span> : null}
    </span>
  );
}

function LegalFormSelect({ value, onChange, disabled, required }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = LEGAL_FORMS.includes(value) ? value : '';

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className={`broker-legal-select${open ? ' is-open' : ''}${selected ? ' has-value' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="broker-legal-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="broker-legal-select__value">
          {selected ? (
            <>
              <strong>{selected}</strong>
              <small>{LEGAL_FORM_META[selected]}</small>
            </>
          ) : (
            <span className="broker-legal-select__placeholder">Bitte wählen</span>
          )}
        </span>
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {open ? (
        <ul className="broker-legal-select__menu" role="listbox" aria-label="Rechtsform">
          {LEGAL_FORMS.map((formName) => {
            const isActive = formName === selected;
            return (
              <li key={formName} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  className={isActive ? 'is-active' : undefined}
                  onClick={() => {
                    onChange(formName);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong>{formName}</strong>
                    <small>{LEGAL_FORM_META[formName]}</small>
                  </span>
                  {isActive ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function PasswordToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      className="password-toggle"
      onClick={onToggle}
      aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
    >
      {show ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
    </button>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const { changePassword } = useAuth();
  const { showToast } = useBroker();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setCurrentPassword('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const fillGenerated = () => {
    const next = generatePassword();
    setPassword(next);
    setConfirmPassword(next);
    setShowNew(true);
    setShowConfirm(true);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!currentPassword) {
      setError('Bitte geben Sie Ihr aktuelles Passwort ein.');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, password });
      showToast('Passwort wurde geändert');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="pw-modal-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={onClose} />
      <form className="broker-modal__panel broker-pw-modal" onSubmit={submit}>
        <div className="broker-pw-modal__head">
          <div>
            <h2 id="pw-modal-title">Passwort ändern</h2>
            <p>Geben Sie Ihr aktuelles Passwort ein und wählen Sie ein neues.</p>
          </div>
          <button type="button" className="broker-pw-modal__close" onClick={onClose} aria-label="Schließen">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="broker-pw-modal__body">
          {error ? <div className="broker-alert">{error}</div> : null}

          <label className="broker-pw-field">
            <span>Aktuelles Passwort</span>
            <div className="password-input-wrapper">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={saving}
                required
              />
              <PasswordToggle show={showCurrent} onToggle={() => setShowCurrent((value) => !value)} />
            </div>
          </label>

          <label className="broker-pw-field">
            <span>Neues Passwort</span>
            <div className="password-input-wrapper has-actions">
              <input
                type={showNew ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                disabled={saving}
                required
              />
              <div className="password-input-actions">
                <button
                  type="button"
                  className="password-action"
                  onClick={fillGenerated}
                  disabled={saving}
                  aria-label="Passwort generieren"
                  title="Passwort generieren"
                >
                  <Wand2 size={18} strokeWidth={2} />
                </button>
                <PasswordToggle show={showNew} onToggle={() => setShowNew((value) => !value)} />
              </div>
            </div>
            <small className="broker-pw-hint">Mindestens 8 Zeichen.</small>
          </label>

          <label className="broker-pw-field">
            <span>Passwort bestätigen</span>
            <div className="password-input-wrapper">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={saving}
                required
              />
              <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm((value) => !value)} />
            </div>
          </label>
        </div>

        <div className="broker-pw-modal__footer">
          <button type="button" className="broker-pw-btn broker-pw-btn--ghost" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" className="broker-pw-btn broker-pw-btn--primary" disabled={saving}>
            {saving ? 'Wird gespeichert⬦' : 'Passwort ändern'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Persönliche Daten: Bild, Name, E-Mail, Telefon */
export function BeraterProfile() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState(() => personalForm(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarName, setAvatarName] = useState('');

  useEffect(() => {
    setForm(personalForm(user));
    setAvatarName('');
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      setForm((prev) => ({ ...prev, avatarUrl }));
      setAvatarName(file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.firstName.trim() || form.firstName.trim().length < 2) {
      setError('Bitte geben Sie Ihren Vornamen an.');
      return;
    }
    if (!form.lastName.trim() || form.lastName.trim().length < 2) {
      setError('Bitte geben Sie Ihren Nachnamen an.');
      return;
    }
    if (!isValidMobile(form.phone)) {
      setError('Bitte geben Sie eine gültige Telefonnummer an.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(form);
      setAvatarName('');
      showToast('Persönliche Daten gespeichert');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      active="profil"
      eyebrow="Einstellungen"
      title={<>Pro<em>fil</em></>}
      lede="Ihre persönlichen Daten: Bild, Name, E-Mail und Telefonnummer."
    >
      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <h2>Persönliche Daten</h2>
        {error && <div className="broker-alert">{error}</div>}

        <div className="broker-avatar-edit">
          <div className="broker-avatar broker-avatar--xl" aria-hidden="true">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" />
            ) : (
              initials({ firstName: form.firstName, lastName: form.lastName, email: user?.email })
            )}
          </div>
          <div>
            <span className="broker-field-label">
              Profilbild
            </span>
            {!form.avatarUrl ? (
              <p className="broker-avatar-soft-hint">Freiwillig — ein Foto macht Ihr Konto persönlicher.</p>
            ) : null}
            <label className="broker-file-btn" htmlFor="profile-avatar">
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatar}
                disabled={saving}
              />
              <span>Bild auswählen</span>
              <small>{avatarName || (form.avatarUrl ? 'Aktuelles Bild behalten' : 'Freiwillig')}</small>
            </label>
            {form.avatarUrl ? (
              <button
                type="button"
                className="broker-text-btn"
                onClick={() => {
                  setForm((prev) => ({ ...prev, avatarUrl: '' }));
                  setAvatarName('');
                }}
                disabled={saving}
              >
                Bild entfernen
              </button>
            ) : null}
          </div>
        </div>

        <div className="broker-form-grid">
          <label>
            <FieldLabel required>Vorname</FieldLabel>
            <input
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              autoComplete="given-name"
              disabled={saving}
              required
            />
          </label>
          <label>
            <FieldLabel required>Nachname</FieldLabel>
            <input
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              disabled={saving}
              required
            />
          </label>
          <label className="is-full">
            <FieldLabel>E-Mail-Adresse</FieldLabel>
            <input type="email" value={user?.email || ''} autoComplete="email" disabled />
          </label>
          <label className="is-full">
            <FieldLabel required>Telefonnummer</FieldLabel>
            <PhoneField
              id="profile-phone"
              value={form.phone}
              onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
              disabled={saving}
              required
              className="vantaro-phone-input--light"
            />
          </label>
        </div>

        <button type="submit" className="btn btn-primary broker-save" disabled={saving}>
          {saving ? 'Wird gespeichert⬦' : 'Profil speichern'}
        </button>
      </form>
    </SettingsShell>
  );
}

export function BeraterCompany() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState(() => companyForm(user));
  const [mapPin, setMapPin] = useState({ lat: null, lng: null });
  const [mapNotice, setMapNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const needsPhone = !String(user?.phone || '').trim();
  const skipGeocodeRef = useRef(false);

  const missingLive = useMemo(() => {
    const missing = [];
    if (!form.company.trim()) missing.push('company');
    if (!form.legalForm) missing.push('legalForm');
    if (!form.businessStreet.trim()) missing.push('address');
    if (!form.businessZip.trim()) missing.push('zip');
    if (!form.businessCity.trim()) missing.push('city');
    return missing;
  }, [form]);
  const setupIncomplete = missingLive.length > 0;
  const firmDone = !missingLive.includes('company') && !missingLive.includes('legalForm');
  const addressDone = !missingLive.includes('address')
    && !missingLive.includes('zip')
    && !missingLive.includes('city');
  const highlightMissing = setupIncomplete && !needsPhone;

  useEffect(() => {
    setForm(companyForm(user));
  }, [user]);

  useEffect(() => {
    if (!hasGoogleMapsKey()) return undefined;
    if (skipGeocodeRef.current) {
      skipGeocodeRef.current = false;
      return undefined;
    }

    const street = form.businessStreet.trim();
    const zip = form.businessZip.trim();
    const city = form.businessCity.trim();
    // City alone is enough to show a pin (e.g. Augsburg); street+zip refine it
    if (!city && !(street && zip)) {
      setMapPin({ lat: null, lng: null });
      return undefined;
    }

    const query = [street, zip, city, 'Deutschland'].filter(Boolean).join(', ');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      geocodeAddress(query)
        .then((coords) => {
          if (!cancelled && coords) {
            setMapPin(coords);
            setMapNotice('');
          }
        })
        .catch((err) => {
          if (cancelled) return;
          if (didGoogleMapsAuthFail()) {
            setMapNotice('Kartensuche vorübergehend nicht verfügbar — Adresse bitte manuell eintragen.');
            return;
          }
          setMapNotice(err?.message || 'Adresssuche fehlgeschlagen.');
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.businessStreet, form.businessZip, form.businessCity]);

  const applyPlaceToForm = ({ street, zip, city, lat, lng }) => {
    skipGeocodeRef.current = Number.isFinite(lat) && Number.isFinite(lng);
    setForm((prev) => ({
      ...prev,
      businessStreet: street ?? prev.businessStreet,
      businessZip: zip || prev.businessZip,
      businessCity: city || prev.businessCity,
    }));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMapPin({ lat, lng });
    }
  };

  const handleMapPick = async ({ lat, lng }) => {
    if (!isInGermany(lat, lng)) {
      setMapNotice('Nur Standorte in Deutschland — Österreich ist nicht erlaubt.');
      return;
    }

    const previousPin = mapPin;
    setMapNotice('Adresse wird ermittelt⬦');

    try {
      const place = await reverseGeocode(lat, lng);
      if (!place) {
        setMapNotice('Keine Adresse an diesem Punkt gefunden.');
        return;
      }
      if (!place.inGermany) {
        setMapPin(previousPin);
        setMapNotice('Nur Standorte in Deutschland — Österreich und andere Länder sind nicht erlaubt.');
        return;
      }
      applyPlaceToForm(place);
      setMapNotice('');
    } catch (err) {
      setMapPin(previousPin);
      if (didGoogleMapsAuthFail()) {
        setMapNotice('Kartensuche vorübergehend nicht verfügbar — Adresse bitte manuell eintragen.');
        return;
      }
      setMapNotice(err?.message || 'Adresssuche fehlgeschlagen.');
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');

    if (needsPhone) {
      setError('Bitte hinterlegen Sie zuerst Ihre Telefonnummer unter Profil.');
      return;
    }
    if (!form.company.trim() || !form.legalForm) {
      setError('Firmenname und Rechtsform sind erforderlich.');
      return;
    }
    if (!form.businessStreet.trim() || !form.businessZip.trim() || !form.businessCity.trim()) {
      setError('Bitte geben Sie die vollständige Geschäftsadresse an.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ ...form, billingSame: true });
      showToast('Unternehmensdaten gespeichert');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      active="unternehmen"
      eyebrow="Einstellungen"
      title={<>Unterneh<em>men</em></>}
      lede={
        user?.onboardingComplete
          ? 'Firma, Rechtsform und Adressen für Ihr Maklerkonto.'
          : 'Ergänzen Sie Firma und Adresse — danach ist Ihr Konto vollständig.'
      }
    >
      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <div className="broker-settings-head">
          <div>
            <h2>Unternehmensdaten</h2>
            <p className="broker-muted-note">
              Angaben für Vertrag, Rechnungen und Verifizierung im Portal.
            </p>
          </div>
          {user?.customerNumber ? (
            <p className="broker-customer-chip">
              <span>Kundennummer</span>
              <strong>{user.customerNumber}</strong>
            </p>
          ) : null}
        </div>

        {error && <div className="broker-alert">{error}</div>}

        {needsPhone ? (
          <div className="broker-inline-hint">
            <p>Telefonnummer fehlt noch im Profil — bitte zuerst ergänzen.</p>
            <Link to="/dashboard/profil" className="broker-text-btn">
              Zum Profil
            </Link>
          </div>
        ) : null}

        {setupIncomplete && !needsPhone ? (
          <div className="broker-inline-hint broker-setup-hint">
            <p>Noch unvollständig — Firma, Rechtsform und Adresse speichern, dann ist Ihr Konto eingerichtet.</p>
            <div className="broker-setup-progress" aria-label="Einrichtungsschritte">
              <span className={firmDone ? 'is-done' : 'is-current'}>
                <span>1</span>
                Firma
              </span>
              <span aria-hidden="true" className={`broker-setup-progress__rail${firmDone ? ' is-done' : ''}`} />
              <span className={addressDone ? 'is-done' : firmDone ? 'is-current' : ''}>
                <span>2</span>
                Adresse
              </span>
            </div>
          </div>
        ) : null}

        <section className="broker-settings-section">
          <header>
            <h3>
              {highlightMissing ? <span className="broker-step-num">1</span> : null}
              Firma
            </h3>
            <p>Name und Rechtsform für Dokumente und Anzeige.</p>
          </header>
          <div className="broker-form-grid">
            <label className={`is-full${highlightMissing && missingLive.includes('company') ? ' is-missing' : ''}`}>
              <FieldLabel required>Firmenname</FieldLabel>
              <input
                name="company"
                value={form.company}
                onChange={handleChange}
                autoComplete="organization"
                placeholder="z. B. Muster Finanzberatung"
                disabled={saving}
                required
              />
            </label>
            <div className={`is-full broker-field${highlightMissing && missingLive.includes('legalForm') ? ' is-missing' : ''}`}>
              <FieldLabel required>Rechtsform</FieldLabel>
              <LegalFormSelect
                value={form.legalForm}
                onChange={(legalForm) => setForm((prev) => ({ ...prev, legalForm }))}
                disabled={saving}
                required
              />
            </div>
          </div>
        </section>

        <section className="broker-settings-section">
          <header>
            <h3>
              {highlightMissing ? <span className="broker-step-num">2</span> : null}
              Geschäftsadresse
            </h3>
            <p>Sitz Ihres Unternehmens — Suche nutzen oder Pin auf der Karte setzen.</p>
          </header>
          <div className="broker-form-grid">
            <label className={`is-full${highlightMissing && missingLive.includes('address') ? ' is-missing' : ''}`}>
              <FieldLabel required>Straße und Hausnummer</FieldLabel>
              <AddressAutocomplete
                name="businessStreet"
                value={form.businessStreet}
                onChange={(businessStreet) => setForm((prev) => ({ ...prev, businessStreet }))}
                onPlaceSelect={(place) => {
                  applyPlaceToForm(place);
                  setMapNotice('');
                }}
                autoComplete="street-address"
                placeholder="z. B. Augsburg oder Straße, Hausnummer"
                disabled={saving}
                required
              />
            </label>
            <label className={highlightMissing && missingLive.includes('zip') ? 'is-missing' : undefined}>
              <FieldLabel required>PLZ</FieldLabel>
              <input
                name="businessZip"
                value={form.businessZip}
                onChange={handleChange}
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="12345"
                disabled={saving}
                required
              />
            </label>
            <label className={highlightMissing && missingLive.includes('city') ? 'is-missing' : undefined}>
              <FieldLabel required>Ort</FieldLabel>
              <input
                name="businessCity"
                value={form.businessCity}
                onChange={handleChange}
                autoComplete="address-level2"
                placeholder="Berlin"
                disabled={saving}
                required
              />
            </label>
            {hasGoogleMapsKey() ? (
              <div className="is-full">
                <AddressMap
                  lat={mapPin.lat}
                  lng={mapPin.lng}
                  onMapClick={handleMapPick}
                />
                {mapNotice ? (
                  <p className="broker-address-map-note">{mapNotice}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="broker-settings-section">
          <header>
            <h3>Webseite <span className="broker-optional">(freiwillig)</span></h3>
            <p>Webseite Ihres Unternehmens — ohne https:// möglich.</p>
          </header>
          <div className="broker-form-grid">
            <label className="is-full">
              <FieldLabel>Webseite</FieldLabel>
              <input
                name="website"
                type="text"
                inputMode="url"
                value={form.website}
                onChange={handleChange}
                autoComplete="url"
                placeholder="www.beispiel.de"
                disabled={saving}
              />
            </label>
          </div>
        </section>

        <button type="submit" className="btn btn-primary broker-save" disabled={saving}>
          {saving ? 'Wird gespeichert⬦' : 'Unternehmen speichern'}
        </button>
      </form>
    </SettingsShell>
  );
}

export function BeraterSecurity() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <SettingsShell
      active="sicherheit"
      eyebrow="Einstellungen"
      title={<>Sicher<em>heit</em></>}
      lede="Passwort ändern — mit aktuellem Passwort und starken Regeln."
    >
      <section className="broker-panel broker-settings broker-settings--wide">
        <h2>Passwort</h2>
        <p className="broker-muted-note" style={{ marginTop: 8 }}>
          Mindestens 8 Zeichen, Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.
        </p>
        <button type="button" className="btn btn-primary broker-save" onClick={() => setModalOpen(true)}>
          Passwort ändern
        </button>
      </section>

      <ChangePasswordModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </SettingsShell>
  );
}
