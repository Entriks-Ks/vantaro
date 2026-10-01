import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Download,
  FileSpreadsheet,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  Plus,
  ShieldCheck,
  SunMedium,
  Upload,
  UserRound,
} from 'lucide-react';
import PhoneField from '../../components/PhoneField';
import { useDashboard } from '../../hooks/useDashboard';
import {
  CONCERN_OPTIONS,
  COVERAGE_OPTIONS,
  EMPLOYMENT_OPTIONS,
  INSURANCE_OPTIONS,
  STATUS_OPTIONS,
  createLead,
  deleteLead,
  downloadAppointmentCsvTemplate,
  downloadLeadCsvTemplate,
  emptyLeadForm,
  employmentLabel,
  fetchLead,
  fetchLeads,
  formToPayload,
  formatLeadDate,
  formatPremium,
  importLeads,
  isLeadDeliveryLocked,
  leadToForm,
  listLabels,
  parseAppointmentCsv,
  parseLeadCsv,
  statusLabel,
  toggleListValue,
  updateLead,
} from '../../lib/leads';
import { complaintReasonLabel, fetchComplaints, sendComplaintReplacement } from '../../lib/complaints';
import { DashSeg } from './DashboardLayout';
import { formatDate } from './helpers';
import { DEFAULT_LEAD_SCOPE, LEAD_SCOPE_OPTIONS, leadScopeLabel } from '../../lib/scopes';
import {
  energyLeadTypeOf,
  energyTypeLabel,
  isAppointmentExpired,
  verticalLabel,
  verticalOrInsurance,
} from '../../lib/vertical';
import { isReplacementPending } from './ComplaintReplacementStatus';
import {
  CopyableValue,
  Field,
  LeadAssignPanel,
  LeadCompletenessPanel,
  LeadHero,
  LeadOriginPanel,
  LeadSection,
  LeadText,
  LeadTile,
  SteppedLeadForm,
  canAssignLead,
  isBlank,
  isEmptyValue,
  leadInitials,
  leadPlace,
  returnLabel,
  returnTo,
  statusTone,
} from './LeadDetail';

const APPOINTMENT_FORMAT = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function appointmentTime(lead) {
  const at = new Date(lead?.appointmentAt || '');
  return Number.isNaN(at.getTime()) ? null : at;
}

function formatAppointment(lead) {
  const at = appointmentTime(lead);
  return at ? `${APPOINTMENT_FORMAT.format(at)} Uhr` : 'Kein Termin hinterlegt';
}

export function LeadListItem({ lead }) {
  const location = useLocation();
  const place = leadPlace(lead);
  const assigned = lead.assignedToName || lead.assignedToEmail || 'Nicht zugewiesen';
  const insurance = listLabels(lead.insuranceStatus, 'insurance');
  const concerns = listLabels(lead.mainConcerns, 'concern');
  const energyTag = lead.vertical === 'energy' ? energyTypeLabel(energyLeadTypeOf(lead)) : '';
  const tags = lead.vertical === 'energy'
    ? [energyTag !== '—' ? energyTag : null].filter(Boolean)
    : [insurance !== '—' ? insurance : null, concerns !== '—' ? concerns : null].filter(Boolean);
  const from = `${location.pathname}${location.search}`;
  const detailPath = lead.vertical === 'energy'
    ? `/dashboard/leads/energy/${lead.id}`
    : `/dashboard/leads/${lead.id}`;
  const isAppointment = isAppointmentLead(lead);
  const expired = isAppointmentExpired(lead);

  return (
    <Link className={`dash-lead-row${expired ? ' is-expired' : ''}`} to={detailPath} state={{ from }}>
      <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
        {leadInitials(lead)}
      </span>
      <div className="dash-lead-row-main">
        <strong>{lead.fullName || '—'}</strong>
        <span className="dash-lead-row-sub">
          {[lead.email, place].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
        </span>
        {tags.length ? <span className="dash-lead-row-tags">{tags.join(' · ')}</span> : null}
        {isAppointment ? (
          <span className={`dash-lead-row-appt${expired ? ' is-expired' : ''}`}>
            <CalendarClock size={13} aria-hidden="true" />
            Termin: {formatAppointment(lead)}
          </span>
        ) : null}
      </div>
      <div className="dash-lead-row-side">
        <div className="dash-lead-row-side-badges">
          {expired ? <span className="dash-badge dash-badge--danger">Termin verstrichen</span> : null}
          <span className="dash-badge dash-badge--muted">
            {lead.vertical === 'energy' ? verticalLabel('energy') : leadScopeLabel(lead.scope)}
          </span>
          <span className={`dash-badge dash-badge--${statusTone(lead.status)}`}>
            {statusLabel(lead.status)}
          </span>
        </div>
        <div className="dash-lead-row-side-meta">
          <span className="dash-lead-row-side-assignee" title={assigned}>{assigned}</span>
          <span className="dash-lead-row-side-date">{formatDate(lead.createdAt)}</span>
        </div>
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
        <div className="dash-lead-row-side-badges">
          <span className="dash-badge dash-badge--muted">
            {lead.vertical === 'energy' ? verticalLabel('energy') : leadScopeLabel(lead.scope)}
          </span>
          <span className={`dash-badge dash-badge--${statusTone(lead.status)}`}>
            {statusLabel(lead.status)}
          </span>
        </div>
        <span className="dash-lead-row-side-date">{formatDate(lead.createdAt)}</span>
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
          <small>{complaintReasonLabel(complaint.reason, rejectedLead?.vertical)}</small>
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

function hasListValue(ids, type) {
  return Boolean(ids?.length) && listLabels(ids, type) !== '—';
}

function ChipList({ ids, type }) {
  if (!hasListValue(ids, type)) return null;
  return (
    <div className="dash-chips">
      {listLabels(ids, type).split(', ').map((label) => (
        <span key={label} className="is-active">{label}</span>
      ))}
    </div>
  );
}

function insuranceChecks(lead) {
  return [
    ['Geburtsdatum', !isBlank(lead.dateOfBirth), 'person'],
    ['Berufliche Situation', !isBlank(lead.employmentStatus), 'person'],
    ['Telefon', !isBlank(lead.phone), 'contact'],
    ['E-Mail', !isBlank(lead.email), 'contact'],
    ['PLZ', !isBlank(lead.zip), 'address'],
    ['Ort', !isBlank(lead.city), 'address'],
    ['Versicherungsstatus', hasListValue(lead.insuranceStatus, 'insurance'), 'insurance'],
    ['Gesellschaft', !isBlank(lead.currentInsurer), 'insurance'],
    ['Beitrag', !isBlank(lead.monthlyPremium), 'insurance'],
    ['Personenkreis', hasListValue(lead.coverageCircle, 'coverage'), 'insurance'],
    ['Hauptanliegen', hasListValue(lead.mainConcerns, 'concern'), 'need'],
  ];
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

function LeadView({
  lead,
  onEdit,
  onDelete,
  onAssigned,
  saving,
}) {
  const age = leadAge(lead.dateOfBirth);
  const employment = lead.employmentStatus === 'sonstiges' && lead.employmentOther
    ? lead.employmentOther
    : employmentLabel(lead.employmentStatus);
  const locked = isLeadDeliveryLocked(lead);
  const place = leadPlace(lead);
  const premium = formatPremium(lead.monthlyPremium);

  return (
    <div className={`dash-lead-view${locked ? ' is-locked' : ''}`}>
      <LeadHero
        lead={lead}
        kicker="Versicherungs-Lead"
        facts={[place, age != null ? `${age} Jahre` : '']}
        badges={<span className="dash-badge dash-badge--muted">{leadScopeLabel(lead.scope)}</span>}
        onEdit={onEdit}
        onDelete={onDelete}
        saving={saving}
        locked={locked}
      />

      <div className="dash-lead-layout">
        <div className="dash-lead-main">
          <LeadSection icon={UserRound} title="Person & Kontakt" subtitle="Wer ist der Kunde und wie ist er erreichbar">
            <div className="dash-lead-tiles">
              <LeadTile label="Telefon" empty={!lead.phone}>
                <CopyableValue value={lead.phone} label="Telefonnummer" />
              </LeadTile>
              <LeadTile label="E-Mail" empty={!lead.email}>
                <CopyableValue value={lead.email} label="E-Mail" />
              </LeadTile>
              <LeadTile label="Geburtsdatum" empty={!lead.dateOfBirth}>
                {formatLeadDate(lead.dateOfBirth)}
                {age != null ? <span className="dash-fact-hint">{age} Jahre</span> : null}
              </LeadTile>
              <LeadTile label="Berufliche Situation">{employment}</LeadTile>
              <LeadTile label="Adresse" wide empty={!lead.street && !place}>
                {lead.street ? <span className="dash-lead-tile__line">{lead.street}</span> : null}
                {place ? <span className="dash-lead-tile__line">{place}</span> : null}
              </LeadTile>
            </div>
          </LeadSection>

          <LeadSection icon={ShieldCheck} title="Versicherung & Bedarf" subtitle="Aktuelle Absicherung und Anliegen des Kunden">
            <div className="dash-lead-tiles dash-lead-tiles--highlight">
              <LeadTile label="Versicherungsstatus" empty={!hasListValue(lead.insuranceStatus, 'insurance')}>
                <ChipList ids={lead.insuranceStatus} type="insurance" />
              </LeadTile>
              <LeadTile label="Beitrag / Monat" empty={isBlank(premium)}>
                <span className="dash-lead-tile__big">{premium}</span>
              </LeadTile>
            </div>
            <div className="dash-lead-tiles">
              <LeadTile label="Aktuelle Gesellschaft">{lead.currentInsurer}</LeadTile>
              <LeadTile label="Personenkreis" empty={!hasListValue(lead.coverageCircle, 'coverage')}>
                <ChipList ids={lead.coverageCircle} type="coverage" />
              </LeadTile>
              <LeadTile label="Hauptanliegen" wide empty={!hasListValue(lead.mainConcerns, 'concern')}>
                <ChipList ids={lead.mainConcerns} type="concern" />
              </LeadTile>
            </div>
          </LeadSection>

          <LeadSection icon={MessageSquareText} title="Gesprächsnotizen" subtitle="Hinweise aus dem Qualifizierungsgespräch">
            <LeadText value={lead.notes} empty="Keine Notizen hinterlegt." />
          </LeadSection>
        </div>

        <aside className="dash-lead-aside">
          {canAssignLead(lead, locked) ? (
            <LeadAssignPanel lead={lead} disabled={saving} onAssigned={onAssigned} />
          ) : null}
          <LeadCompletenessPanel checks={insuranceChecks(lead)} />
          <LeadOriginPanel lead={lead} packageLabel={leadScopeLabel(lead.scope)} />
        </aside>
      </div>
    </div>
  );
}

function CheckGroup({ legend, options, values, onToggle, missing = false }) {
  return (
    <fieldset className={`dash-toggle-group is-full${missing ? ' is-missing' : ''}`}>
      <legend className="dash-field-label">{legend}</legend>
      <div className="dash-toggle-group__options">
        {options.map((option) => {
          const checked = values.includes(option.id);
          return (
            <label key={option.id} className={`dash-toggle-chip${checked ? ' is-checked' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(option.id)} />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const INSURANCE_FORM_STEPS = [
  { id: 'package', label: 'Paket', icon: Package },
  { id: 'person', label: 'Person', icon: UserRound },
  { id: 'contact', label: 'Kontakt', icon: Phone },
  { id: 'address', label: 'Adresse', icon: MapPin },
  { id: 'insurance', label: 'Versicherung', icon: ShieldCheck },
  { id: 'need', label: 'Bedarf', icon: MessageSquareText },
];

function InsuranceStepFields({ step, form, setField, isNew }) {
  const bind = (key) => ({ value: form[key], onChange: (event) => setField(key, event.target.value) });
  const toggle = (key) => (id) => setField(key, toggleListValue(form[key], id));
  const miss = (key) => isEmptyValue(form[key]);

  if (step === 'package') {
    return (
      <div className="dash-form">
        <Field label="Paket" required>
          <select value={form.scope || DEFAULT_LEAD_SCOPE} onChange={(event) => setField('scope', event.target.value)} required>
            {LEAD_SCOPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
        {!isNew ? (
          <Field label="Status">
            <select {...bind('status')}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
    );
  }
  if (step === 'person') {
    return (
      <div className="dash-form">
        <Field label="Vorname" required missing={miss('firstName')}>
          <input {...bind('firstName')} autoComplete="off" required />
        </Field>
        <Field label="Nachname" required missing={miss('lastName')}>
          <input {...bind('lastName')} autoComplete="off" required />
        </Field>
        <Field label="Geburtsdatum" missing={miss('dateOfBirth')}><input type="date" {...bind('dateOfBirth')} /></Field>
        <Field label="Berufliche Situation" missing={miss('employmentStatus')}>
          <select {...bind('employmentStatus')}>
            <option value="">Bitte wählen</option>
            {EMPLOYMENT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
        {form.employmentStatus === 'sonstiges' ? (
          <Field label="Berufliche Situation, sonstiges" full>
            <input {...bind('employmentOther')} />
          </Field>
        ) : null}
      </div>
    );
  }
  if (step === 'contact') {
    return (
      <div className="dash-form">
        <Field label="Mobilnummer / Telefon" missing={miss('phone')}>
          <PhoneField value={form.phone} onChange={(value) => setField('phone', value)} />
        </Field>
        <Field label="E-Mail-Adresse" missing={miss('email')}><input type="email" {...bind('email')} /></Field>
      </div>
    );
  }
  if (step === 'address') {
    return (
      <div className="dash-form">
        <Field label="PLZ" missing={miss('zip')}><input {...bind('zip')} inputMode="numeric" maxLength={5} /></Field>
        <Field label="Ort" missing={miss('city')}><input {...bind('city')} /></Field>
        <Field label="Straße" optional full><input {...bind('street')} /></Field>
      </div>
    );
  }
  if (step === 'insurance') {
    return (
      <div className="dash-form">
        <CheckGroup
          legend="Versicherungsstatus"
          options={INSURANCE_OPTIONS}
          values={form.insuranceStatus}
          onToggle={toggle('insuranceStatus')}
          missing={miss('insuranceStatus')}
        />
        <Field label="Aktuelle Gesellschaft / Krankenkasse" missing={miss('currentInsurer')}>
          <input {...bind('currentInsurer')} />
        </Field>
        <Field label="Monatlicher Beitrag (€)" missing={miss('monthlyPremium')}>
          <input inputMode="decimal" {...bind('monthlyPremium')} placeholder="z. B. 420" />
        </Field>
        <CheckGroup
          legend="Personenkreis"
          options={COVERAGE_OPTIONS}
          values={form.coverageCircle}
          onToggle={toggle('coverageCircle')}
          missing={miss('coverageCircle')}
        />
      </div>
    );
  }
  return (
    <div className="dash-form">
      <CheckGroup
        legend="Hauptanliegen"
        options={CONCERN_OPTIONS}
        values={form.mainConcerns}
        onToggle={toggle('mainConcerns')}
        missing={miss('mainConcerns')}
      />
      <Field label="Gesprächsnotizen" optional full>
        <textarea rows={3} {...bind('notes')} />
      </Field>
    </div>
  );
}

function InsuranceLeadForm({ form, setForm, isNew, saving, onSubmit, onCancel }) {
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const name = [form.firstName, form.lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
  const nameCheck = ['Vor- & Nachname', Boolean(String(form.firstName || '').trim() && String(form.lastName || '').trim()), 'person'];

  return (
    <SteppedLeadForm
      kicker={isNew ? 'Neuer Versicherungs-Lead' : 'Versicherungs-Lead bearbeiten'}
      title={name || (isNew ? 'Kontakt anlegen' : '—')}
      submitLabel={isNew ? 'Lead anlegen' : 'Änderungen speichern'}
      saving={saving}
      steps={INSURANCE_FORM_STEPS}
      checks={[nameCheck, ...insuranceChecks(form)]}
      required={[nameCheck]}
      onSubmit={onSubmit}
      onCancel={onCancel}
      renderStep={(step) => <InsuranceStepFields step={step} form={form} setField={setField} isNew={isNew} />}
    />
  );
}

function ToolbarMenu({ label, icon: Icon, variant = 'ghost', disabled = false, children }) {
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
    <div className={`dash-tmenu${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`dash-btn dash-btn--${variant} dash-tmenu__trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        {label}
        <ChevronDown size={15} className="dash-tmenu__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="dash-tmenu__panel" role="menu">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarMenuItem({ icon: Icon, title, description, tone = 'neutral', onSelect }) {
  return (
    <button type="button" role="menuitem" className="dash-tmenu__item" onClick={onSelect}>
      <span className={`dash-tmenu__icon is-${tone}`} aria-hidden="true"><Icon size={16} /></span>
      <span className="dash-tmenu__text">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

function isAppointmentLead(lead) {
  return lead.deliveryType === 'appointment';
}

export function AdminLeads({ mode = 'leads' }) {
  const termine = mode === 'termine';
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
  const [vertical, setVertical] = useState(termine ? 'energy' : '');
  const [appointmentTiming, setAppointmentTiming] = useState('upcoming');
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef(null);
  const [replacementComplaint, setReplacementComplaint] = useState(null);
  const [replacementLoading, setReplacementLoading] = useState(replacementMode);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [sendingReplacement, setSendingReplacement] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const beraters = useMemo(
    () => (admin?.directory || []).filter((user) => (
      user.role === 'berater'
      && (!vertical || verticalOrInsurance(user.vertical) === vertical)
    )),
    [admin?.directory, vertical],
  );

  const pickableLeads = useMemo(
    () => leads.filter((lead) => (
      !lead.assignedTo && lead.status !== 'erledigt' && !lead.refundedAt && !isAppointmentExpired(lead)
    )),
    [leads],
  );

  const appointmentGroups = useMemo(() => {
    if (!termine) return { upcoming: [], expired: [] };
    const time = (lead) => appointmentTime(lead)?.getTime() ?? Number.POSITIVE_INFINITY;
    const appointments = leads.filter(isAppointmentLead);
    return {
      upcoming: appointments
        .filter((lead) => !isAppointmentExpired(lead))
        .sort((left, right) => time(left) - time(right)),
      expired: appointments
        .filter((lead) => isAppointmentExpired(lead))
        .sort((left, right) => time(right) - time(left)),
    };
  }, [leads, termine]);

  const visibleLeads = useMemo(
    () => (termine
      ? appointmentGroups[appointmentTiming]
      : leads.filter((lead) => !isAppointmentLead(lead))),
    [leads, termine, appointmentGroups, appointmentTiming],
  );

  const listSource = replacementMode ? pickableLeads : visibleLeads;
  const totalPages = Math.max(1, Math.ceil(listSource.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return listSource.slice(start, start + pageSize);
  }, [listSource, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [status, assignedTo, search, scope, pageSize, replacementMode, appointmentTiming, listSource.length]);

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
        vertical: next.vertical ?? vertical,
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
    fetchLeads({ status: 'neu', vertical })
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
  }, [replacementMode, vertical]);

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
      const rows = termine ? await parseAppointmentCsv(file) : await parseLeadCsv(file);
      const result = await importLeads(rows);
      const skipped = result.errors?.length || 0;
      const count = result.createdCount;
      const noun = termine
        ? `Termin${count === 1 ? '' : 'e'}`
        : `Lead${count === 1 ? '' : 's'}`;
      if (!count && !skipped) {
        setNotice('Keine gültigen Zeilen in der CSV-Datei gefunden.');
      } else {
        setNotice(
          skipped
            ? `${count} ${noun} importiert, ${skipped} Zeile${skipped === 1 ? '' : 'n'} übersprungen.`
            : `${count} ${noun} importiert.`,
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
      ) : termine ? (
        <div className="dash-toolbar dash-toolbar--end">
          <div className="dash-intro-actions">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onImport}
              disabled={importing}
              hidden
            />
            <ToolbarMenu label={importing ? 'Importiere…' : 'CSV'} icon={FileSpreadsheet} disabled={importing}>
              {(close) => (
                <>
                  <div className="dash-tmenu__group">Energie-Termine</div>
                  <ToolbarMenuItem
                    icon={Download}
                    title="Vorlage herunterladen"
                    description="CSV mit allen Termin-Spalten"
                    onSelect={() => {
                      close();
                      downloadAppointmentCsvTemplate();
                    }}
                  />
                  <ToolbarMenuItem
                    icon={Upload}
                    title="CSV importieren"
                    description="Ausgefüllte Termin-Vorlage hochladen"
                    onSelect={() => {
                      close();
                      csvInputRef.current?.click();
                    }}
                  />
                </>
              )}
            </ToolbarMenu>
            <Link
              className="dash-btn dash-btn--ok"
              to="/dashboard/leads/energy/new?delivery=appointment"
              state={{ from: `${location.pathname}${location.search}` }}
            >
              <Plus size={15} aria-hidden="true" />
              Neuer Termin
            </Link>
          </div>
        </div>
      ) : (
        <div className="dash-toolbar dash-toolbar--end">
          <div className="dash-intro-actions">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onImport}
              disabled={importing}
              hidden
            />
            <ToolbarMenu label={importing ? 'Importiere…' : 'CSV'} icon={FileSpreadsheet} disabled={importing}>
              {(close) => (
                <>
                  <div className="dash-tmenu__group">Versicherungs-Leads</div>
                  <ToolbarMenuItem
                    icon={Download}
                    title="Vorlage herunterladen"
                    description="Leere CSV mit allen Spalten"
                    onSelect={() => {
                      close();
                      downloadLeadCsvTemplate();
                    }}
                  />
                  <ToolbarMenuItem
                    icon={Upload}
                    title="CSV importieren"
                    description="Ausgefüllte Vorlage hochladen"
                    onSelect={() => {
                      close();
                      csvInputRef.current?.click();
                    }}
                  />
                </>
              )}
            </ToolbarMenu>
            <ToolbarMenu label="Neuer Lead" icon={Plus} variant="ok">
              {(close) => {
                const open = (path) => {
                  close();
                  navigate(path, { state: { from: `${location.pathname}${location.search}` } });
                };
                return (
                  <>
                    <div className="dash-tmenu__group">Versicherung</div>
                    <ToolbarMenuItem
                      icon={ShieldCheck}
                      tone="insurance"
                      title="Versicherungs-Lead"
                      description="PKV, bAV oder BU – qualifizierter Kontakt"
                      onSelect={() => open('/dashboard/leads/new')}
                    />
                    <div className="dash-tmenu__group">Energie</div>
                    <ToolbarMenuItem
                      icon={SunMedium}
                      tone="energy"
                      title="Energie-Lead"
                      description="Photovoltaik oder Wärmepumpe"
                      onSelect={() => open('/dashboard/leads/energy/new')}
                    />
                  </>
                );
              }}
            </ToolbarMenu>
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
                ...STATUS_OPTIONS
                  .filter((option) => option.id !== 'erledigt')
                  .map((option) => ({ id: option.id, label: option.label })),
                { id: 'all', label: 'Alle' },
              ]}
            />
            {termine ? (
              <DashSeg
                value={appointmentTiming}
                onChange={setAppointmentTiming}
                options={[
                  { id: 'upcoming', label: 'Anstehend', count: appointmentGroups.upcoming.length },
                  { id: 'expired', label: 'Verstrichen', count: appointmentGroups.expired.length },
                ]}
              />
            ) : null}
          </div>
        ) : null}
        {termine && appointmentTiming === 'expired' && appointmentGroups.expired.length ? (
          <div className="dash-alert dash-appt-expired-note">
            Diese Termine liegen in der Vergangenheit und können nicht mehr an Berater gesendet werden.
            Öffnen Sie einen Termin und tragen Sie ein neues Datum ein, um ihn wieder zu versenden.
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
              {!termine ? (
                <>
                  <label>
                    Bereich
                    <select
                      value={vertical}
                      onChange={(event) => {
                        const nextVertical = event.target.value;
                        const keepAssigned = !assignedTo
                          || assignedTo === 'unassigned'
                          || (admin?.directory || []).some((user) => (
                            user.id === assignedTo
                            && (!nextVertical || verticalOrInsurance(user.vertical) === nextVertical)
                          ));
                        const nextAssigned = keepAssigned ? assignedTo : '';
                        setVertical(nextVertical);
                        setAssignedTo(nextAssigned);
                        load({ vertical: nextVertical, assignedTo: nextAssigned });
                      }}
                    >
                      <option value="">Alle Bereiche</option>
                      <option value="insurance">Versicherung</option>
                      <option value="energy">Energie</option>
                    </select>
                  </label>
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
                </>
              ) : null}
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
        ) : visibleLeads.length ? (
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
              total={visibleLeads.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <div className="dash-empty">
            <p>
              {!termine
                ? 'Noch keine Leads. Legen Sie einen an oder importieren Sie eine CSV-Datei.'
                : appointmentTiming === 'expired'
                  ? 'Keine verstrichenen Termine.'
                  : 'Keine anstehenden Termine. Legen Sie einen neuen Termin an.'}
            </p>
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
  const { refresh } = useDashboard();
  const backTo = returnTo(location);
  const isNew = !id || id === 'new';
  const [form, setForm] = useState(emptyLeadForm);
  const [lead, setLead] = useState(null);
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
        if (payload.lead?.vertical === 'energy') {
          active = false;
          navigate(`/dashboard/leads/energy/${payload.lead.id}`, { replace: true, state: location.state });
          return;
        }
        setLead(payload.lead);
        setForm(leadToForm(payload.lead));
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
    if (isLeadDeliveryLocked(lead)) {
      setError('Zugestellte Leads können nicht bearbeitet werden.');
      return;
    }
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
    if (!isNew && isLeadDeliveryLocked(lead)) {
      setError('Zugestellte Leads können nicht bearbeitet werden.');
      setEditing(false);
      return;
    }
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
      setEditing(false);
      setNotice('Lead gespeichert.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (isLeadDeliveryLocked(lead)) {
      setError('Zugestellte Leads können nicht gelöscht werden.');
      return;
    }
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

  const deliveryLocked = !isNew && isLeadDeliveryLocked(lead);

  return (
    <div className="dash-stack">
      <Link className="dash-back" to={backTo}>
        <ArrowLeft size={16} />
        {returnLabel(backTo)}
      </Link>

      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      {loading ? (
        <div className="dash-empty"><p>Laden…</p></div>
      ) : !isNew && lead && (!editing || deliveryLocked) ? (
        <LeadView
          lead={lead}
          onEdit={startEdit}
          onDelete={onDelete}
          onAssigned={(next) => {
            if (!next) return;
            setLead(next);
            setForm(leadToForm(next));
            setNotice('Lead wurde dem Berater zugewiesen.');
            setError('');
            refresh({ silent: true }).catch(() => {});
          }}
          saving={saving}
        />
      ) : (
        <InsuranceLeadForm
          form={form}
          setForm={setForm}
          isNew={isNew}
          saving={saving}
          onSubmit={onSave}
          onCancel={isNew ? () => navigate(backTo) : cancelEdit}
        />
      )}
    </div>
  );
}
