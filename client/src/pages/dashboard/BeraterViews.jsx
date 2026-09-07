import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock, Eye, EyeOff, FileCheck2, FileText, Flag, Globe, KeyRound, LayoutGrid, List, Mail, MapPin, MessageCircle, Paperclip, Phone, Save, Shield, Sparkles, StickyNote, User, UserPlus, Users, Wand2, X } from 'lucide-react';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import AddressMap from '../../components/AddressMap';
import BootScreen from '../../components/BootScreen';
import PhoneField, { isValidMobile } from '../../components/PhoneField';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import { didGoogleMapsAuthFail, geocodeAddress, hasGoogleMapsKey, isInGermany, reverseGeocode } from '../../lib/googleMaps';
import {
  fetchMyRequests,
} from '../../lib/berater';
import {
  COMPLAINT_COMMENT_MIN,
  COMPLAINT_REASON_OPTIONS,
  canAmendComplaint,
  complaintReasonLabel,
  complaintStatusLabel,
  contactStatusLabel,
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
  INSURANCE_OPTIONS,
  leadBriefing,
  listLabels,
  updateLead,
} from '../../lib/leads';
import { LEGAL_FORMS, fileToAvatarDataUrl, generatePassword, validatePassword } from '../../lib/profile';
import { accountSetupGaps, displayName, firstName, formatDate, formatDateTime, formatEuroExact, initials } from './helpers';
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
  contactUpdatePayload,
  shortLeadId,
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

function leadInitials(lead) {
  const first = String(lead?.firstName || '').trim();
  const last = String(lead?.lastName || '').trim();
  if (first || last) return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'L';
  const name = String(lead?.fullName || lead?.name || '').trim();
  if (!name) return 'L';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'L';
}

function leadCoverageShort(lead) {
  const circle = Array.isArray(lead?.coverageCircle) ? lead.coverageCircle : [];
  if (circle.includes('familie')) return 'Familie';
  if (circle.includes('kinder')) return 'Kinder';
  if (circle.includes('partner')) return 'Partner';
  if (circle.includes('allein')) return 'Allein';
  return '';
}

function leadProductShort(lead) {
  const insurance = Array.isArray(lead?.insuranceStatus) ? lead.insuranceStatus : [];
  if (insurance.includes('zusatz') && !insurance.includes('pkv_voll')) return 'Zusatz';
  return lead.productCode || leadProductCode(lead);
}

function leadPreviewLine(lead) {
  const brief = leadBriefing(lead);
  return [leadProductShort(lead), brief.age, leadCoverageShort(lead)]
    .filter(Boolean)
    .join(' • ');
}

function leadScheduleOf(lead) {
  const status = lead?.status || lead?.contactStatus;
  if (status === 'termin' && lead?.appointmentAt) {
    return {
      kind: 'termin',
      at: lead.appointmentAt,
      label: formatScheduleLabel(lead.appointmentAt),
      overdue: false,
    };
  }
  if (status === 'wiedervorlage' && lead?.followUpAt) {
    return {
      kind: 'wiedervorlage',
      at: lead.followUpAt,
      label: formatScheduleLabel(lead.followUpAt),
      overdue: new Date(lead.followUpAt).getTime() < Date.now(),
    };
  }
  return null;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function splitDateTimeLocal(value) {
  if (!value) return { date: '', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return { date: toDateKey(date), time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}` };
}

function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const next = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
  if (Number.isNaN(next.getTime())) return '';
  return next.toISOString();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isPastDateTime(dateStr, timeStr) {
  const iso = combineDateAndTime(dateStr, timeStr);
  if (!iso) return true;
  return new Date(iso).getTime() <= Date.now() - 30_000;
}

function defaultTimeForDate(dateKey) {
  const now = new Date();
  if (dateKey !== toDateKey(now)) return '09:00';
  const next = new Date(now.getTime() + 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  if (toDateKey(next) !== dateKey) {
    return `${pad2(Math.min(23, now.getHours()))}:${pad2(Math.min(59, now.getMinutes() + 5))}`;
  }
  return `${pad2(next.getHours())}:00`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function schedulePresets() {
  const now = new Date();
  const atNine = (date) => {
    const next = new Date(date);
    next.setHours(9, 0, 0, 0);
    return next;
  };
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  inHour.setSeconds(0, 0);
  inHour.setMilliseconds(0);
  return [
    { id: 'hour', label: 'In 1 Stunde', at: inHour },
    { id: 'tomorrow', label: 'Morgen 09:00 Uhr', at: atNine(addDays(now, 1)) },
    { id: 'three', label: 'In 3 Tagen 09:00 Uhr', at: atNine(addDays(now, 3)) },
    { id: 'week', label: 'Nächste Woche 09:00 Uhr', at: atNine(addDays(now, 7)) },
  ];
}

function formatScheduleLabel(value) {
  if (!value) return '';
  const text = formatDateTime(value).replace(',', ' · ');
  return /uhr/i.test(text) ? text : `${text} Uhr`;
}

const TIME_HOURS = Array.from({ length: 24 }, (_, index) => pad2(index));
const TIME_MINUTES = ['00', '15', '30', '45'];

function GermanTimeSelect({ id, value, disabled, onChange }) {
  const [rawHour = '09', rawMinute = '00'] = String(value || '09:00').split(':');
  const hour = pad2(Number.parseInt(rawHour, 10) || 0);
  const minute = pad2(Number.parseInt(rawMinute, 10) || 0);
  const minutes = TIME_MINUTES.includes(minute) ? TIME_MINUTES : [...TIME_MINUTES, minute].sort();

  function emit(nextHour, nextMinute) {
    onChange(`${nextHour}:${nextMinute}`);
  }

  return (
    <div className="broker-calendar-time-de" role="group" aria-labelledby={id}>
      <select
        id={id}
        aria-label="Stunde"
        value={hour}
        disabled={disabled}
        onChange={(event) => emit(event.target.value, minute)}
      >
        {TIME_HOURS.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <span className="broker-calendar-time-de__sep" aria-hidden="true">:</span>
      <select
        aria-label="Minute"
        value={minute}
        disabled={disabled}
        onChange={(event) => emit(hour, event.target.value)}
      >
        {minutes.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <span className="broker-calendar-time-de__unit">Uhr</span>
    </div>
  );
}

function monthCells(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
}

function LeadSchedulePicker({ kind, value, saving, locked, onSave, variant = 'sidebar' }) {
  const saved = splitDateTimeLocal(value);
  const [cursor, setCursor] = useState(() => {
    const base = saved.date || toDateKey(new Date());
    const [year, month] = base.split('-').map(Number);
    return { year, month: month - 1 };
  });
  const [date, setDate] = useState(saved.date);
  const [time, setTime] = useState(saved.time || '09:00');

  useEffect(() => {
    const next = splitDateTimeLocal(value);
    setDate(next.date);
    setTime(next.time || '09:00');
    if (next.date) {
      const [year, month] = next.date.split('-').map(Number);
      setCursor({ year, month: month - 1 });
    }
  }, [value, kind]);

  const todayKey = toDateKey(new Date());
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });
  const iso = combineDateAndTime(date, time);
  const past = date && time ? isPastDateTime(date, time) : false;
  const canSave = Boolean(date && time && iso && !past && !saving && !locked);
  const isTermin = kind === 'termin';
  const Icon = isTermin ? CalendarClock : Clock;
  const savedLabel = formatScheduleLabel(value);
  const isModal = variant === 'modal';

  function selectDay(day) {
    if (!day) return;
    const key = `${cursor.year}-${pad2(cursor.month + 1)}-${pad2(day)}`;
    if (startOfDay(new Date(cursor.year, cursor.month, day)) < startOfDay(new Date())) return;
    setDate(key);
    if (!time || (key === todayKey && isPastDateTime(key, time))) {
      setTime(defaultTimeForDate(key));
    }
  }

  function applyPreset(at) {
    setDate(toDateKey(at));
    setTime(`${pad2(at.getHours())}:${pad2(at.getMinutes())}`);
    setCursor({ year: at.getFullYear(), month: at.getMonth() });
  }

  const fields = (
    <>
      {savedLabel ? (
        <p className="broker-calendar-saved">
          <Check size={16} aria-hidden="true" />
          {isTermin ? 'Termin' : 'Wiedervorlage'} am {savedLabel}
        </p>
      ) : null}

      <div className="broker-calendar-presets">
        {schedulePresets().map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="broker-calendar-preset"
            disabled={locked}
            onClick={() => applyPreset(preset.at)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="broker-calendar">
        <div className="broker-calendar-nav">
          <button
            type="button"
            className="broker-calendar-nav-btn"
            aria-label="Voriger Monat"
            disabled={locked}
            onClick={() => setCursor((current) => (
              current.month === 0
                ? { year: current.year - 1, month: 11 }
                : { year: current.year, month: current.month - 1 }
            ))}
          >
            <ChevronLeft size={16} />
          </button>
          <strong>{monthLabel}</strong>
          <button
            type="button"
            className="broker-calendar-nav-btn"
            aria-label="Nächster Monat"
            disabled={locked}
            onClick={() => setCursor((current) => (
              current.month === 11
                ? { year: current.year + 1, month: 0 }
                : { year: current.year, month: current.month + 1 }
            ))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="broker-calendar-weekdays">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="broker-calendar-grid">
          {monthCells(cursor.year, cursor.month).map((day, index) => {
            if (!day) {
              return <span key={`empty-${index}`} className="broker-calendar-day is-empty" />;
            }
            const key = `${cursor.year}-${pad2(cursor.month + 1)}-${pad2(day)}`;
            const pastDay = startOfDay(new Date(cursor.year, cursor.month, day)) < startOfDay(new Date());
            return (
              <button
                key={key}
                type="button"
                className={[
                  'broker-calendar-day',
                  pastDay ? 'is-past' : '',
                  key === todayKey ? 'is-today' : '',
                  key === date ? 'is-selected' : '',
                ].filter(Boolean).join(' ')}
                disabled={pastDay || locked}
                onClick={() => selectDay(day)}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="broker-calendar-time">
        <label htmlFor={`lead-schedule-time-${kind}`}>
          <Clock size={14} aria-hidden="true" />
          Uhrzeit
        </label>
        <GermanTimeSelect
          id={`lead-schedule-time-${kind}`}
          value={time}
          disabled={locked}
          onChange={setTime}
        />
      </div>
      {past ? (
        <p className="broker-calendar-hint">Bitte eine Uhrzeit in der Zukunft wählen.</p>
      ) : !date ? (
        <p className="broker-calendar-hint">Bitte zuerst ein Datum wählen.</p>
      ) : null}

      <button
        type="button"
        className="btn btn-primary broker-calendar-save"
        disabled={!canSave}
        onClick={() => onSave(iso)}
      >
        <Save size={16} aria-hidden="true" />
        {saving ? 'Wird gespeichert…' : isTermin ? 'Termin speichern' : 'Wiedervorlage speichern'}
      </button>
    </>
  );

  if (isModal) {
    return <div className="broker-schedule-modal__picker">{fields}</div>;
  }

  return (
    <div className={`broker-detail-side-block broker-detail-wiedervorlage${value ? ' is-active' : ''}`}>
      <div className="broker-detail-wiedervorlage-head">
        <span className="broker-detail-wiedervorlage-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h3>{isTermin ? 'Termin legen' : 'Wiedervorlage legen'}</h3>
          <p>
            {isTermin
              ? 'Datum und Uhrzeit für das Gespräch mit dem Kunden.'
              : 'Datum und Uhrzeit, wann Sie den Lead wieder anrufen. Sie erhalten dann eine E-Mail.'}
          </p>
        </div>
      </div>
      {fields}
    </div>
  );
}

function LeadScheduleSummary({ kind = 'wiedervorlage', value, locked, onEdit }) {
  const isTermin = kind === 'termin';
  const Icon = isTermin ? CalendarClock : Clock;
  const label = formatScheduleLabel(value);
  return (
    <div className={`broker-detail-side-block broker-detail-schedule-summary${value ? ' is-active' : ''}`}>
      <div className="broker-detail-wiedervorlage-head">
        <span className="broker-detail-wiedervorlage-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h3>{isTermin ? 'Termin' : 'Wiedervorlage'}</h3>
          <p>{label ? `Am ${label}` : 'Noch kein Zeitpunkt gewählt'}</p>
        </div>
      </div>
      <button type="button" className="btn btn-outline broker-calendar-save" disabled={locked} onClick={onEdit}>
        {label ? 'Ändern' : 'Zeitpunkt wählen'}
      </button>
    </div>
  );
}

function LeadScheduleModal({ kind, value, saving, locked, leadName, onSave, onClose }) {
  const isTermin = kind === 'termin';
  const titleId = 'lead-schedule-modal-title';

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  return (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={saving ? undefined : onClose} />
      <div className="broker-modal__panel broker-schedule-modal">
        <div className="broker-modal__top">
          <h2 id={titleId}>{isTermin ? 'Termin legen' : 'Wiedervorlage legen'}</h2>
          <button type="button" className="broker-modal__close" aria-label="Schließen" disabled={saving} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="broker-schedule-modal__lede">
          {leadName ? `${leadName} · ` : ''}
          {isTermin
            ? 'Datum und Uhrzeit für das Gespräch mit dem Kunden.'
            : 'Wann Sie den Lead wieder anrufen. Sie erhalten dann eine E-Mail.'}
        </p>
        <LeadSchedulePicker
          kind={kind}
          value={value}
          saving={saving}
          locked={locked}
          variant="modal"
          onSave={onSave}
        />
      </div>
    </div>
  );
}

function inProgressHint(stats) {
  const bits = [
    stats.kontaktiert ? `${stats.kontaktiert} In Kontakt` : '',
    stats.termin ? `${stats.termin} ${stats.termin === 1 ? 'Termin' : 'Termine'}` : '',
    stats.wiedervorlage ? `${stats.wiedervorlage} Wiedervorlage` : '',
  ].filter(Boolean);
  return bits.join(' · ') || 'Noch ohne Fortschritt';
}

const PIPELINE_ICONS = {
  neu: Sparkles,
  kontaktiert: Phone,
  termin: CalendarClock,
  wiedervorlage: Clock,
  abgeschlossen: CircleCheck,
};

function complaintTone(status) {
  if (status === 'approved' || status === 'refunded') return 'gutgeschrieben';
  if (status === 'partial' || status === 'teilweise') return 'teilweise';
  if (status === 'declined' || status === 'rejected') return 'abgelehnt';
  if (status === 'info_needed' || status === 'infos_noetig') return 'infos_noetig';
  return 'in_pruefung';
}

function ComplaintStatusIcon({ status, size = 18 }) {
  if (status === 'approved' || status === 'refunded' || status === 'partial') return <Check size={size} />;
  if (status === 'declined' || status === 'rejected') return <X size={size} />;
  if (status === 'info_needed' || status === 'infos_noetig') return <MessageCircle size={size} />;
  return <Flag size={size} />;
}

function LeadStatusMark({ lead, large = false, placement = 'list' }) {
  const reviewing = isOpenComplaint(lead?.complaint);
  const Icon = PIPELINE_ICONS[lead.status] || Sparkles;
  const compact = placement === 'home';
  const reviewMark = reviewing ? (
    <span className={`broker-status is-reported${large ? ' broker-status--lg' : ''}${compact ? ' is-compact' : ''}`}>
      <Flag size={compact ? 11 : large ? 14 : 12} aria-hidden="true" />
      {compact ? 'Prüfung' : 'In Prüfung'}
    </span>
  ) : null;

  return (
    <span className={`broker-status-stack${large ? ' is-large' : ''}${placement === 'kanban' ? ' is-kanban' : ''}${compact ? ' is-home' : ''}`}>
      {placement === 'kanban' ? null : (
        <span className={`broker-status-iconic${large ? ' is-large' : ''}`}>
          <Icon size={large ? 15 : 14} aria-hidden="true" />
          {statusLabel(lead.status)}
        </span>
      )}
      {reviewMark}
    </span>
  );
}

function DetailFact({ label, children, wide = false }) {
  const empty = children == null || children === '' || children === '—';
  return (
    <div className={`broker-detail-fact${wide ? ' is-wide' : ''}${empty ? ' is-empty' : ''}`}>
      <span>{label}</span>
      <strong>{empty ? 'Nicht hinterlegt' : children}</strong>
    </div>
  );
}

const PROOF_MAX_BYTES = 1_200_000;

function readProofFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const okType = /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/i.test(file.type);
    if (!okType) {
      reject(new Error('Nachweis bitte als PDF oder Bild (JPG, PNG, WebP) hochladen.'));
      return;
    }
    if (file.size > PROOF_MAX_BYTES) {
      reject(new Error('Der Nachweis ist zu groß. Maximal 1,2 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: String(reader.result || '') });
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

function ComplaintFacts({ lead, notes, contactStatus }) {
  const brief = leadBriefing(lead);
  const employment = lead?.employmentStatus === 'sonstiges' && lead?.employmentOther
    ? lead.employmentOther
    : employmentLabel(lead?.employmentStatus);
  const talk = [
    lead?.phone,
    lead?.email,
    employment,
    brief.insurance,
  ].filter((value) => value && value !== '—').join(' · ') || 'Keine Gesprächsdaten hinterlegt';
  const brokerNotes = String(notes || lead?.brokerNotes || '').trim();
  const stockNotes = String(lead?.notes || '').trim();

  return (
    <dl className="broker-report-facts">
      <div>
        <dt>Lead-ID</dt>
        <dd title={lead?.id || ''}>{shortLeadId(lead?.id)}</dd>
      </div>
      <div>
        <dt>Übergabezeitpunkt</dt>
        <dd>{formatDateTime(lead?.assignedAt)}</dd>
      </div>
      <div>
        <dt>Kaufpreis</dt>
        <dd>{formatEuroExact(leadPriceCents(lead))}</dd>
      </div>
      <div>
        <dt>Kontaktversuche</dt>
        <dd>{contactStatusLabel(contactStatus)}</dd>
      </div>
      <div className="is-wide">
        <dt>Gesprächsdaten</dt>
        <dd>{talk}</dd>
      </div>
      <div className="is-wide">
        <dt>Vorhandene Notizen</dt>
        <dd>
          {brokerNotes || stockNotes || 'Keine Notizen'}
          {brokerNotes && stockNotes && brokerNotes !== stockNotes ? (
            <small>Bestand: {stockNotes}</small>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}

function LeadReportPanel({ lead, notes, contactStatus, onReported }) {
  const complaint = lead?.complaint;
  const openComplaint = isOpenComplaint(complaint);
  const canAmend = canAmendComplaint(complaint);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [proof, setProof] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);
  const detailRef = useRef(null);

  function closeModal() {
    setOpen(false);
    setStep(1);
    setError('');
    setComment('');
    setReason('');
    setProof(null);
  }

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, saving]);

  useEffect(() => {
    if (open && step === 2) {
      detailRef.current?.focus();
    }
  }, [open, step]);

  async function handleProof(file) {
    setError('');
    try {
      setProof(await readProofFile(file));
    } catch (err) {
      setProof(null);
      setError(err.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (step === 1) {
      if (!reason) {
        setError('Bitte einen akzeptierten Stornierungsgrund wählen.');
        return;
      }
      setStep(2);
      return;
    }
    const detail = comment.trim();
    if (!reason) {
      setStep(1);
      setError('Bitte einen akzeptierten Stornierungsgrund wählen.');
      return;
    }
    if (detail.length < COMPLAINT_COMMENT_MIN) {
      setError(`Bitte die Begründung mit mindestens ${COMPLAINT_COMMENT_MIN} Zeichen beschreiben.`);
      return;
    }
    setSaving(true);
    try {
      await reportLead(lead.id, {
        reason,
        comment: detail,
        proofName: proof?.name,
        proofData: proof?.data,
        contactStatus,
        notes,
      });
      closeModal();
      onReported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const modal = open ? (
    <ReportModal
      lead={lead}
      notes={notes}
      contactStatus={contactStatus}
      step={step}
      setStep={setStep}
      reason={reason}
      setReason={setReason}
      comment={comment}
      setComment={setComment}
      proof={proof}
      onProof={handleProof}
      error={error}
      saving={saving}
      onClose={closeModal}
      onSubmit={handleSubmit}
      panelRef={panelRef}
      detailRef={detailRef}
    />
  ) : null;

  if (complaint) {
    return (
      <div className="broker-detail-side-block broker-detail-report-block is-submitted">
        <div className={`broker-detail-report-done broker-detail-report-done--${complaintTone(complaint.status)}`}>
          <span className="broker-detail-report-done-icon" aria-hidden="true">
            <ComplaintStatusIcon status={complaint.status} size={16} />
          </span>
          <div className="broker-detail-report-done-body">
            <strong>{complaintStatusLabel(complaint.status)}</strong>
            <span>{complaintReasonLabel(complaint.reason)}</span>
            {complaint.refundCents != null ? (
              <span>Gutschrift: {formatEuroExact(complaint.refundCents)}</span>
            ) : null}
            {complaint.comment ? <em>Reklamation: {complaint.comment}</em> : null}
            {complaint.adminNote ? (
              <p className="broker-detail-report-done-reply">
                <b>Antwort VANTARO</b>
                {complaint.adminNote}
              </p>
            ) : null}
            <small>{formatDate(complaint.createdAt)}</small>
          </div>
        </div>
        {canAmend ? (
          <button type="button" className="broker-detail-report-again" onClick={() => setOpen(true)}>
            {complaint.status === 'info_needed' || complaint.status === 'infos_noetig'
              ? 'Angaben ergänzen'
              : 'Erneut reklamieren'}
          </button>
        ) : openComplaint ? (
          <p className="broker-muted-note">VANTARO prüft den Fall. Sie sehen das Ergebnis hier.</p>
        ) : complaint.status === 'approved' || complaint.status === 'partial' || complaint.status === 'refunded' ? (
          <p className="broker-muted-note">Die Gutschrift wird dem VANTARO-Guthaben wieder gutgeschrieben.</p>
        ) : null}
        {modal}
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
            <strong>Reklamation einreichen</strong>
            <small>Standardgrund, Begründung und optional Nachweis</small>
          </span>
          <ChevronRight size={16} className="broker-report-trigger-caret" aria-hidden="true" />
        </button>
      </div>
      {modal}
    </>
  );
}

function ReportModal({
  lead,
  notes,
  contactStatus,
  step,
  setStep,
  reason,
  setReason,
  comment,
  setComment,
  proof,
  onProof,
  error,
  saving,
  onClose,
  onSubmit,
  panelRef,
  detailRef,
}) {
  const selectedReason = COMPLAINT_REASON_OPTIONS.find((option) => option.id === reason);
  const detailLen = comment.trim().length;
  const canContinue = Boolean(reason);
  const canSubmit = Boolean(reason && detailLen >= COMPLAINT_COMMENT_MIN);
  const titleId = `report-modal-title-${lead.id}`;
  const proofId = `report-proof-${lead.id}`;

  return (
    <div className="broker-modal broker-report-modal-wrap" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={saving ? undefined : onClose} disabled={saving} />
      <form
        ref={panelRef}
        className={`broker-modal__panel broker-report-modal${step === 2 ? ' is-step-2' : ''}`}
        onSubmit={onSubmit}
      >
        <div className="broker-report-modal__head">
          <div className="broker-report-modal__intro">
            <span className="broker-report-modal__badge">Reklamation</span>
            <h2 id={titleId}>Reklamation einreichen</h2>
            {lead.fullName ? <p className="broker-report-modal__lead">{lead.fullName}</p> : null}
            <p className="broker-report-modal__hint">
              Nur bei akzeptierten Stornierungsgründen. VANTARO prüft den Fall und entscheidet über die Gutschrift.
            </p>
            <div className="broker-report-progress" aria-label={`Schritt ${step} von 2`}>
              <span className={step === 1 ? 'is-current' : 'is-done'}>
                <span>1</span>
                Grund
              </span>
              <span aria-hidden="true" className={`broker-report-progress__rail${step > 1 ? ' is-done' : ''}`} />
              <span className={step === 2 ? 'is-current' : undefined}>
                <span>2</span>
                Angaben
              </span>
            </div>
          </div>
          <button type="button" className="broker-report-close" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="broker-report-modal__body">
          {error ? <div className="broker-alert">{error}</div> : null}

          {step === 1 ? (
            <section className="broker-report-step">
              <div className="broker-report-step__copy">
                <h3>Grund wählen</h3>
                <p>Akzeptierte Stornierungsgründe laut Vantaro-Richtlinie</p>
              </div>
              <div className="broker-report-reasons" role="radiogroup" aria-label="Grund der Reklamation">
                {COMPLAINT_REASON_OPTIONS.map((option) => {
                  const selected = reason === option.id;
                  return (
                    <label
                      key={option.id}
                      className={selected ? 'is-selected' : undefined}
                      onDoubleClick={() => {
                        setReason(option.id);
                        setStep(2);
                      }}
                    >
                      <input
                        type="radio"
                        className="broker-report-reason-input"
                        name={`report-grund-${lead.id}`}
                        value={option.id}
                        checked={selected}
                        disabled={saving}
                        onChange={() => setReason(option.id)}
                      />
                      <span className="broker-report-reason-card">
                        <span className="broker-report-reason-check" aria-hidden="true">
                          {selected ? <Check size={14} strokeWidth={2.5} /> : null}
                        </span>
                        <span className="broker-report-reason-copy">
                          <strong>{option.label}</strong>
                          <small>{option.hint}</small>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="broker-report-step">
              <div className="broker-report-step__copy">
                <h3>Angaben zur Reklamation</h3>
                <p>Diese Lead-Daten werden automatisch mitgeschickt. Ergänzen Sie eine kurze Begründung.</p>
              </div>
              {selectedReason ? (
                <button
                  type="button"
                  className="broker-report-chosen"
                  onClick={() => setStep(1)}
                  disabled={saving}
                >
                  <span>
                    <small>Gewählter Grund</small>
                    <strong>{selectedReason.label}</strong>
                  </span>
                  <em>Ändern</em>
                </button>
              ) : null}

              <ComplaintFacts lead={lead} notes={notes} contactStatus={contactStatus} />

              <label className="broker-report-detail-field" htmlFor={`report-detail-${lead.id}`}>
                <span>Kurze Begründung</span>
                <textarea
                  ref={detailRef}
                  id={`report-detail-${lead.id}`}
                  className="broker-report-detail"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={selectedReason?.placeholder || 'Beschreiben Sie den Mangel möglichst konkret…'}
                  rows={5}
                  disabled={saving}
                  required
                />
                <span className={`broker-report-detail-meta${detailLen < COMPLAINT_COMMENT_MIN ? ' is-short' : ' is-ok'}`}>
                  <strong>{detailLen}</strong>
                  <span>/</span>
                  <span>{COMPLAINT_COMMENT_MIN}</span>
                  <em>Zeichen min.</em>
                </span>
              </label>

              <div className="broker-report-proof">
                <span className="broker-report-proof__label">Nachweis (falls erforderlich)</span>
                <label className="broker-report-proof__btn" htmlFor={proofId}>
                  <Paperclip size={16} aria-hidden="true" />
                  {proof ? 'Datei ersetzen' : 'PDF oder Bild anhängen'}
                  <input
                    id={proofId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    disabled={saving}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) onProof(file);
                    }}
                  />
                </label>
                {proof ? (
                  <span className="broker-report-proof-chip">
                    <FileCheck2 size={14} aria-hidden="true" />
                    {proof.name}
                    <button type="button" onClick={() => onProof(null)} disabled={saving}>
                      Entfernen
                    </button>
                  </span>
                ) : (
                  <span className="broker-report-proof-chip">Optional · max. 1,2 MB</span>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="broker-report-modal__footer">
          <div className={`broker-report-actions${step === 2 ? ' is-split' : ''}`}>
            {step === 1 ? (
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
                Abbrechen
              </button>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)} disabled={saving}>
                Zurück
              </button>
            )}
            {step === 1 ? (
              <button type="submit" className="btn btn-primary" disabled={!canContinue || saving}>
                Weiter
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={!canSubmit || saving}>
                {saving ? 'Wird gesendet…' : 'Reklamation einreichen'}
              </button>
            )}
          </div>
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

  const recent = pipelineLeads.slice(0, 3);
  const inProgress = stats.kontaktiert + stats.termin + stats.wiedervorlage;

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Ihr Tag</div>
          <h1>Willkommen zurück, <em>{displayName(user)}</em></h1>
          <p className="lede">Schön, dass Sie da sind. Hier sehen Sie, welche Gespräche als Nächstes warten.</p>
        </div>
      </div>

      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-home-metrics broker-home-metrics--leads">
        <article className="broker-home-metric is-signal">
          <div className="broker-home-metric-body">
            <span>Im Bestand</span>
            <strong>{loading ? '—' : stats.total}</strong>
            <small>Aktive Leads</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true">
            <Users size={22} />
          </span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>Neu</span>
            <strong>{loading ? '—' : stats.neu}</strong>
            <small>Noch nicht kontaktiert</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true">
            <UserPlus size={22} />
          </span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>In Bearbeitung</span>
            <strong>{loading ? '—' : inProgress}</strong>
            <small>{loading ? '—' : inProgressHint(stats)}</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true">
            <MessageCircle size={22} />
          </span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>Abgeschlossen</span>
            <strong>{loading ? '—' : stats.abgeschlossen}</strong>
            <small>Verträge abgeschlossen</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true">
            <FileCheck2 size={22} />
          </span>
        </article>
      </div>

      <div className="broker-home-actions">
        <Link className="btn btn-primary" to="/dashboard/leads">
          Zu meinen Leads
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <section className="broker-panel broker-home-recent">
        <div className="broker-panel-header">
          <div>
            <h2>Aktuelle Leads</h2>
            <p>Die letzten Chancen in Ihrem Bestand</p>
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
            {recent.map((lead) => {
              const preview = leadPreviewLine(lead);
              const schedule = leadScheduleOf(lead);
              return (
                <li key={lead.id}>
                  <Link to={`/dashboard/leads/${lead.id}`}>
                    <span className="broker-home-lead-person">
                      <span className="broker-home-lead-avatar" aria-hidden="true">
                        {leadInitials(lead)}
                      </span>
                      <span className="broker-home-lead-copy">
                        <strong>{lead.name || 'Ohne Namen'}</strong>
                        {preview ? <small>{preview}</small> : null}
                        {schedule ? (
                          <small className={`broker-home-lead-schedule${schedule.overdue ? ' is-overdue' : ''}`}>
                            {schedule.label}
                          </small>
                        ) : null}
                      </span>
                    </span>
                    <span className={`broker-home-lead-phone${lead.phone ? '' : ' is-empty'}`}>
                      {lead.phone ? (
                        <>
                          <Phone size={15} aria-hidden="true" />
                          {lead.phone}
                        </>
                      ) : null}
                    </span>
                    <span className={`broker-home-lead-email${lead.email ? '' : ' is-empty'}`}>
                      {lead.email ? (
                        <>
                          <Mail size={15} aria-hidden="true" />
                          {lead.email}
                        </>
                      ) : null}
                    </span>
                    <LeadStatusMark lead={lead} placement="home" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Leads</strong>
            <p>Sobald wir Ihnen Chancen zuteilen, finden Sie sie hier und unter Meine Leads.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function LeadCard({ lead, onOpen, dragging = false, onDragStart, onDragEnd }) {
  const distance = formatDistance(lead.distanceKm);
  const skipClick = useRef(false);
  const schedule = leadScheduleOf(lead);
  const needsSchedule = lead.status === 'termin' || lead.status === 'wiedervorlage';

  return (
    <article
      className={`broker-panel broker-lead-card is-clickable${dragging ? ' is-dragging' : ''}`}
      role="button"
      tabIndex={0}
      draggable="true"
      onDragStart={(event) => {
        skipClick.current = true;
        event.dataTransfer.setData('text/plain', lead.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart?.(lead.id);
      }}
      onDragEnd={() => {
        onDragEnd?.();
        window.setTimeout(() => {
          skipClick.current = false;
        }, 0);
      }}
      onClick={() => {
        if (skipClick.current) {
          skipClick.current = false;
          return;
        }
        onOpen(lead.id);
      }}
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
        <LeadStatusMark lead={lead} placement="kanban" />
      </div>
      <div className="broker-lead-meta">
        {distance ? <span>{distance} entfernt</span> : null}
        <span>{lead.productCode || leadProductCode(lead)}</span>
        <span>{lead.quality || 'Exklusiv'}</span>
      </div>
      {schedule ? (
        <div className={`broker-lead-schedule${schedule.overdue ? ' is-overdue' : ''}`}>
          {schedule.kind === 'termin' ? <CalendarClock size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
          {schedule.label}
        </div>
      ) : needsSchedule ? (
        <div className="broker-lead-schedule is-missing">Datum und Uhrzeit wählen</div>
      ) : null}
      {lead.notes ? <p className="broker-lead-note">{lead.notes}</p> : null}
      <div className="broker-lead-bottom">
        <div className="broker-lead-price">
          {formatEuroExact(lead.priceCents)}
          <span>bezahlt</span>
        </div>
        <span className="broker-muted-action">Ziehen oder öffnen</span>
      </div>
    </article>
  );
}

function LeadListRow({ lead, onOpen }) {
  const schedule = leadScheduleOf(lead);
  return (
    <button type="button" className="broker-list-row" onClick={() => onOpen(lead.id)}>
      <span className="broker-list-name">
        <strong>{lead.name}</strong>
        <small>{lead.address}</small>
        {schedule ? (
          <small className={`broker-lead-schedule${schedule.overdue ? ' is-overdue' : ''}`}>
            {schedule.label}
          </small>
        ) : null}
      </span>
      <span className="broker-list-meta">{lead.productCode || leadProductCode(lead)}</span>
      <span className="broker-list-meta">{lead.quality}</span>
      <LeadStatusMark lead={lead} />
      <span className="broker-list-price">{formatEuroExact(lead.priceCents)}</span>
    </button>
  );
}

function KanbanColumn({
  column,
  items,
  dropStatus,
  draggingId,
  onOpen,
  onDrop,
  onDragOver,
  onDragLeave,
  onDragStart,
  onDragEnd,
}) {
  const Icon = PIPELINE_ICONS[column.id] || Sparkles;
  const active = dropStatus === column.id;

  return (
    <section
      className={`broker-kanban-column${column.id === 'abgeschlossen' ? ' is-closed' : ''}${active ? ' is-drop-target' : ''}`}
      onDragOver={(event) => onDragOver(column.id, event)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(column.id, event)}
    >
      <header>
        <span className={`broker-kanban-icon broker-kanban-icon--${column.id}`} aria-hidden="true">
          <Icon size={16} />
        </span>
        <div>
          <strong>{column.label}</strong>
          <small>{column.hint}</small>
        </div>
        <span className="broker-count">{items.length}</span>
      </header>
      <div className={`broker-kanban-stack${active ? ' is-drop-target' : ''}`}>
        {items.length ? items.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onOpen={onOpen}
            dragging={draggingId === lead.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        )) : (
          <div className="broker-kanban-empty">Hierhin ziehen</div>
        )}
      </div>
    </section>
  );
}

function leadMatchesInsurance(lead, selected) {
  if (!selected.length) return true;
  const statuses = Array.isArray(lead?.insuranceStatus) ? lead.insuranceStatus : [];
  const values = statuses.length ? statuses : ['unbekannt'];
  return selected.some((id) => values.includes(id));
}

export function BeraterLeads() {
  const navigate = useNavigate();
  const { leadStatuses, setLeadStatus, showToast } = useBroker();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insurance, setInsurance] = useState([]);
  const [view, setView] = useState('kanban');
  const [page, setPage] = useState(1);
  const [draggingId, setDraggingId] = useState('');
  const [dropStatus, setDropStatus] = useState('');
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const pageSize = 8;

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

  const pipeline = useMemo(() => (
    leads
      .map((lead) => withPipeline(lead, leadStatuses))
      .filter((lead) => leadMatchesInsurance(lead, insurance))
  ), [leads, leadStatuses, insurance]);

  const visible = pipeline;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [insurance, view]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, page, pageSize]);

  const openLead = (id) => navigate(`/dashboard/leads/${id}`);

  const handleDrop = (statusId, event) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || draggingId;
    const current = leads.find((entry) => String(entry.id) === String(id));
    if (id && (statusId === 'wiedervorlage' || statusId === 'termin') && current) {
      setScheduleTarget({ lead: current, kind: statusId });
      setDraggingId('');
      setDropStatus('');
      return;
    }
    if (id && statusId) {
      setLeadStatus(id, statusId);
      updateLead(id, contactUpdatePayload(statusId, {
        followUpAt: current?.followUpAt,
        appointmentAt: current?.appointmentAt,
      }))
        .then((payload) => {
          setLeads((list) => list.map((entry) => (
            String(entry.id) === String(id)
              ? { ...entry, ...payload.lead, complaint: entry.complaint }
              : entry
          )));
        })
        .catch((err) => setError(err.message));
    }
    setDraggingId('');
    setDropStatus('');
  };

  async function saveKanbanSchedule(iso) {
    const current = scheduleTarget?.lead;
    const kind = scheduleTarget?.kind;
    if (!current || (kind !== 'wiedervorlage' && kind !== 'termin')) return;
    setSavingSchedule(true);
    setError('');
    try {
      const payload = await updateLead(current.id, contactUpdatePayload(kind, {
        followUpAt: kind === 'wiedervorlage' ? iso : null,
        appointmentAt: kind === 'termin' ? iso : null,
      }));
      setLeadStatus(current.id, kind);
      setLeads((list) => list.map((entry) => (
        String(entry.id) === String(current.id)
          ? { ...entry, ...payload.lead, complaint: entry.complaint }
          : entry
      )));
      setScheduleTarget(null);
      showToast(
        kind === 'termin'
          ? 'Termin gespeichert.'
          : 'Wiedervorlage gespeichert. Wir erinnern Sie per E-Mail.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

  function toggleInsurance(id) {
    setInsurance((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  }

  const kanbanProps = {
    dropStatus,
    draggingId,
    onOpen: openLead,
    onDrop: handleDrop,
    onDragOver: (statusId, event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropStatus(statusId);
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDropStatus('');
    },
    onDragStart: setDraggingId,
    onDragEnd: () => {
      setDraggingId('');
      setDropStatus('');
    },
  };

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Ihr Bestand</div>
          <h1>Meine <em>Leads</em></h1>
          <p className="lede">Karten in die passende Spalte ziehen — oder in der Liste öffnen.</p>
        </div>
      </div>

      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-filterbar">
        <div className="broker-ins-filter" role="group" aria-label="Versicherungsstatus">
          <span className="broker-ins-filter__label">Versicherungsstatus</span>
          <div className="broker-ins-filter__options">
            {INSURANCE_OPTIONS.map((option) => {
              const checked = insurance.includes(option.id);
              return (
                <label key={option.id} className={checked ? 'is-checked' : undefined}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleInsurance(option.id)}
                  />
                  <span className="broker-ins-filter__box" aria-hidden="true">
                    {checked ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="broker-ins-filter__text">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="broker-filterbar-end">
          <div className="broker-pills broker-pills--view" role="tablist" aria-label="Ansicht">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={view === mode.id}
                className={view === mode.id ? 'is-active' : undefined}
                onClick={() => setView(mode.id)}
                title={mode.label}
              >
                {mode.id === 'kanban' ? <LayoutGrid size={15} strokeWidth={2.1} /> : <List size={15} strokeWidth={2.1} />}
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
          <span className="broker-filter-count">
            {loading ? 'Laden…' : `${visible.length} ${visible.length === 1 ? 'Chance' : 'Chancen'}`}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="broker-panel broker-empty">
          <span className="broker-inline-loader" aria-hidden="true" />
          <strong>Leads werden geladen</strong>
          <p>Einen Moment bitte.</p>
        </div>
      ) : !visible.length ? (
        <div className="broker-panel broker-empty">
          <strong>{insurance.length ? 'Keine Leads für diesen Filter' : 'Noch keine Leads'}</strong>
          <p>
            {insurance.length
              ? 'Andere Versicherungsstatus wählen — oder alle Häkchen entfernen, um den gesamten Bestand zu sehen.'
              : 'Sobald wir Ihnen Chancen zuteilen, erscheinen sie hier.'}
          </p>
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
          {LEAD_STATUSES.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              items={visible.filter((lead) => lead.status === column.id)}
              {...kanbanProps}
            />
          ))}
        </div>
      )}
      {scheduleTarget ? (
        <LeadScheduleModal
          kind={scheduleTarget.kind}
          value={scheduleTarget.kind === 'termin' ? scheduleTarget.lead.appointmentAt : scheduleTarget.lead.followUpAt}
          saving={savingSchedule}
          locked={false}
          leadName={scheduleTarget.lead.fullName || scheduleTarget.lead.name}
          onSave={saveKanbanSchedule}
          onClose={() => {
            if (!savingSchedule) setScheduleTarget(null);
          }}
        />
      ) : null}
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
  const [draftStatus, setDraftStatus] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const savingNotesRef = useRef(false);

  async function load() {
    const payload = await fetchLead(leadId);
    setLead(payload.lead);
    setNotes(payload.lead?.brokerNotes || '');
    setDraftStatus('');
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
    if (!lead || lead.refundedAt || savingNotesRef.current) return;
    if (notes === (lead.brokerNotes || '')) return;
    savingNotesRef.current = true;
    setSaving(true);
    setError('');
    try {
      const payload = await updateLead(lead.id, { brokerNotes: notes });
      setLead((current) => ({ ...current, ...payload.lead, complaint: current?.complaint }));
      showToast('Notizen gespeichert.');
    } catch (err) {
      setError(err.message);
    } finally {
      savingNotesRef.current = false;
      setSaving(false);
    }
  }

  async function persistContact(statusId, times = {}) {
    const payload = await updateLead(lead.id, contactUpdatePayload(statusId, {
      followUpAt: times.followUpAt,
      appointmentAt: times.appointmentAt,
    }));
    setLead((current) => ({ ...current, ...payload.lead, complaint: current?.complaint }));
    setLeadStatus(lead.id, statusId);
    setDraftStatus('');
    return payload.lead;
  }

  async function handleStatusClick(statusId) {
    if (!lead || lead.refundedAt || savingSchedule) return;
    if (statusId === 'wiedervorlage' || statusId === 'termin') {
      setDraftStatus(statusId);
      setScheduleOpen(true);
      return;
    }
    setSavingSchedule(true);
    setError('');
    try {
      await persistContact(statusId);
      showToast('Status gespeichert.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function saveSchedule(iso) {
    const statusId = draftStatus || pipelineStatusOf(lead, leadStatuses);
    if (statusId !== 'termin' && statusId !== 'wiedervorlage') return;
    setSavingSchedule(true);
    setError('');
    try {
      await persistContact(statusId, {
        followUpAt: statusId === 'wiedervorlage' ? iso : null,
        appointmentAt: statusId === 'termin' ? iso : null,
      });
      setScheduleOpen(false);
      showToast(
        statusId === 'termin'
          ? 'Termin gespeichert.'
          : 'Wiedervorlage gespeichert. Wir erinnern Sie per E-Mail.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

  function closeScheduleModal() {
    if (savingSchedule) return;
    setScheduleOpen(false);
    if (lead && draftStatus && pipelineStatusOf(lead, leadStatuses) !== draftStatus) {
      setDraftStatus('');
    }
  }

  if (loading) {
    return <BootScreen caption="Lead wird geladen" />;
  }

  if (!lead) {
    return <Navigate to="/dashboard/leads" replace />;
  }

  const view = withPipeline(lead, leadStatuses);
  const status = draftStatus || view.status;
  const scheduleKind = draftStatus === 'termin' || draftStatus === 'wiedervorlage'
    ? draftStatus
    : (view.status === 'termin' || view.status === 'wiedervorlage' ? view.status : 'wiedervorlage');
  const brief = leadBriefing(lead);
  const distance = formatDistance(lead.distanceKm);
  const phoneHref = lead.phone ? `tel:${String(lead.phone).replace(/\s/g, '')}` : '';
  const notesDirty = notes !== (lead.brokerNotes || '');
  const notesLocked = Boolean(lead.refundedAt);
  const employment = lead.employmentStatus === 'sonstiges' && lead.employmentOther
    ? lead.employmentOther
    : employmentLabel(lead.employmentStatus);

  return (
    <div className="broker-page">
      <button type="button" className="broker-back" onClick={() => navigate('/dashboard/leads')}>
        <ArrowLeft size={16} />
        Zurück zu Ihren Leads
      </button>

      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-heading broker-detail-heading">
        <span className="broker-detail-avatar" aria-hidden="true">{leadInitials(lead)}</span>
        <div>
          <div className="eyebrow">Ihr Gespräch</div>
          <h1>{view.name || 'Ohne Namen'}</h1>
          <p className="lede">
            {[view.address !== '—' ? view.address : '', distance ? `${distance} entfernt` : '']
              .filter(Boolean)
              .join(' · ') || 'Keine Adresse hinterlegt'}
          </p>
        </div>
        <LeadStatusMark lead={view} large />
      </div>

      <div className="broker-detail-actions">
        {phoneHref ? (
          <a className="btn btn-primary" href={phoneHref}>
            <Phone size={16} aria-hidden="true" />
            Anrufen{lead.phone ? ` · ${lead.phone}` : ''}
          </a>
        ) : (
          <span className="broker-detail-action-missing">Keine Telefonnummer</span>
        )}
        {lead.email ? (
          <a className="btn btn-outline" href={`mailto:${lead.email}`}>
            <Mail size={16} aria-hidden="true" />
            E-Mail schreiben
          </a>
        ) : null}
      </div>

      <div className="broker-detail-grid">
        <div className="broker-detail-sections">
          <section className="broker-panel broker-detail-section">
            <div className="broker-detail-section-head">
              <span className="broker-detail-section-icon" aria-hidden="true">
                <User size={18} />
              </span>
              <div>
                <h2>Kontakt</h2>
                <p>Zum Anrufen und Schreiben</p>
              </div>
            </div>
            <div className="broker-detail-facts">
              <DetailFact label="Telefon">
                {lead.phone ? <a href={phoneHref}>{lead.phone}</a> : null}
              </DetailFact>
              <DetailFact label="E-Mail">
                {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null}
              </DetailFact>
              <DetailFact label="Adresse" wide>
                {view.address !== '—' ? view.address : null}
              </DetailFact>
              <DetailFact label="Alter">
                {brief.age || null}
              </DetailFact>
              <DetailFact label="Geburtsdatum">
                {formatLeadDate(lead.dateOfBirth) !== '—' ? formatLeadDate(lead.dateOfBirth) : null}
              </DetailFact>
              <DetailFact label="Beruf / Situation" wide>
                {employment || null}
              </DetailFact>
            </div>
          </section>

          <section className="broker-panel broker-detail-section">
            <div className="broker-detail-section-head">
              <span className="broker-detail-section-icon" aria-hidden="true">
                <Shield size={18} />
              </span>
              <div>
                <h2>Versicherung & Anliegen</h2>
                <p>Worum es im Gespräch geht</p>
              </div>
            </div>
            <div className="broker-detail-facts">
              <DetailFact label="Anliegen" wide>
                {brief.concerns || listLabels(lead.mainConcerns, 'concern')}
              </DetailFact>
              <DetailFact label="Aktuelle Gesellschaft">
                {brief.insurer}
              </DetailFact>
              <DetailFact label="Beitrag / Monat">
                {brief.premium}
              </DetailFact>
              <DetailFact label="Versicherungsstatus">
                {brief.insurance}
              </DetailFact>
              <DetailFact label="Personenkreis">
                {brief.coverage}
              </DetailFact>
              <DetailFact label="Produkt" wide>
                {view.product}
              </DetailFact>
            </div>
          </section>

          <section className="broker-panel broker-detail-section">
            <div className="broker-detail-section-head">
              <span className="broker-detail-section-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div>
                <h2>Hinweis zum Lead</h2>
                <p>Vom Bestand — vor dem Anruf lesen</p>
              </div>
            </div>
            <p className="broker-detail-note">{lead.notes || 'Kein Hinweis hinterlegt.'}</p>
          </section>
        </div>

        <aside className="broker-panel broker-detail-side">
          <div className="broker-detail-side-block">
            <div className="broker-detail-section-head">
              <span className="broker-detail-section-icon" aria-hidden="true">
                <MessageCircle size={18} />
              </span>
              <div>
                <h2>Gesprächsstatus</h2>
                <p>Tippen Sie, wo der Lead gerade steht</p>
              </div>
            </div>
            <div className="broker-status-picker">
              {LEAD_STATUSES.map((option) => {
                const Icon = PIPELINE_ICONS[option.id] || Sparkles;
                const active = status === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      active ? 'is-active' : '',
                      option.id === 'abgeschlossen' ? 'is-closed' : '',
                      option.id === 'wiedervorlage' && active ? 'is-wiedervorlage' : '',
                    ].filter(Boolean).join(' ') || undefined}
                    disabled={notesLocked || savingSchedule}
                    onClick={() => handleStatusClick(option.id)}
                  >
                    <span className={`broker-status-picker-icon broker-kanban-icon--${option.id}`} aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="broker-status-picker-copy">
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {view.status === 'termin' ? (
            <LeadScheduleSummary
              kind="termin"
              value={lead.appointmentAt}
              locked={notesLocked}
              onEdit={() => {
                setDraftStatus('termin');
                setScheduleOpen(true);
              }}
            />
          ) : null}

          {view.status === 'wiedervorlage' ? (
            <LeadScheduleSummary
              kind="wiedervorlage"
              value={lead.followUpAt}
              locked={notesLocked}
              onEdit={() => {
                setDraftStatus('wiedervorlage');
                setScheduleOpen(true);
              }}
            />
          ) : null}

          <div className="broker-detail-side-block">
            <div className="broker-detail-section-head">
              <span className="broker-detail-section-icon" aria-hidden="true">
                <StickyNote size={18} />
              </span>
              <div>
                <h2>Ihre Notizen</h2>
                <p>Zum Gespräch — nicht die Reklamation</p>
              </div>
            </div>
            <textarea
              className="broker-detail-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="z. B. Rückruf vereinbart, offene Fragen…"
              rows={5}
              disabled={saving || notesLocked}
            />
            <div className="broker-detail-notes-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveNotes}
                disabled={saving || notesLocked || !notesDirty}
              >
                <Save size={16} aria-hidden="true" />
                {saving ? 'Wird gespeichert…' : 'Notiz speichern'}
              </button>
            </div>
            <p className="broker-detail-notes-hint">
              {notesLocked
                ? 'Erstattete Leads können nicht mehr bearbeitet werden.'
                : 'Persönliche Gesprächsnotiz zu diesem Lead. Eine Reklamation senden Sie darunter extra.'}
            </p>
          </div>

          <LeadReportPanel
            lead={lead}
            notes={notes}
            contactStatus={status}
            onReported={() => {
              load().catch((err) => setError(err.message));
              showToast('Reklamation gesendet. VANTARO prüft den Fall.');
            }}
          />
        </aside>
      </div>
      {scheduleOpen ? (
        <LeadScheduleModal
          kind={scheduleKind}
          value={scheduleKind === 'termin' ? lead.appointmentAt : lead.followUpAt}
          saving={savingSchedule}
          locked={notesLocked}
          leadName={lead.fullName}
          onSave={saveSchedule}
          onClose={closeScheduleModal}
        />
      ) : null}
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
  const [checkout, setCheckout] = useState(null);
  const [card, setCard] = useState({ holder: '', number: '', expiry: '', cvc: '' });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadBilling() {
    const [leadPayload, paymentPayload] = await Promise.all([
      fetchMyLeads(),
      fetchMyPayments().catch(() => ({ payments: [] })),
    ]);
    setLeadsUsed((leadPayload.leads || []).length);
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
      setNotice(`${checkoutPkg.label} ist bezahlt. Die Anforderung ist sofort aktiv.`);
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
            Wählen Sie Ihr Paket, zahlen Sie testhalber — danach kümmert sich der Admin um die Zustellung.
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
            <p>Deutschlandweit oder regional wählen, dann mit Testdaten bezahlen. Die Anforderung ist danach sofort aktiv.</p>
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
                    disabled={paying}
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setCheckout({ packageId: pkg.id, qty });
                    }}
                  >
                    {`Weiter zur Zahlung · ${qty} Leads`}
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
        Testbetrieb ohne Bank oder Zahlungsanbieter. Nach der Zahlung ist die Anforderung
        beim Admin sofort aktiv.
      </p>
    </div>
  );
}

function useHashScroll() {
  const location = useLocation();

  useEffect(() => {
    const id = location.hash.replace('#', '');
    if (!id) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  return location.hash.replace('#', '');
}

function ProfileNav({ active }) {
  const { user } = useAuth();
  const gaps = accountSetupGaps(user);
  const countFor = (id) => gaps.filter((gap) => gap.nav === id).length;
  const hrefFor = (id, fallback) => gaps.find((gap) => gap.nav === id)?.to || fallback;
  const links = [
    { id: 'profil', to: hrefFor('profil', '/dashboard/profil'), label: 'Profil', icon: User },
    { id: 'unternehmen', to: hrefFor('unternehmen', '/dashboard/unternehmen'), label: 'Unternehmen', icon: Building2 },
    { id: 'sicherheit', to: '/dashboard/sicherheit', label: 'Sicherheit', icon: Shield },
  ];

  return (
    <nav className="broker-profile-nav" aria-label="Einstellungen">
      {links.map((link) => {
        const Icon = link.icon;
        const count = countFor(link.id);
        return (
          <Link
            key={link.id}
            to={link.to}
            className={active === link.id ? 'is-active' : undefined}
          >
            <Icon size={16} strokeWidth={2} />
            {link.label}
            {count > 0 ? (
              <span className="broker-setup-count" aria-label={`${count} Angaben fehlen`}>{count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsShell({ active, title, lede, children }) {
  return (
    <div className="broker-page broker-page--settings">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Einstellungen</div>
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
  useHashScroll();
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
      title={<>Pro<em>fil</em></>}
      lede="Bild, Name und Telefon — so erscheint Ihr Konto im Portal."
    >
      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        {error && <div className="broker-alert">{error}</div>}

        <section className="broker-settings-section" id="foto">
          <header>
            <h3>
              <span className="broker-settings-section__icon" aria-hidden="true">
                <User size={16} strokeWidth={2.2} />
              </span>
              Profilbild
            </h3>
            <p>Freiwillig — ein Foto macht Ihr Konto persönlicher.</p>
          </header>
          <div className="broker-avatar-edit">
            <div className="broker-avatar broker-avatar--xl" aria-hidden="true">
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt="" />
              ) : (
                initials({ firstName: form.firstName, lastName: form.lastName, email: user?.email })
              )}
            </div>
            <div>
              <label className="broker-file-btn" htmlFor="profile-avatar">
                <input
                  id="profile-avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatar}
                  disabled={saving}
                />
                <span>Bild auswählen</span>
                <small>{avatarName || (form.avatarUrl ? 'Aktuelles Bild behalten' : 'PNG oder JPG')}</small>
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
        </section>

        <section className="broker-settings-section" id="kontakt">
          <header>
            <h3>
              <span className="broker-settings-section__icon" aria-hidden="true">
                <Phone size={16} strokeWidth={2.2} />
              </span>
              Name & Telefon
            </h3>
            <p>Für Vertrag, Rückfragen und die Anzeige in Ihrem Konto.</p>
          </header>
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
        </section>

        <div className="broker-settings-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert⬦' : 'Profil speichern'}
          </button>
        </div>
      </form>
    </SettingsShell>
  );
}

export function BeraterCompany() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useBroker();
  const hash = useHashScroll();
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
      title={<>Unterneh<em>men</em></>}
      lede={
        user?.onboardingComplete
          ? 'Firma, Rechtsform und Adresse für Vertrag, Rechnung und Verifizierung.'
          : 'Firma und Adresse ergänzen — danach ist Ihr Konto vollständig.'
      }
    >
      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <div className="broker-settings-head">
          <div>
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
            <Link to="/dashboard/profil#kontakt" className="broker-text-btn">
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

        <section
          className={`broker-settings-section${highlightMissing && !firmDone ? ' is-incomplete' : ''}${hash === 'firma' ? ' is-focus' : ''}`}
          id="firma"
        >
          <header>
            <h3>
              {highlightMissing ? <span className="broker-step-num">1</span> : (
                <span className="broker-settings-section__icon" aria-hidden="true">
                  <Building2 size={16} strokeWidth={2.2} />
                </span>
              )}
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

        <section
          className={`broker-settings-section${highlightMissing && !addressDone ? ' is-incomplete' : ''}${hash === 'adresse' ? ' is-focus' : ''}`}
          id="adresse"
        >
          <header>
            <h3>
              {highlightMissing ? <span className="broker-step-num">2</span> : (
                <span className="broker-settings-section__icon" aria-hidden="true">
                  <MapPin size={16} strokeWidth={2.2} />
                </span>
              )}
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

        <section className="broker-settings-section" id="webseite">
          <header>
            <h3>
              <span className="broker-settings-section__icon" aria-hidden="true">
                <Globe size={16} strokeWidth={2.2} />
              </span>
              Webseite <span className="broker-optional">(freiwillig)</span>
            </h3>
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

        <div className="broker-settings-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert⬦' : 'Unternehmen speichern'}
          </button>
        </div>
      </form>
    </SettingsShell>
  );
}

export function BeraterSecurity() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <SettingsShell
      active="sicherheit"
      title={<>Sicher<em>heit</em></>}
      lede="Passwort ändern — mit aktuellem Passwort und starken Regeln."
    >
      <section className="broker-panel broker-settings broker-settings--wide">
        <section className="broker-settings-section broker-settings-section--action">
          <header>
            <h3>
              <span className="broker-settings-section__icon" aria-hidden="true">
                <KeyRound size={16} strokeWidth={2.2} />
              </span>
              Passwort
            </h3>
            <p>Mindestens 8 Zeichen, Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.</p>
          </header>
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            Passwort ändern
          </button>
        </section>
      </section>

      <ChangePasswordModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </SettingsShell>
  );
}
