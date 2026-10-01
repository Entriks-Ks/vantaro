import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Copy,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { fetchBeraterPipelines, leadTypeLabel } from '../../lib/berater';
import { assignLeadToBerater, statusLabel } from '../../lib/leads';
import { leadScopeLabel } from '../../lib/scopes';
import {
  energyLeadTypeOf,
  energyTypeLabel,
  isAppointmentExpired,
  territoryMatches,
  territoryState,
} from '../../lib/vertical';
import { formatDate } from './helpers';
import { leadScopeOrDefault } from './requestHelpers';

export function statusTone(status) {
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

export function sourceLabel(lead) {
  if (lead?.externalSource === 'tcdial') return 'TC-Dial';
  return SOURCE_LABELS[lead?.source] || lead?.source || '—';
}

export function leadPlace(lead) {
  return [lead?.zip, lead?.city].filter(Boolean).join(' ') || '';
}

export function leadInitials(lead) {
  const first = String(lead?.firstName || '').trim();
  const last = String(lead?.lastName || '').trim();
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'L';
}

export function returnTo(location, fallback = '/dashboard/leads') {
  const from = location?.state?.from;
  if (typeof from !== 'string' || !from.startsWith('/dashboard')) return fallback;
  const path = from.split('?')[0];
  if (/^\/dashboard\/leads\/(energy\/)?[0-9a-f-]{36}$/i.test(path)) return fallback;
  return from;
}

export function returnLabel(path) {
  if (path.startsWith('/dashboard/berater')) return 'Zurück zu Berater';
  if (path.startsWith('/dashboard/reklamationen')) return 'Zurück zu Reklamationen';
  if (path.startsWith('/dashboard/leads/ungueltig') || path.startsWith('/dashboard/leads/abgelehnt')) {
    return 'Zurück zu Ungültige Leads';
  }
  if (path.startsWith('/dashboard/anfordern') || path.startsWith('/dashboard/anfragen')) return 'Zurück zu Anforderungen';
  if (path === '/dashboard' || path.startsWith('/dashboard?')) return 'Zurück zur Übersicht';
  return 'Zurück zur Liste';
}

export function isBlank(value) {
  return value == null || value === '' || value === '—';
}

export function LeadTile({ label, children, wide = false, empty }) {
  const isEmpty = empty ?? isBlank(children);
  return (
    <div className={`dash-lead-tile${wide ? ' is-wide' : ''}${isEmpty ? ' is-empty' : ''}`}>
      <span className="dash-lead-tile__label">{label}</span>
      <div className="dash-lead-tile__value">{isEmpty ? 'Nicht hinterlegt' : children}</div>
    </div>
  );
}

export function LeadSection({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="dash-panel dash-lead-section">
      <header className="dash-lead-section__head">
        <span className="dash-lead-section__icon" aria-hidden="true"><Icon size={17} /></span>
        <div>
          <h4>{title}</h4>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <div className="dash-lead-section__body">{children}</div>
    </section>
  );
}

export function LeadText({ value, empty = 'Nicht hinterlegt.' }) {
  return value
    ? <p className="dash-lead-notes">{value}</p>
    : <p className="dash-muted dash-lead-notes--empty">{empty}</p>;
}

export function CopyableValue({ value, label }) {
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

function LeadActionsMenu({ onEdit, onDelete, disabled, locked }) {
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

  if (locked) return null;

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

export function LeadHero({ lead, kicker, facts = [], badges = null, onEdit, onDelete, saving, locked }) {
  const assigneeName = lead.assignedToName || lead.assignedToEmail || '';
  const heroFacts = facts.filter(Boolean);
  const hasContactActions = Boolean(lead.phone || lead.email);

  return (
    <>
      <section className="dash-panel dash-lead-hero">
        <div className="dash-lead-identity">
          <span className="dash-lead-avatar" aria-hidden="true">{leadInitials(lead)}</span>
          <div className="dash-lead-identity__body">
            <div className="dash-lead-kicker">{kicker}</div>
            <h3>{lead.fullName || '—'}</h3>
            {heroFacts.length ? (
              <div className="dash-lead-identity__place">
                <MapPin size={14} aria-hidden="true" />
                {heroFacts.join(' · ')}
              </div>
            ) : null}
            <div className="dash-lead-hero-meta">
              <span className={`dash-badge dash-badge--${statusTone(lead.status)}`}>
                {statusLabel(lead.status)}
              </span>
              {badges}
              <span className={`dash-lead-assign-pill${assigneeName ? ' is-assigned' : ''}`}>
                <UserRound size={13} aria-hidden="true" />
                {assigneeName || 'Nicht zugewiesen'}
              </span>
              {locked ? (
                <span className="dash-badge dash-badge--muted">Nur Ansicht</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="dash-lead-hero-actions">
          {hasContactActions ? (
            <div className="dash-lead-reach dash-lead-reach--hero">
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
          <LeadActionsMenu onEdit={onEdit} onDelete={onDelete} disabled={saving} locked={locked} />
        </div>
      </section>

      {locked ? (
        <div className="dash-alert dash-alert--ok dash-lead-lock-note">
          Dieser Lead ist zugestellt und gesperrt. Details können angesehen werden — bearbeiten ist erst nach einer
          Reklamation wieder möglich.
        </div>
      ) : null}
    </>
  );
}

export function LeadCompletenessPanel({ checks, onSelect, className = '' }) {
  const total = checks.length;
  const missing = checks.filter(([, ok]) => !ok).map(([label, , section]) => ({ label, section }));
  const filled = total - missing.length;
  const percent = total ? Math.round((filled / total) * 100) : 100;
  const tone = percent === 100 ? 'ok' : percent >= 70 ? 'warn' : 'bad';

  return (
    <section className={`dash-panel dash-lead-complete ${className}`.trim()}>
      <div className="dash-panel-head">
        <strong>Vollständigkeit</strong>
        <span className={`dash-lead-complete__count is-${tone}`}>{filled}/{total}</span>
      </div>
      <div
        className={`dash-lead-complete__bar is-${tone}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Vollständigkeit der Lead-Daten"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {missing.length ? (
        <div className="dash-lead-complete__missing">
          <span>Fehlt:</span>
          <div>
            {missing.map(({ label, section }) => (onSelect && section ? (
              <button key={label} type="button" onClick={() => onSelect(section)} title={`Zu „${label}“ springen`}>
                {label}
              </button>
            ) : (
              <em key={label}>{label}</em>
            )))}
          </div>
        </div>
      ) : (
        <p className="dash-lead-complete__ok">
          <CheckCircle2 size={14} aria-hidden="true" />
          Alle Angaben vorhanden.
        </p>
      )}
    </section>
  );
}

export function isEmptyValue(value) {
  return Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim();
}

export function Field({ label, required = false, optional = false, full = false, missing = false, children }) {
  const className = [full ? 'is-full' : '', missing ? 'is-missing' : ''].filter(Boolean).join(' ');
  return (
    <label className={className || undefined}>
      <span className="dash-field-label">
        {label}
        {required ? <em className="dash-req" aria-hidden="true">*</em> : null}
        {optional ? <small className="dash-optional">optional</small> : null}
      </span>
      {children}
    </label>
  );
}

export function SteppedLeadForm({
  kicker,
  title,
  submitLabel,
  saving,
  steps,
  checks,
  required = checks,
  renderStep,
  onSubmit,
  onCancel,
}) {
  const [step, setStep] = useState(steps[0]?.id);
  const [hint, setHint] = useState('');
  const stepIndex = Math.max(0, steps.findIndex((item) => item.id === step));
  const current = steps[stepIndex];

  function goTo(id) {
    setHint('');
    setStep(id);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const missing = required.filter(([, ok]) => !ok);
    if (missing.length) {
      setStep(missing[0][2]);
      setHint(`Bitte noch ausfüllen: ${missing.map(([label]) => label).join(', ')}.`);
      return;
    }
    setHint('');
    onSubmit(event);
  }

  return (
    <form className="dash-lead-edit" onSubmit={handleSubmit}>
      <section className="dash-panel dash-lead-edit__head">
        <div className="dash-lead-edit__title">
          <div className="dash-lead-kicker">{kicker}</div>
          <h3>{title}</h3>
        </div>
        <div className="dash-lead-edit__buttons">
          <button type="button" className="dash-btn dash-btn--ghost" onClick={onCancel} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" className="dash-btn" disabled={saving}>
            {saving ? 'Wird gespeichert…' : submitLabel}
          </button>
        </div>
      </section>

      <LeadCompletenessPanel checks={checks} onSelect={goTo} className="dash-lead-complete--inline" />

      <nav className="dash-lead-steps" aria-label="Bereiche">
        {steps.map((item, index) => {
          const Icon = item.icon;
          const open = checks.filter(([, ok, section]) => section === item.id && !ok).length;
          const active = item.id === current.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`dash-lead-step${active ? ' is-active' : ''}${open ? ' has-open' : ' is-done'}`}
              aria-current={active ? 'step' : undefined}
              onClick={() => goTo(item.id)}
            >
              <span className="dash-lead-step__icon" aria-hidden="true">
                {open ? <Icon size={15} /> : <CheckCircle2 size={15} />}
              </span>
              <span className="dash-lead-step__text">
                <strong>{index + 1}. {item.label}</strong>
                <small>{open ? `${open} offen` : 'Vollständig'}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="dash-panel dash-lead-edit__card">
        {hint ? <div className="dash-alert dash-lead-edit__hint">{hint}</div> : null}
        {renderStep(current.id)}
        <div className="dash-lead-edit__nav">
          <span>Schritt {stepIndex + 1} von {steps.length}</span>
          <div>
            <button
              type="button"
              className="dash-btn dash-btn--ghost"
              onClick={() => goTo(steps[stepIndex - 1].id)}
              disabled={stepIndex === 0}
            >
              Zurück
            </button>
            {stepIndex < steps.length - 1 ? (
              <button type="button" className="dash-btn dash-btn--ghost" onClick={() => goTo(steps[stepIndex + 1].id)}>
                Weiter
              </button>
            ) : (
              <button type="submit" className="dash-btn" disabled={saving}>
                {saving ? 'Wird gespeichert…' : submitLabel}
              </button>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}

export function LeadOriginPanel({ lead, packageLabel, children }) {
  return (
    <section className="dash-panel dash-lead-meta">
      <div className="dash-panel-head"><strong>Herkunft &amp; Verlauf</strong></div>
      <dl className="dash-lead-meta-list">
        <div>
          <dt>Paket</dt>
          <dd>{packageLabel}</dd>
        </div>
        {lead.requestCode || lead.requestId ? (
          <div>
            <dt>Anforderung</dt>
            <dd>{lead.requestCode || String(lead.requestId).slice(0, 8).toUpperCase()}</dd>
          </div>
        ) : null}
        <div>
          <dt>Quelle</dt>
          <dd>{sourceLabel(lead)}</dd>
        </div>
        {lead.externalId ? (
          <div>
            <dt>TC-Dial ID</dt>
            <dd>{lead.externalId}</dd>
          </div>
        ) : null}
        {children}
        <div>
          <dt>Angelegt</dt>
          <dd>{formatDate(lead.createdAt)}</dd>
        </div>
        {lead.assignedAt ? (
          <div>
            <dt>Zugestellt</dt>
            <dd>{formatDate(lead.assignedAt)}</dd>
          </div>
        ) : null}
        {lead.updatedAt ? (
          <div>
            <dt>Aktualisiert</dt>
            <dd>{formatDate(lead.updatedAt)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function beraterLabel(user) {
  return user?.fullName || user?.email || 'Berater';
}

function openRequestsForLead(berater, lead) {
  const leadVertical = lead?.vertical === 'energy' ? 'energy' : 'insurance';
  const beraterVertical = berater?.vertical === 'energy' ? 'energy' : 'insurance';
  if (leadVertical !== beraterVertical) return [];
  if (leadVertical === 'energy') {
    const type = energyLeadTypeOf(lead);
    return (berater?.requests || []).filter((request) => (
      request.status === 'active'
      && request.leadType === type
      && territoryMatches(request.territory, lead)
      && Number(request.remaining) > 0
    ));
  }
  const scope = leadScopeOrDefault(lead?.scope);
  return (berater?.requests || []).filter((request) => (
    request.status === 'active'
    && leadScopeOrDefault(request.scope) === scope
    && Number(request.remaining) > 0
  ));
}

function matchingRequestsForLead(beraters, lead) {
  return (beraters || [])
    .flatMap((entry) => openRequestsForLead(entry, lead).map((request) => ({
      request,
      beraterId: entry.id,
      beraterName: beraterLabel(entry),
      beraterEmail: entry.email || '',
      company: entry.company || '',
    })))
    .sort((left, right) => new Date(left.request.createdAt || 0) - new Date(right.request.createdAt || 0));
}

function requestAssignLabel(request, lead) {
  const code = request?.code || String(request?.id || '').slice(0, 8).toUpperCase();
  const remaining = Number(request?.remaining) || 0;
  const requested = Number(request?.requestedCount) || 0;
  const energy = lead?.vertical === 'energy';
  return {
    code,
    product: [
      energy ? energyTypeLabel(request?.leadType) : leadTypeLabel(request?.leadType),
      energy ? (request?.territory || 'Alle Gebiete') : leadScopeLabel(request?.scope),
      energy && territoryState(request?.territory) ? `Gebiet: ganz ${territoryState(request.territory)}` : '',
    ].filter(Boolean).join(' · '),
    progress: `${request?.validCount || 0}/${requested} geliefert · noch ${remaining} offen`,
  };
}

function matchesAssignSearch(option, query) {
  if (!query) return true;
  const haystack = [
    option.beraterName,
    option.beraterEmail,
    option.company,
    option.request.code,
    option.request.id,
  ].join(' ').toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

function LeadAssignModal({ lead, options, saving, error, onSend, onClose }) {
  const [search, setSearch] = useState('');
  const [requestId, setRequestId] = useState(options.length === 1 ? options[0].request.id : '');

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [saving, onClose]);

  const query = search.trim().toLowerCase();
  const visible = options.filter((option) => matchesAssignSearch(option, query));
  const selected = options.find((entry) => entry.request.id === requestId) || null;
  const selectedLabel = selected ? requestAssignLabel(selected.request, lead) : null;

  function onSubmit(event) {
    event.preventDefault();
    if (selected && !saving) onSend(selected);
  }

  return createPortal(
    <div className="dash-confirm-root dash-assign-modal-root" role="dialog" aria-modal="true" aria-labelledby="lead-assign-modal-title">
      <button
        type="button"
        className="dash-confirm-overlay"
        aria-label="Schließen"
        onClick={saving ? undefined : onClose}
      />
      <form className="dash-assign-modal" onSubmit={onSubmit}>
        <header className="dash-assign-modal__head">
          <div>
            <div className="dash-lead-kicker">Lead zuweisen</div>
            <h3 id="lead-assign-modal-title">{lead.fullName || 'Lead'}</h3>
            <p>{options.length} passende Anforderung{options.length === 1 ? '' : 'en'}</p>
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

        <label className="dash-assign-modal__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Berater, Firma oder Anforderungs-Code suchen"
            aria-label="Anforderungen durchsuchen"
            autoFocus
          />
        </label>

        <div className="dash-assign-modal__list">
          {visible.length ? (
            <div className="dash-pick-list dash-lead-assign-picks">
              {visible.map(({ request, beraterName, beraterEmail, company }) => {
                const label = requestAssignLabel(request, lead);
                const checked = requestId === request.id;
                return (
                  <label
                    key={request.id}
                    className={`dash-pick-row dash-lead-assign-option${checked ? ' is-checked' : ''}${saving ? ' is-disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="lead-assign-request"
                      value={request.id}
                      checked={checked}
                      onChange={() => setRequestId(request.id)}
                      disabled={saving}
                    />
                    <span>
                      <span className="dash-lead-assign-option__head">
                        <strong>{beraterName}</strong>
                        <code className="dash-lead-assign-option__code">{label.code}</code>
                      </span>
                      {company || beraterEmail ? (
                        <small>{[company, beraterEmail].filter(Boolean).join(' · ')}</small>
                      ) : null}
                      <small>{label.product}</small>
                      <small>{label.progress}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="dash-assign-modal__empty">Keine Anforderung passt zu „{search.trim()}“.</p>
          )}
        </div>

        <footer className="dash-assign-modal__foot">
          {error ? <div className="dash-alert">{error}</div> : null}
          {selected ? (
            <div className="dash-lead-assign-summary">
              <span>Wird gesendet an</span>
              <strong>{selected.beraterName}</strong>
              <small>Anforderung {selectedLabel.code} · {selectedLabel.product}</small>
            </div>
          ) : (
            <p className="dash-lead-assign-hint">Anforderung wählen, an die der Lead gesendet wird.</p>
          )}
          <div className="dash-confirm-actions">
            <button type="button" className="dash-btn dash-btn--ghost" onClick={onClose} disabled={saving}>
              Abbrechen
            </button>
            <button type="submit" className="dash-btn dash-btn--ok" disabled={!selected || saving}>
              <UserPlus size={15} aria-hidden="true" />
              {saving ? 'Wird gesendet…' : selected ? `An ${selected.beraterName} senden` : 'Lead senden'}
            </button>
          </div>
        </footer>
      </form>
    </div>,
    document.body,
  );
}

export function LeadAssignPanel({ lead, disabled, onAssigned }) {
  const [beraters, setBeraters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBeraterPipelines()
      .then((payload) => {
        if (!active) return;
        setBeraters(payload.beraters || []);
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
  }, [lead?.id]);

  const options = useMemo(() => matchingRequestsForLead(beraters, lead), [beraters, lead]);
  const expired = isAppointmentExpired(lead);
  const closeModal = useCallback(() => {
    setOpen(false);
    setError('');
  }, []);

  async function onSend(selected) {
    setSaving(true);
    setError('');
    try {
      const result = await assignLeadToBerater(lead.id, {
        beraterId: selected.beraterId,
        requestId: selected.request.id,
      });
      setOpen(false);
      onAssigned?.(result.lead);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dash-panel dash-lead-assign">
      <div className="dash-panel-head"><strong>Zuweisung</strong></div>
      <div className="dash-lead-assign-body">
        <div className="dash-lead-assign-current">
          <span>Aktuell</span>
          <strong>Nicht zugewiesen</strong>
        </div>
        {expired ? (
          <div className="dash-alert">
            Der Termin ist verstrichen und kann nicht mehr gesendet werden. Bitte über „Bearbeiten“ ein neues
            Datum eintragen, um ihn wieder zuzuweisen.
          </div>
        ) : loading ? (
          <p className="dash-muted">Anforderungen werden geladen…</p>
        ) : options.length ? (
          <>
            <p className="dash-lead-assign-hint">
              {options.length} passende Anforderung{options.length === 1 ? '' : 'en'} für diesen Lead.
            </p>
            <button
              type="button"
              className="dash-btn dash-lead-assign-submit"
              onClick={() => setOpen(true)}
              disabled={disabled}
            >
              <UserPlus size={15} aria-hidden="true" />
              Lead zuweisen
            </button>
          </>
        ) : error ? null : (
          <p className="dash-muted">
            {lead?.vertical === 'energy'
              ? 'Keine offene Energie-Anforderung passt zu Produkt und Gebiet dieses Leads.'
              : 'Keine offene Versicherungs-Anforderung passt zum Paket dieses Leads.'}
          </p>
        )}
        {error && !open ? <div className="dash-alert">{error}</div> : null}
      </div>
      {open ? (
        <LeadAssignModal
          lead={lead}
          options={options}
          saving={saving}
          error={error}
          onSend={onSend}
          onClose={closeModal}
        />
      ) : null}
    </section>
  );
}

export function canAssignLead(lead, locked) {
  return !locked && !lead.refundedAt && lead.status !== 'erledigt';
}
