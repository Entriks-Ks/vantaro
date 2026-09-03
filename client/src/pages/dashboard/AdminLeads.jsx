import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, Mail, MoreHorizontal, Phone, Pencil, Trash2, UserRound } from 'lucide-react';
import PhoneField from '../../components/PhoneField';
import { useDashboard } from '../../hooks/useDashboard';
import {
  CONCERN_OPTIONS,
  COVERAGE_OPTIONS,
  EMPLOYMENT_OPTIONS,
  INSURANCE_OPTIONS,
  STATUS_OPTIONS,
  assignLead,
  createLead,
  deleteLead,
  downloadLeadCsvTemplate,
  emptyLeadForm,
  employmentLabel,
  fetchLead,
  fetchLeads,
  formToPayload,
  formatLeadDate,
  formatPremium,
  importLeads,
  leadToForm,
  listLabels,
  parseLeadCsv,
  statusLabel,
  toggleListValue,
  updateLead,
} from '../../lib/leads';
import { fetchBeraterPipelines } from '../../lib/berater';
import { complaintReasonLabel, fetchComplaints, sendComplaintReplacement } from '../../lib/complaints';
import { DashSeg } from './DashboardLayout';
import { formatDate } from './helpers';
import { DEFAULT_LEAD_SCOPE, LEAD_SCOPE_OPTIONS, leadScopeLabel } from '../../lib/scopes';
import { isReplacementPending } from './ComplaintReplacementStatus';

function statusTone(status) {
  if (status === 'zugewiesen') return 'ok';
  if (status === 'erledigt') return 'muted';
  if (status === 'in_bearbeitung') return 'warn';
  return 'new';
}

const SOURCE_LABELS = {
  csv: 'CSV',
  manual: 'Manuell',
  api: 'API',
};

function leadPlace(lead) {
  return [lead?.zip, lead?.city].filter(Boolean).join(' ') || '';
}

function leadInitials(lead) {
  const first = String(lead?.firstName || '').trim();
  const last = String(lead?.lastName || '').trim();
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'L';
}

function returnTo(location, fallback = '/dashboard/leads') {
  const from = location?.state?.from;
  if (typeof from !== 'string' || !from.startsWith('/dashboard')) return fallback;
  const path = from.split('?')[0];
  if (/^\/dashboard\/leads\/[0-9a-f-]{36}$/i.test(path)) return fallback;
  return from;
}

function returnLabel(path) {
  if (path.startsWith('/dashboard/berater')) return 'Zurück zu Berater';
  if (path.startsWith('/dashboard/reklamationen')) return 'Zurück zu Reklamationen';
  if (path.startsWith('/dashboard/leads/ungueltig') || path.startsWith('/dashboard/leads/abgelehnt')) {
    return 'Zurück zu Ungültige Leads';
  }
  if (path.startsWith('/dashboard/anfordern') || path.startsWith('/dashboard/anfragen')) return 'Zurück zu Anforderungen';
  if (path === '/dashboard' || path.startsWith('/dashboard?')) return 'Zurück zur Übersicht';
  return 'Zurück zur Liste';
}

export function LeadListItem({ lead }) {
  const location = useLocation();
  const place = leadPlace(lead);
  const assigned = lead.assignedToName || lead.assignedToEmail || 'Nicht zugewiesen';
  const insurance = listLabels(lead.insuranceStatus, 'insurance');
  const concerns = listLabels(lead.mainConcerns, 'concern');
  const tags = [insurance !== '—' ? insurance : null, concerns !== '—' ? concerns : null].filter(Boolean);
  const from = `${location.pathname}${location.search}`;

  return (
    <Link className="dash-lead-row" to={`/dashboard/leads/${lead.id}`} state={{ from }}>
      <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
        {leadInitials(lead)}
      </span>
      <div className="dash-lead-row-main">
        <strong>{lead.fullName || '—'}</strong>
        <span className="dash-lead-row-sub">
          {[lead.email, place].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
        </span>
        {tags.length ? <span className="dash-lead-row-tags">{tags.join(' · ')}</span> : null}
      </div>
      <div className="dash-lead-row-side">
        <span className="dash-badge dash-badge--muted">{leadScopeLabel(lead.scope)}</span>
        <span className={`dash-badge dash-badge--${statusTone(lead.status)}`}>
          {statusLabel(lead.status)}
        </span>
        <small>{assigned}</small>
        <small>{formatDate(lead.createdAt)}</small>
      </div>
    </Link>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function LeadListPagination({ page, totalPages, pageSize, total, onPageChange, onPageSizeChange }) {
  if (!total) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const showNav = totalPages > 1;

  return (
    <div className="dash-pagination">
      <label className="dash-pagination__size">
        Anzeigen
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          aria-label="Anzahl Leads pro Seite"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
      <span className="dash-pagination__range">
        {from}–{to} von {total}
      </span>
      {showNav ? (
        <div className="dash-pagination__nav">
          <button
            type="button"
            className="dash-btn dash-btn--ghost"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Zurück
          </button>
          <span className="dash-pagination__page">
            Seite {page} von {totalPages}
          </span>
          <button
            type="button"
            className="dash-btn dash-btn--ghost"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Weiter
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReplacementLeadListItem({ lead, checked, onSelect, disabled }) {
  const place = leadPlace(lead);
  const insurance = listLabels(lead.insuranceStatus, 'insurance');
  const concerns = listLabels(lead.mainConcerns, 'concern');
  const tags = [insurance !== '—' ? insurance : null, concerns !== '—' ? concerns : null].filter(Boolean);

  return (
    <button
      type="button"
      className={`dash-lead-row dash-replacement-row${checked ? ' is-selected' : ''}`}
      onClick={() => onSelect(lead.id)}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
        {leadInitials(lead)}
      </span>
      <div className="dash-lead-row-main">
        <strong>{lead.fullName || '—'}</strong>
        <span className="dash-lead-row-sub">
          {[lead.email, place].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
        </span>
        {tags.length ? <span className="dash-lead-row-tags">{tags.join(' · ')}</span> : null}
      </div>
      <div className="dash-lead-row-side">
        <span className="dash-badge dash-badge--muted">{leadScopeLabel(lead.scope)}</span>
        <span className={`dash-badge dash-badge--${statusTone(lead.status)}`}>
          {statusLabel(lead.status)}
        </span>
        <small>{formatDate(lead.createdAt)}</small>
      </div>
    </button>
  );
}

function complaintBeraterName(complaint) {
  return complaint?.berater?.fullName || complaint?.berater?.email || 'Berater';
}

function complaintReplacementScope(complaint) {
  return complaint?.request?.scope || complaint?.lead?.scope || '';
}

function ReplacementFlowBanner({ complaint, loading, blocked, backTo }) {
  if (loading) {
    return (
      <div className="dash-replacement-flow">
        <Link className="dash-back" to={backTo}>
          <ArrowLeft size={16} aria-hidden="true" />
          {returnLabel(backTo)}
        </Link>
        <p className="dash-panel-note">Reklamation wird geladen…</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="dash-replacement-flow">
        <Link className="dash-back" to={backTo}>
          <ArrowLeft size={16} aria-hidden="true" />
          {returnLabel(backTo)}
        </Link>
        <p className="dash-panel-note">Reklamation nicht gefunden oder nicht mehr gültig.</p>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="dash-replacement-flow">
        <Link className="dash-back" to={backTo}>
          <ArrowLeft size={16} aria-hidden="true" />
          {returnLabel(backTo)}
        </Link>
        <p className="dash-panel-note">
          Für diese Reklamation wurde bereits ein Ersatz gesendet oder sie ist nicht erstattet.
        </p>
      </div>
    );
  }

  const rejectedLead = complaint.lead;
  const rejectedPlace = rejectedLead ? leadPlace(rejectedLead) : '';

  return (
    <div className="dash-replacement-flow">
      <div className="dash-replacement-flow__head">
        <Link className="dash-back" to={backTo}>
          <ArrowLeft size={16} aria-hidden="true" />
          {returnLabel(backTo)}
        </Link>
        <h2>Ersatzlead wählen</h2>
        <p className="dash-panel-note">
          Wählen Sie einen freien Lead aus dem Pool — er wird dem Berater als Ersatz zugestellt.
          {complaintReplacementScope(complaint) ? (
            <> Nur Leads aus Paket <strong>{leadScopeLabel(complaintReplacementScope(complaint))}</strong>.</>
          ) : null}
        </p>
      </div>
      <div className="dash-replacement-flow__grid">
        <article className="dash-replacement-flow__box dash-replacement-flow__box--from">
          <span className="dash-lead-kicker">Reklamiert</span>
          <strong>{rejectedLead?.fullName || 'Lead'}</strong>
          <small>{complaintReasonLabel(complaint.reason)}</small>
          {complaintReplacementScope(complaint) ? (
            <small>{leadScopeLabel(complaintReplacementScope(complaint))}</small>
          ) : null}
          {rejectedPlace ? <small>{rejectedPlace}</small> : null}
        </article>
        <div className="dash-replacement-flow__arrow" aria-hidden="true">
          <ArrowRight size={18} />
        </div>
        <article className="dash-replacement-flow__box dash-replacement-flow__box--to">
          <span className="dash-lead-kicker">Ersatz für</span>
          <strong>{complaintBeraterName(complaint)}</strong>
          {complaintReplacementScope(complaint) ? (
            <small>{leadScopeLabel(complaintReplacementScope(complaint))}</small>
          ) : (
            <small>Berater-Auftrag</small>
          )}
        </article>
      </div>
    </div>
  );
}

function Fact({ label, children }) {
  return (
    <div className="dash-fact">
      <span>{label}</span>
      <div>{children || '—'}</div>
    </div>
  );
}

function ChipList({ ids, type }) {
  const text = listLabels(ids, type);
  if (!ids?.length || text === '—') {
    return <span className="dash-muted">—</span>;
  }
  return (
    <div className="dash-chips">
      {text.split(', ').map((label) => (
        <span key={label} className="is-active">{label}</span>
      ))}
    </div>
  );
}

function leadAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const iso = String(dateOfBirth).slice(0, 10);
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month
    || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function CopyableValue({ value, label }) {
  const [copied, setCopied] = useState(false);
  if (!value) return '—';

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className={`dash-copyable${copied ? ' is-copied' : ''}`}>
      <button
        type="button"
        className="dash-copyable__value"
        onClick={onCopy}
        title={copied ? 'Kopiert' : `${label} kopieren`}
      >
        {value}
      </button>
      <Copy size={13} className="dash-copyable__icon" aria-hidden="true" />
      {copied ? <span className="dash-copyable__hint">Kopiert</span> : null}
    </span>
  );
}

function LeadActionsMenu({ onEdit, onDelete, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={`dash-lead-menu${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="dash-lead-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Aktionen"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="dash-lead-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="dash-lead-menu__item"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil size={15} aria-hidden="true" />
            Bearbeiten
          </button>
          <button
            type="button"
            role="menuitem"
            className="dash-lead-menu__item dash-lead-menu__item--danger"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
            Löschen
          </button>
        </div>
      ) : null}
    </div>
  );
}

function shortBeraterName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Berater';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function shortRequestCode(code) {
  const value = String(code || '').trim();
  if (!value) return 'ANF';
  const parts = value.split('-');
  if (parts.length >= 3 && parts[0] === 'ANF') {
    return `ANF-${parts[parts.length - 1]}`;
  }
  return value;
}

function assignOptionLabel(entry) {
  return `${shortRequestCode(entry.code)} · ${shortBeraterName(entry.beraterName)}`;
}

function LeadView({
  lead,
  assignTargets,
  selectedRequestId,
  setSelectedRequestId,
  onAssign,
  onEdit,
  onDelete,
  saving,
}) {
  const age = leadAge(lead.dateOfBirth);
  const employment = lead.employmentStatus === 'sonstiges' && lead.employmentOther
    ? lead.employmentOther
    : employmentLabel(lead.employmentStatus);
  const assigneeName = lead.assignedToName || lead.assignedToEmail || '';
  const currentRequestId = lead.requestId || '';
  const assignDirty = selectedRequestId !== currentRequestId;
  const selectedTarget = assignTargets.find((entry) => entry.requestId === selectedRequestId) || null;
  const currentTarget = assignTargets.find((entry) => entry.requestId === currentRequestId) || null;
  const assignLabel = !assignDirty
    ? 'Zuweisen'
    : selectedRequestId
      ? 'Zuweisen'
      : 'Zuweisung entfernen';
  const currentLabel = currentTarget
    ? assignOptionLabel(currentTarget)
    : (assigneeName ? shortBeraterName(assigneeName) : 'Nicht zugewiesen');
  const hasContactActions = Boolean(lead.phone || lead.email);

  return (
    <div className="dash-lead-view">
      <section className="dash-panel dash-lead-hero">
        <div className="dash-lead-identity">
          <span className="dash-lead-avatar" aria-hidden="true">{leadInitials(lead)}</span>
          <div className="dash-lead-identity__body">
            <div className="dash-lead-kicker">Lead-Akte</div>
            <h3>{lead.fullName || '—'}</h3>
            <div className="dash-lead-hero-meta">
              <span className={`dash-badge dash-badge--${statusTone(lead.status)}`}>
                {statusLabel(lead.status)}
              </span>
              <span className="dash-badge dash-badge--muted">{leadScopeLabel(lead.scope)}</span>
              <span className={`dash-lead-assign-pill${assigneeName ? ' is-assigned' : ''}`}>
                <UserRound size={13} aria-hidden="true" />
                {assigneeName || 'Nicht zugewiesen'}
              </span>
            </div>
          </div>
        </div>

        <LeadActionsMenu onEdit={onEdit} onDelete={onDelete} disabled={saving} />
      </section>

      <div className="dash-lead-layout">
        <div className="dash-lead-main">
          <section className="dash-panel">
            <div className="dash-panel-head">
              <strong>Kontakt</strong>
            </div>
            <div className="dash-facts dash-facts--grid">
              <Fact label="E-Mail">
                <CopyableValue value={lead.email} label="E-Mail" />
              </Fact>
              <Fact label="Telefon">
                <CopyableValue value={lead.phone} label="Telefonnummer" />
              </Fact>
              <Fact label="Berufliche Situation">{employment}</Fact>
              <Fact label="Geburtsdatum">
                {formatLeadDate(lead.dateOfBirth)}
                {age != null ? <span className="dash-fact-hint">{age} Jahre</span> : null}
              </Fact>
            </div>
            <div className="dash-facts dash-facts--address">
              <Fact label="PLZ">{lead.zip || '—'}</Fact>
              <Fact label="Ort">{lead.city || '—'}</Fact>
              <Fact label="Straße">{lead.street || '—'}</Fact>
            </div>
          </section>

          <section className="dash-panel">
            <div className="dash-panel-head"><strong>Versicherung</strong></div>
            <div className="dash-facts dash-facts--grid">
              <Fact label="Status"><ChipList ids={lead.insuranceStatus} type="insurance" /></Fact>
              <Fact label="Gesellschaft">{lead.currentInsurer || '—'}</Fact>
              <Fact label="Beitrag / Monat">{formatPremium(lead.monthlyPremium)}</Fact>
              <Fact label="Personenkreis"><ChipList ids={lead.coverageCircle} type="coverage" /></Fact>
            </div>
          </section>

          <section className="dash-panel">
            <div className="dash-panel-head"><strong>Hauptanliegen</strong></div>
            <ChipList ids={lead.mainConcerns} type="concern" />
          </section>

          <section className="dash-panel">
            <div className="dash-panel-head"><strong>Gesprächsnotizen</strong></div>
            {lead.notes ? (
              <p className="dash-lead-notes">{lead.notes}</p>
            ) : (
              <p className="dash-muted">Keine Notizen hinterlegt.</p>
            )}
          </section>
        </div>

        <aside className="dash-lead-aside">
          {hasContactActions ? (
            <div className="dash-lead-reach">
              {lead.phone ? (
                <a className="dash-btn dash-lead-reach__btn dash-lead-reach__btn--call" href={`tel:${lead.phone}`}>
                  <Phone size={15} aria-hidden="true" />
                  Anrufen
                </a>
              ) : null}
              {lead.email ? (
                <a className="dash-btn dash-lead-reach__btn dash-lead-reach__btn--mail" href={`mailto:${lead.email}`}>
                  <Mail size={15} aria-hidden="true" />
                  E-Mail
                </a>
              ) : null}
            </div>
          ) : null}

          <section className="dash-panel dash-lead-assign">
            <div className="dash-panel-head">
              <strong>Zuweisung</strong>
            </div>
            <div className="dash-lead-assign-body">
              <div className="dash-lead-assign-current">
                <span>Aktuell</span>
                <strong>{currentLabel}</strong>
              </div>
              <label className="dash-lead-assign-field">
                Anforderung wählen
                <select
                  value={selectedRequestId}
                  onChange={(event) => setSelectedRequestId(event.target.value)}
                >
                  <option value="">Nicht zugewiesen</option>
                  {assignTargets.length ? (
                    assignTargets.map((entry) => (
                      <option key={entry.requestId} value={entry.requestId}>
                        {assignOptionLabel(entry)}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>Keine aktiven Anforderungen</option>
                  )}
                </select>
              </label>
              {selectedTarget ? (
                <p className="dash-panel-note">
                  {selectedTarget.remaining != null ? `${selectedTarget.remaining} offen · ` : ''}
                  {selectedTarget.scopeLabel || 'Paket'}
                </p>
              ) : !assignTargets.length ? (
                <p className="dash-panel-note">
                  Nur aktive Anforderungen können Leads erhalten.
                </p>
              ) : null}
              <button
                type="button"
                className="dash-btn dash-lead-assign-submit"
                onClick={onAssign}
                disabled={saving || !assignDirty}
              >
                {saving ? 'Speichern…' : assignLabel}
              </button>
            </div>
          </section>

          <section className="dash-panel dash-lead-meta">
            <div className="dash-panel-head"><strong>Übersicht</strong></div>
            <dl className="dash-lead-meta-list">
              <div>
                <dt>Paket</dt>
                <dd>{leadScopeLabel(lead.scope)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel(lead.status)}</dd>
              </div>
              <div>
                <dt>Quelle</dt>
                <dd>{SOURCE_LABELS[lead.source] || lead.source || '—'}</dd>
              </div>
              <div>
                <dt>Angelegt</dt>
                <dd>{formatDate(lead.createdAt)}</dd>
              </div>
              {lead.updatedAt ? (
                <div>
                  <dt>Aktualisiert</dt>
                  <dd>{formatDate(lead.updatedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function CheckGroup({ legend, options, values, onToggle }) {
  return (
    <fieldset className="dash-checks is-full">
      <legend>{legend}</legend>
      <div>
        {options.map((option) => (
          <label key={option.id}>
            <input
              type="checkbox"
              checked={values.includes(option.id)}
              onChange={() => onToggle(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function LeadFormFields({ form, setForm }) {
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="dash-form">
      <label className="is-full">
        Paket
        <select
          value={form.scope || DEFAULT_LEAD_SCOPE}
          onChange={(event) => setField('scope', event.target.value)}
          required
        >
          {LEAD_SCOPE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        Vorname
        <input value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} required />
      </label>
      <label>
        Nachname
        <input value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} required />
      </label>
      <label>
        Geburtsdatum
        <input type="date" value={form.dateOfBirth} onChange={(event) => setField('dateOfBirth', event.target.value)} />
      </label>
      <label>
        Berufliche Situation
        <select
          value={form.employmentStatus}
          onChange={(event) => setField('employmentStatus', event.target.value)}
        >
          <option value="">Bitte wählen</option>
          {EMPLOYMENT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      {form.employmentStatus === 'sonstiges' ? (
        <label className="is-full">
          Berufliche Situation, sonstiges
          <input
            value={form.employmentOther}
            onChange={(event) => setField('employmentOther', event.target.value)}
          />
        </label>
      ) : null}
      <label>
        E-Mail-Adresse
        <input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} />
      </label>
      <label>
        Mobilnummer / Telefon
        <PhoneField value={form.phone} onChange={(value) => setField('phone', value)} />
      </label>
      <CheckGroup
        legend="Versicherungsstatus"
        options={INSURANCE_OPTIONS}
        values={form.insuranceStatus}
        onToggle={(id) => setField('insuranceStatus', toggleListValue(form.insuranceStatus, id))}
      />
      <label>
        Aktuelle Gesellschaft / Krankenkasse
        <input value={form.currentInsurer} onChange={(event) => setField('currentInsurer', event.target.value)} />
      </label>
      <label>
        Monatlicher Beitrag (€)
        <input
          inputMode="decimal"
          value={form.monthlyPremium}
          onChange={(event) => setField('monthlyPremium', event.target.value)}
          placeholder="z. B. 420"
        />
      </label>
      <CheckGroup
        legend="Personenkreis"
        options={COVERAGE_OPTIONS}
        values={form.coverageCircle}
        onToggle={(id) => setField('coverageCircle', toggleListValue(form.coverageCircle, id))}
      />
      <CheckGroup
        legend="Hauptanliegen"
        options={CONCERN_OPTIONS}
        values={form.mainConcerns}
        onToggle={(id) => setField('mainConcerns', toggleListValue(form.mainConcerns, id))}
      />
      <label>
        PLZ
        <input value={form.zip} onChange={(event) => setField('zip', event.target.value)} maxLength={5} />
      </label>
      <label>
        Ort
        <input value={form.city} onChange={(event) => setField('city', event.target.value)} />
      </label>
      <label className="is-full">
        Straße (freiwillig)
        <input value={form.street} onChange={(event) => setField('street', event.target.value)} />
      </label>
      <label className="is-full">
        Gesprächsnotizen
        <textarea
          rows={4}
          value={form.notes}
          onChange={(event) => setField('notes', event.target.value)}
        />
      </label>
    </div>
  );
}

export function AdminLeads() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const replacementFor = searchParams.get('replacementFor') || '';
  const replacementMode = Boolean(replacementFor);
  const backTo = returnTo(location, '/dashboard/reklamationen');
  const { admin } = useDashboard();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('neu');
  const [assignedTo, setAssignedTo] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('');
  const [importing, setImporting] = useState(false);
  const [replacementComplaint, setReplacementComplaint] = useState(null);
  const [replacementLoading, setReplacementLoading] = useState(replacementMode);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [sendingReplacement, setSendingReplacement] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const beraters = useMemo(
    () => (admin?.directory || []).filter((user) => user.role === 'berater'),
    [admin?.directory],
  );

  const pickableLeads = useMemo(
    () => leads.filter((lead) => !lead.assignedTo && lead.status !== 'erledigt' && !lead.refundedAt),
    [leads],
  );

  const listSource = replacementMode ? pickableLeads : leads;
  const totalPages = Math.max(1, Math.ceil(listSource.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return listSource.slice(start, start + pageSize);
  }, [listSource, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [status, assignedTo, search, scope, pageSize, replacementMode, leads.length]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const selectedLead = useMemo(
    () => pickableLeads.find((lead) => lead.id === selectedLeadId) || null,
    [pickableLeads, selectedLeadId],
  );

  const requiredScope = useMemo(
    () => complaintReplacementScope(replacementComplaint),
    [replacementComplaint],
  );

  const replacementReady = replacementComplaint && isReplacementPending(replacementComplaint);
  const replacementBlocked = replacementComplaint && !isReplacementPending(replacementComplaint);

  async function load(next = {}) {
    const nextStatus = replacementMode ? '' : (next.status ?? status);
    const nextAssigned = replacementMode ? 'unassigned' : (next.assignedTo ?? assignedTo);
    const nextSearch = next.search ?? search;
    const nextScope = replacementMode && requiredScope
      ? requiredScope
      : (next.scope ?? scope);
    setLoading(true);
    setError('');
    try {
      const payload = await fetchLeads({
        status: nextStatus,
        assignedTo: nextAssigned,
        search: nextSearch,
        scope: nextScope,
      });
      setLeads(payload.leads || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (replacementMode) return undefined;
    let active = true;
    setLoading(true);
    fetchLeads({ status: 'neu' })
      .then((payload) => {
        if (active) setLeads(payload.leads || []);
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
  }, [replacementMode]);

  useEffect(() => {
    if (!replacementMode || !replacementComplaint || !isReplacementPending(replacementComplaint)) {
      return undefined;
    }
    setAssignedTo('unassigned');
    setStatus('');
    if (requiredScope) setScope(requiredScope);
    load({ assignedTo: 'unassigned', status: '', scope: requiredScope });
    return undefined;
  }, [replacementMode, replacementComplaint?.id, requiredScope]);

  useEffect(() => {
    if (!replacementFor) {
      setReplacementComplaint(null);
      setReplacementLoading(false);
      setSelectedLeadId('');
      return undefined;
    }
    let active = true;
    setReplacementLoading(true);
    setSelectedLeadId('');
    // Load all complaints — status filter would miss legacy "refunded" rows.
    fetchComplaints()
      .then((payload) => {
        if (!active) return;
        const complaint = (payload.complaints || []).find((entry) => entry.id === replacementFor) || null;
        setReplacementComplaint(complaint);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setReplacementLoading(false);
      });
    return () => {
      active = false;
    };
  }, [replacementFor]);

  async function onSendReplacement() {
    if (!replacementFor || !selectedLeadId) return;
    setSendingReplacement(true);
    setError('');
    setNotice('');
    try {
      await sendComplaintReplacement(replacementFor, selectedLeadId);
      navigate(backTo, {
        replace: true,
        state: { notice: 'Ersatzlead gesendet und der Reklamation zugeordnet.' },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingReplacement(false);
    }
  }

  async function onImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const rows = await parseLeadCsv(file);
      const result = await importLeads(rows);
      const skipped = result.errors?.length || 0;
      if (!result.createdCount && !skipped) {
        setNotice('Keine gültigen Zeilen in der CSV-Datei gefunden.');
      } else {
        setNotice(
          skipped
            ? `${result.createdCount} Lead${result.createdCount === 1 ? '' : 's'} importiert, ${skipped} Zeile${skipped === 1 ? '' : 'n'} übersprungen.`
            : `${result.createdCount} Lead${result.createdCount === 1 ? '' : 's'} importiert.`,
        );
      }
      if (skipped) {
        setError(result.errors.map((entry) => `Zeile ${entry.row}: ${entry.message}`).join(' '));
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={`dash-stack${replacementMode ? ' dash-stack--replacement' : ''}`}>
      {replacementMode ? (
        <ReplacementFlowBanner
          complaint={replacementComplaint}
          loading={replacementLoading}
          blocked={replacementBlocked}
          backTo={backTo}
        />
      ) : (
        <div className="dash-toolbar dash-toolbar--end">
          <div className="dash-intro-actions">
            <button type="button" className="dash-btn dash-btn--ghost" onClick={downloadLeadCsvTemplate}>
              CSV-Vorlage
            </button>
            <label className="dash-btn dash-btn--ghost dash-file-btn">
              {importing ? 'Importiere…' : 'CSV importieren'}
              <input type="file" accept=".csv,text/csv" onChange={onImport} disabled={importing} />
            </label>
            <Link className="dash-btn" to="/dashboard/leads/new">Neuer Lead</Link>
          </div>
        </div>
      )}

      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <section className={`dash-panel${replacementMode ? ' dash-panel--replacement' : ''}`}>
        {!replacementMode ? (
          <div className="dash-toolbar">
            <DashSeg
              value={status || 'all'}
              onChange={(id) => {
                const next = id === 'all' ? '' : id;
                setStatus(next);
                load({ status: next });
              }}
              options={[
                ...STATUS_OPTIONS.map((option) => ({ id: option.id, label: option.label })),
                { id: 'all', label: 'Alle' },
              ]}
            />
          </div>
        ) : null}
        <div className={`dash-filters${replacementMode ? ' dash-filters--compact' : ''}`}>
          <label>
            Suche
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') load({ search: event.target.value });
              }}
              placeholder="Name, E-Mail, Ort, PLZ"
            />
          </label>
          {!replacementMode ? (
            <>
              <label>
                Paket
                <select
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value);
                    load({ scope: event.target.value });
                  }}
                >
                  <option value="">Alle Pakete</option>
                  {LEAD_SCOPE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Zuweisung
                <select
                  value={assignedTo}
                  onChange={(event) => {
                    setAssignedTo(event.target.value);
                    load({ assignedTo: event.target.value });
                  }}
                >
                  <option value="">Alle</option>
                  <option value="unassigned">Nicht zugewiesen</option>
                  {beraters.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName || user.email}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <button type="button" className="dash-btn dash-btn--ghost" onClick={() => load()}>
            Anwenden
          </button>
        </div>

        {loading || (replacementMode && replacementLoading) ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : replacementMode ? (
          !replacementComplaint ? (
            <div className="dash-empty">
              <p>Reklamation nicht gefunden. Gehen Sie zurück und öffnen Sie „Ersatz senden“ erneut.</p>
            </div>
          ) : replacementBlocked ? (
            <div className="dash-empty">
              <p>Für diese Reklamation ist kein Ersatz mehr nötig.</p>
            </div>
          ) : pickableLeads.length ? (
            <>
              <div className="dash-lead-list">
                {pageItems.map((lead) => (
                  <ReplacementLeadListItem
                    key={lead.id}
                    lead={lead}
                    checked={selectedLeadId === lead.id}
                    onSelect={setSelectedLeadId}
                    disabled={sendingReplacement}
                  />
                ))}
              </div>
              <LeadListPagination
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                total={pickableLeads.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          ) : (
            <div className="dash-empty">
              <p>
                {requiredScope
                  ? `Kein freier Lead im Pool für Paket ${leadScopeLabel(requiredScope)}.`
                  : 'Kein freier Lead im Pool.'}
              </p>
            </div>
          )
        ) : leads.length ? (
          <>
            <div className="dash-lead-list">
              {pageItems.map((lead) => (
                <LeadListItem key={lead.id} lead={lead} />
              ))}
            </div>
            <LeadListPagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              total={leads.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <div className="dash-empty">
            <p>Noch keine Leads. Legen Sie einen an oder importieren Sie eine CSV-Datei.</p>
          </div>
        )}
      </section>

      {replacementMode && replacementReady ? (
        <div className="dash-replacement-actions">
          <span className="dash-replacement-actions__hint">
            {selectedLead
              ? <>Ausgewählt: <strong>{selectedLead.fullName || '—'}</strong></>
              : 'Lead aus der Liste wählen'}
          </span>
          <div className="dash-replacement-actions__buttons">
            <button
              type="button"
              className="dash-btn dash-btn--ok"
              disabled={!selectedLeadId || sendingReplacement}
              onClick={onSendReplacement}
            >
              {sendingReplacement ? 'Sende…' : 'Ersatz senden'}
            </button>
            <Link className="dash-btn dash-btn--ghost" to={backTo}>
              Abbrechen
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminLeadEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = returnTo(location);
  const isNew = !id || id === 'new';
  const [form, setForm] = useState(emptyLeadForm);
  const [lead, setLead] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTargets, setActiveTargets] = useState([]);

  const assignTargets = useMemo(() => {
    if (!lead?.requestId) return activeTargets;
    if (activeTargets.some((entry) => entry.requestId === lead.requestId)) return activeTargets;
    return [
      ...activeTargets,
      {
        requestId: lead.requestId,
        beraterId: lead.assignedTo || '',
        code: lead.requestCode || lead.requestId.slice(0, 8).toUpperCase(),
        beraterName: lead.assignedToName || lead.assignedToEmail || 'Berater',
        scopeLabel: leadScopeLabel(lead.scope),
        remaining: null,
      },
    ];
  }, [activeTargets, lead]);

  useEffect(() => {
    let alive = true;
    fetchBeraterPipelines()
      .then((payload) => {
        if (!alive) return;
        const targets = [];
        for (const entry of payload.beraters || []) {
          const name = entry.fullName || entry.email || 'Berater';
          const seen = new Set();
          const requests = [
            ...(entry.requests || []),
            ...(entry.request ? [entry.request] : []),
          ];
          for (const request of requests) {
            if (!request?.id || request.status !== 'active' || seen.has(request.id)) continue;
            seen.add(request.id);
            targets.push({
              requestId: request.id,
              beraterId: entry.id,
              code: request.code || request.id.slice(0, 8).toUpperCase(),
              beraterName: name,
              scopeLabel: leadScopeLabel(request.scope),
              remaining: request.remaining ?? Math.max(0, (request.requestedCount || 0) - (request.validCount || 0)),
            });
          }
        }
        targets.sort((left, right) => String(left.code).localeCompare(String(right.code), 'de'));
        setActiveTargets(targets);
      })
      .catch(() => {
        if (alive) setActiveTargets([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) {
      setEditing(true);
      return undefined;
    }
    let active = true;
    setEditing(false);
    setLoading(true);
    fetchLead(id)
      .then((payload) => {
        if (!active) return;
        setLead(payload.lead);
        setForm(leadToForm(payload.lead));
        setSelectedRequestId(payload.lead.requestId || '');
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
  }, [id, isNew]);

  function startEdit() {
    setNotice('');
    setError('');
    setForm(leadToForm(lead));
    setEditing(true);
  }

  function cancelEdit() {
    setError('');
    setNotice('');
    setForm(leadToForm(lead));
    setEditing(false);
  }

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = formToPayload(form);
      if (isNew) {
        const created = await createLead(payload);
        navigate(`/dashboard/leads/${created.lead.id}`, { replace: true, state: location.state });
        return;
      }
      const updated = await updateLead(id, payload);
      setLead(updated.lead);
      setForm(leadToForm(updated.lead));
      setSelectedRequestId(updated.lead.requestId || '');
      setEditing(false);
      setNotice('Lead gespeichert.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onAssign() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const target = assignTargets.find((entry) => entry.requestId === selectedRequestId) || null;
      const updated = selectedRequestId && target
        ? await assignLead(id, target.beraterId, { requestId: target.requestId })
        : await assignLead(id, null, { requestId: null });
      setLead(updated.lead);
      setForm(leadToForm(updated.lead));
      setSelectedRequestId(updated.lead.requestId || '');
      setNotice(updated.lead.assignedTo ? 'Lead zugewiesen.' : 'Zuweisung entfernt.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm('Diesen Lead wirklich löschen?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteLead(id);
      navigate(backTo);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const subtitle = isNew
    ? 'Qualifizierten Kontakt manuell anlegen.'
    : (editing ? 'Daten anpassen und speichern.' : 'Kontakt prüfen und an einen Berater übergeben.');

  return (
    <div className="dash-stack">
      <Link className="dash-back" to={backTo}>
        <ArrowLeft size={16} />
        {returnLabel(backTo)}
      </Link>

      {isNew || editing ? (
        <p className="dash-lede">{subtitle}</p>
      ) : null}

      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      {loading ? (
        <div className="dash-empty"><p>Laden…</p></div>
      ) : !isNew && lead && !editing ? (
        <LeadView
          lead={lead}
          assignTargets={assignTargets}
          selectedRequestId={selectedRequestId}
          setSelectedRequestId={setSelectedRequestId}
          onAssign={onAssign}
          onEdit={startEdit}
          onDelete={onDelete}
          saving={saving}
        />
      ) : (
        <form className="dash-panel dash-lead-form" onSubmit={onSave}>
          <LeadFormFields form={form} setForm={setForm} />

          {!isNew ? (
            <div className="dash-form dash-form--workflow">
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="dash-form-actions">
            <button type="submit" className="dash-btn" disabled={saving}>
              {saving ? 'Speichern…' : isNew ? 'Lead anlegen' : 'Speichern'}
            </button>
            {!isNew ? (
              <button type="button" className="dash-btn dash-btn--ghost" onClick={cancelEdit} disabled={saving}>
                Abbrechen
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
