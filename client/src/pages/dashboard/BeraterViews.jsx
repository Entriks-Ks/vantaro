import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Bell, Building2, Calendar as CalendarIcon, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleX, Clock, Cookie, CreditCard, Download, Eye, EyeOff, FileCheck2, FileText, Filter, Flag, Globe, GraduationCap, Handshake, KeyRound, LayoutGrid, List, Lock, Mail, MapPin, MessageCircle, Paperclip, Phone, Printer, Receipt, Save, Search, Send, Settings, Shield, ShieldCheck, Sparkles, StickyNote, User, UserPlus, Users, Wand2, X } from 'lucide-react';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import AddressMap from '../../components/AddressMap';
import BootScreen from '../../components/BootScreen';
import PhoneField, { isValidMobile } from '../../components/PhoneField';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import { didGoogleMapsAuthFail, geocodeAddress, hasGoogleMapsKey, isInGermany, reverseGeocode } from '../../lib/googleMaps';
import { readStoredSession } from '../../lib/auth';
import { apiUrl } from '../../lib/api';
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
import ThemeMode from '../../components/ThemeMode';
import { accountSetupGaps, displayName, firstName, formatDate, formatDateTime, formatEuroExact, initials } from './helpers';
import { MIN_LEAD_PACK, PACKAGES, packageById, packTotalCents } from './packages';
import { DEFAULT_LEAD_SCOPE, leadScopeLabel } from '../../lib/scopes';
import {
  checkoutLeadPackage,
  collectBrowserPaymentMeta,
  downloadPaymentInvoice,
  fetchMyPayments,
  formatCardMask,
  openPaymentInvoice,
  paymentStatusLabel,
  syncMyPayment,
} from '../../lib/payments';
import {
  readBrokerSettings,
  subscribeBrokerSettings,
  writeBrokerSettings,
} from '../../lib/brokerSettings';
import { applyConsent, CONSENT_STORAGE_KEY, DEFAULT_PREFS, readStoredConsent } from '../../lib/analytics';
import {
  CLOSE_OUTCOMES,
  LEAD_STATUSES,
  PRODUCT_FILTERS,
  VIEW_MODES,
  closeOutcomeLabel,
  closeOutcomeOf,
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

function leadScheduleOf(lead, now = Date.now()) {
  const status = lead?.status || lead?.contactStatus;
  let kind = null;
  let at = null;
  if (status === 'termin' && lead?.appointmentAt) {
    kind = 'termin';
    at = lead.appointmentAt;
  } else if (status === 'wiedervorlage' && lead?.followUpAt) {
    kind = 'wiedervorlage';
    at = lead.followUpAt;
  }
  if (!kind) return null;
  const due = new Date(at).getTime();
  return {
    kind,
    at,
    label: formatScheduleLabel(at),
    overdue: Number.isFinite(due) && due < now,
    urgency: scheduleUrgencyOf(at, now),
  };
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

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
const SCHEDULE_CLOCK_MS = 30 * 1000;

function scheduleUrgencyOf(at, now = Date.now()) {
  const due = new Date(at).getTime();
  if (!Number.isFinite(due)) return 'ok';
  const remaining = due - now;
  if (remaining <= 2 * MS_HOUR) return 'critical';
  if (remaining <= 6 * MS_HOUR) return 'urgent';
  if (remaining <= 24 * MS_HOUR) return 'soon';
  if (remaining <= 3 * MS_DAY) return 'near';
  return 'ok';
}

function formatScheduleParts(value) {
  if (!value) return { dateLabel: '', timeLabel: '', label: '' };
  const date = new Date(value);
  return {
    dateLabel: new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date),
    timeLabel: new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date),
    label: formatScheduleLabel(value),
  };
}

let scheduleClockTimer = null;
const scheduleClockListeners = new Set();

function subscribeScheduleClock(listener) {
  scheduleClockListeners.add(listener);
  if (scheduleClockTimer == null && typeof window !== 'undefined') {
    scheduleClockTimer = window.setInterval(() => {
      const now = Date.now();
      scheduleClockListeners.forEach((fn) => fn(now));
    }, SCHEDULE_CLOCK_MS);
  }
  return () => {
    scheduleClockListeners.delete(listener);
    if (!scheduleClockListeners.size && scheduleClockTimer != null) {
      window.clearInterval(scheduleClockTimer);
      scheduleClockTimer = null;
    }
  };
}

function useScheduleClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribeScheduleClock(setNow), []);
  return now;
}

function LeadScheduleBlock({ kind = 'wiedervorlage', at, compact = false }) {
  const now = useScheduleClock();
  const parts = formatScheduleParts(at);
  const urgency = scheduleUrgencyOf(at, now);
  const overdue = new Date(at).getTime() < now;
  const isTermin = kind === 'termin';
  const Icon = isTermin ? CalendarClock : Clock;

  return (
    <div
      className={`broker-lead-when is-${urgency}${overdue ? ' is-overdue' : ''}${compact ? ' is-compact' : ''}`}
      aria-label={`${isTermin ? 'Termin' : 'Wiedervorlage'} ${parts.label}`}
    >
      <Icon className="broker-lead-when-icon" size={compact ? 15 : 18} aria-hidden="true" />
      <span className="broker-lead-when-date">{parts.dateLabel}</span>
      <strong className="broker-lead-when-time">{parts.timeLabel}</strong>
    </div>
  );
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

function CloseOutcomeMark({ outcome, compact = false }) {
  if (outcome === 'erfolgreich') {
    return (
      <span className={`broker-close-outcome is-erfolgreich${compact ? ' is-compact' : ''}`}>
        <CircleCheck size={compact ? 11 : 12} aria-hidden="true" />
        Erfolgreich
      </span>
    );
  }
  if (outcome === 'fehlgeschlagen') {
    return (
      <span className={`broker-close-outcome is-fehlgeschlagen${compact ? ' is-compact' : ''}`}>
        <CircleX size={compact ? 11 : 12} aria-hidden="true" />
        Nicht erfolgreich
      </span>
    );
  }
  return (
    <span className={`broker-close-outcome is-pending${compact ? ' is-compact' : ''}`}>
      Ergebnis wählen
    </span>
  );
}

function LeadCloseOutcomeModal({ leadName, value, saving, onSave, onClose }) {
  const titleId = 'lead-close-outcome-modal-title';

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
      <div className="broker-modal__panel broker-schedule-modal broker-close-outcome-modal">
        <div className="broker-modal__top">
          <h2 id={titleId}>Vorgang abschließen</h2>
          <button type="button" className="broker-modal__close" aria-label="Schließen" disabled={saving} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="broker-schedule-modal__lede">
          {leadName ? `${leadName} · ` : ''}
          Wurde aus dem Gespräch ein Kunde, oder nicht?
        </p>
        <div className="broker-close-outcome-choices">
          {CLOSE_OUTCOMES.map((option) => {
            const Icon = option.id === 'erfolgreich' ? CircleCheck : CircleX;
            const isSelected = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`broker-close-outcome-choice is-${option.id}${isSelected ? ' is-active' : ''}`}
                disabled={saving}
                onClick={() => onSave(option.id)}
              >
                <span className="broker-close-outcome-choice-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
        {saving ? <p className="broker-calendar-hint">Wird gespeichert…</p> : null}
      </div>
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
  const outcome = closeOutcomeOf(lead);
  const showOutcome = lead.status === 'abgeschlossen';
  const reviewMark = reviewing ? (
    <span className={`broker-status is-reported${large ? ' broker-status--lg' : ''}${compact ? ' is-compact' : ''}`}>
      <Flag size={compact ? 11 : large ? 14 : 12} aria-hidden="true" />
      {compact ? 'Prüfung' : 'In Prüfung'}
    </span>
  ) : null;

  return (
    <span className={`broker-status-stack${large ? ' is-large' : ''}${placement === 'kanban' ? ' is-kanban' : ''}${compact ? ' is-home' : ''}`}>
      {placement === 'kanban' ? (
        showOutcome ? <CloseOutcomeMark outcome={outcome} compact /> : null
      ) : (
        <span className={`broker-status-iconic${large ? ' is-large' : ''}`}>
          <Icon size={large ? 15 : 14} aria-hidden="true" />
          {statusLabel(lead.status)}
        </span>
      )}
      {showOutcome && placement !== 'kanban' ? <CloseOutcomeMark outcome={outcome} compact={compact} /> : null}
      {reviewMark}
    </span>
  );
}

function LeadStatusDropdown({
  lead,
  status,
  onSelectStatus,
  disabled = false,
  saving = false,
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const reviewing = isOpenComplaint(lead?.complaint);
  const reviewMark = reviewing ? (
    <span className="broker-status is-reported broker-status--lg">
      <Flag size={14} aria-hidden="true" />
      In Prüfung
    </span>
  ) : null;
  const CurrentIcon = PIPELINE_ICONS[status] || Sparkles;
  const outcome = closeOutcomeOf(lead);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="broker-status-dropdown-wrap" ref={dropdownRef}>
      <div className="broker-status-stack is-large">
        <button
          type="button"
          className={`broker-status-trigger-btn broker-status-trigger-btn--${status}${open ? ' is-open' : ''}${saving ? ' is-saving' : ''}`}
          onClick={() => {
            if (!disabled && !saving) setOpen((prev) => !prev);
          }}
          disabled={disabled || saving}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={disabled ? 'Status nicht bearbeitbar' : 'Status ändern'}
        >
          <span className="broker-status-iconic is-large">
            <CurrentIcon size={15} aria-hidden="true" />
            <span>{statusLabel(status)}</span>
            {status === 'abgeschlossen' ? <CloseOutcomeMark outcome={outcome} compact /> : null}
          </span>
          <ChevronDown size={14} className={`broker-status-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
        </button>

        {reviewMark}
      </div>

      {open && (
        <div className="broker-status-dropdown-menu" role="listbox" aria-label="Status auswählen">
          <div className="broker-status-dropdown-menu-header">
            <strong>Gesprächsstatus</strong>
            <p>Tippen Sie, wo der Lead gerade steht</p>
          </div>
          <div className="broker-status-dropdown-menu-items">
            {LEAD_STATUSES.map((option) => {
              const Icon = PIPELINE_ICONS[option.id] || Sparkles;
              const isSelected = status === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`broker-status-dropdown-item broker-status-dropdown-item--${option.id}${isSelected ? ' is-active' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    onSelectStatus(option.id);
                  }}
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled || saving}
                >
                  <span className={`broker-status-picker-icon broker-kanban-icon--${option.id}`} aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="broker-status-dropdown-copy">
                    <strong>{option.label}</strong>
                    <small>
                      {option.id === 'abgeschlossen' && outcome
                        ? `${option.hint} · aktuell ${closeOutcomeLabel(outcome)}`
                        : option.hint}
                    </small>
                  </span>
                  {isSelected ? (
                    <Check size={16} className="broker-status-dropdown-check" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
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
const SUPPORT_ATTACH_MAX = 3;

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
  const modal = (
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

  const host = typeof document !== 'undefined' ? document.querySelector('.broker') : null;
  return host ? createPortal(modal, host) : modal;
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
    let erfolgreich = 0;
    let fehlgeschlagen = 0;
    pipelineLeads.forEach((lead) => {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      const outcome = closeOutcomeOf(lead);
      if (outcome === 'erfolgreich') erfolgreich += 1;
      else if (outcome === 'fehlgeschlagen') fehlgeschlagen += 1;
    });
    return {
      total: pipelineLeads.length,
      neu: byStatus.neu || 0,
      kontaktiert: byStatus.kontaktiert || 0,
      termin: byStatus.termin || 0,
      wiedervorlage: byStatus.wiedervorlage || 0,
      erfolgreich,
      fehlgeschlagen,
    };
  }, [pipelineLeads]);

  const recent = pipelineLeads
    .filter((lead) => closeOutcomeOf(lead) !== 'fehlgeschlagen')
    .slice(0, 3);
  const inProgress = stats.kontaktiert + stats.termin + stats.wiedervorlage;
  const pipelineTotal = Math.max(stats.total - stats.fehlgeschlagen, 1);
  const pipelineColors = {
    neu: '#56d3c4',
    kontaktiert: '#7aa2ff',
    termin: '#f0b45a',
    wiedervorlage: '#c4a0ff',
    abgeschlossen: '#9ad67a',
  };

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
            <strong>{loading ? '—' : stats.erfolgreich}</strong>
            <small>Verträge abgeschlossen</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true">
            <FileCheck2 size={22} />
          </span>
        </article>
      </div>

      <section className="broker-panel broker-home-pipeline">
        <div className="broker-panel-header">
          <div>
            <div className="eyebrow">Trichter-Übersicht</div>
            <h2>Pipeline</h2>
            <p>Echtzeit-Verteilung Ihrer Leads nach aktuellem Bearbeitungsstand</p>
          </div>
          <Link to="/dashboard/leads" className="broker-pipeline-open">
            <span>Board öffnen</span>
            <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>

        <div className="broker-pipeline-stack" aria-hidden={loading}>
          {LEAD_STATUSES.map((status) => {
            const value = status.id === 'abgeschlossen' ? stats.erfolgreich : (stats[status.id] || 0);
            const pct = loading || value <= 0 ? 0 : Math.max((value / pipelineTotal) * 100, 3);
            if (value <= 0) return null;
            return (
              <span
                key={status.id}
                className="broker-pipeline-seg"
                style={{ width: `${pct}%`, background: pipelineColors[status.id] }}
                title={`${status.label}: ${value} Leads`}
              />
            );
          })}
        </div>

        <div className="broker-pipeline-cards">
          {LEAD_STATUSES.map((status) => {
            const value = status.id === 'abgeschlossen' ? stats.erfolgreich : (stats[status.id] || 0);
            const pct = loading || pipelineTotal <= 0 ? 0 : Math.round((value / pipelineTotal) * 100);
            const Icon = PIPELINE_ICONS[status.id] || Sparkles;
            const color = pipelineColors[status.id] || '#56d3c4';
            return (
              <Link
                key={status.id}
                className="broker-pipeline-card"
                to="/dashboard/leads"
                style={{ '--stage-color': color }}
              >
                <div className="broker-pipeline-card-top">
                  <span className="broker-pipeline-card-icon" style={{ color, background: `${color}18`, borderColor: `${color}35` }}>
                    <Icon size={18} />
                  </span>
                  <span className="broker-pipeline-card-pct">{loading ? '0%' : `${pct}%`}</span>
                </div>
                <div className="broker-pipeline-card-main">
                  <strong>{loading ? '—' : value}</strong>
                  <span className="broker-pipeline-card-label">{status.label}</span>
                </div>
                <div className="broker-pipeline-card-bar" style={{ background: color, width: `${Math.min(100, Math.max(6, pct))}%` }} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="broker-panel broker-home-recent">
        <div className="broker-panel-header">
          <div>
            <h2>Aktuelle Leads</h2>
            <p>Neue Chancen in Ihrem Bestand</p>
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
      {schedule ? (
        <LeadScheduleBlock kind={schedule.kind} at={schedule.at} />
      ) : needsSchedule ? (
        <div className="broker-lead-when is-missing">Datum und Uhrzeit wählen</div>
      ) : null}
      <div className="broker-lead-meta">
        {distance ? <span>{distance} entfernt</span> : null}
        <span>{lead.productCode || leadProductCode(lead)}</span>
        <span>{lead.quality || 'Exklusiv'}</span>
      </div>
      {lead.notes ? <p className="broker-lead-note">{lead.notes}</p> : null}
      <div className="broker-lead-bottom">
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
          <LeadScheduleBlock kind={schedule.kind} at={schedule.at} compact />
        ) : null}
      </span>
      <span className="broker-list-meta">{lead.productCode || leadProductCode(lead)}</span>
      <span className="broker-list-meta">{lead.quality}</span>
      <LeadStatusMark lead={lead} />
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
  const [outcomeTarget, setOutcomeTarget] = useState(null);
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
  const nonAbgeschlossenCount = useMemo(() => (
    visible.filter((lead) => lead.status !== 'abgeschlossen' && lead.contactStatus !== 'abgeschlossen').length
  ), [visible]);
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
    if (id && statusId === 'abgeschlossen' && current) {
      const alreadyClosed = pipelineStatusOf(current, leadStatuses) === 'abgeschlossen' && closeOutcomeOf(current);
      if (alreadyClosed) {
        setDraggingId('');
        setDropStatus('');
        return;
      }
      setOutcomeTarget(current);
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

  async function saveKanbanOutcome(outcomeId) {
    const current = outcomeTarget;
    if (!current) return;
    setSavingSchedule(true);
    setError('');
    try {
      const payload = await updateLead(current.id, contactUpdatePayload('abgeschlossen', {
        closeOutcome: outcomeId,
      }));
      setLeadStatus(current.id, 'abgeschlossen');
      setLeads((list) => list.map((entry) => (
        String(entry.id) === String(current.id)
          ? { ...entry, ...payload.lead, complaint: entry.complaint }
          : entry
      )));
      setOutcomeTarget(null);
      showToast(
        outcomeId === 'erfolgreich'
          ? 'Lead als erfolgreich gespeichert.'
          : 'Lead als nicht erfolgreich gespeichert.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

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
    <div className="broker-page broker-page--wide">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Ihr Bestand</div>
          <h1>Meine Leads</h1>
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
            {loading ? 'Laden…' : `${nonAbgeschlossenCount} ${nonAbgeschlossenCount === 1 ? 'Chance' : 'Chancen'}`}
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
      {outcomeTarget ? (
        <LeadCloseOutcomeModal
          leadName={outcomeTarget.fullName || outcomeTarget.name}
          value={closeOutcomeOf(outcomeTarget)}
          saving={savingSchedule}
          onSave={saveKanbanOutcome}
          onClose={() => {
            if (!savingSchedule) setOutcomeTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

function getCalendarMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // 0=Mo, 6=So
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const cells = [];
  
  // Previous month trailing days
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateObj = new Date(year, month - 1, dayNum);
    cells.push({
      day: dayNum,
      date: dateObj,
      dateKey: toDateKey(dateObj),
      isCurrentMonth: false,
      isPrevMonth: true,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth(),
    });
  }
  
  // Current month days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dateObj = new Date(year, month, d);
    cells.push({
      day: d,
      date: dateObj,
      dateKey: toDateKey(dateObj),
      isCurrentMonth: true,
      year,
      month,
    });
  }
  
  // Next month leading days
  const minCells = cells.length > 35 ? 42 : 35;
  const needed = minCells - cells.length;
  for (let d = 1; d <= needed; d++) {
    const dateObj = new Date(year, month + 1, d);
    cells.push({
      day: d,
      date: dateObj,
      dateKey: toDateKey(dateObj),
      isCurrentMonth: false,
      isNextMonth: true,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth(),
    });
  }
  
  return cells;
}

function getWeekDays(referenceDate) {
  const date = new Date(referenceDate);
  const day = (date.getDay() + 6) % 7; // 0=Mo, 6=So
  const monday = new Date(date);
  monday.setDate(date.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      date: d,
      dateKey: toDateKey(d),
      dayName: d.toLocaleDateString('de-DE', { weekday: 'short' }),
      dayNumber: d.getDate(),
      formatted: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    });
  }
  return days;
}

function formatRelativeSchedule(isoStr) {
  if (!isoStr) return '';
  const target = new Date(isoStr);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  
  const diffDays = Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
  const timeStr = target.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';

  if (diffDays === 0) return `Heute um ${timeStr}`;
  if (diffDays === 1) return `Morgen um ${timeStr}`;
  if (diffDays === 2) return `Übermorgen um ${timeStr}`;
  if (diffDays === -1) return `Gestern um ${timeStr}`;
  if (diffDays < -1) return `Vor ${Math.abs(diffDays)} Tagen um ${timeStr}`;
  return `In ${diffDays} Tagen (${target.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}) um ${timeStr}`;
}

function calAvatarInitials(name = '') {
  const parts = String(name).trim().split(/\s+/);
  if (!parts[0]) return 'L';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function BeraterCalendar() {
  const { leadStatuses, setLeadStatus, showToast } = useBroker();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const now = new Date();
  const todayKey = toDateKey(now);
  
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'agenda'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'termin' | 'wiedervorlage' | 'overdue'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dayModalEvents, setDayModalEvents] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

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

  // Extract all appointment and follow-up events from leads
  const allEvents = useMemo(() => {
    const list = [];
    pipelineLeads.forEach((lead) => {
      if (lead.appointmentAt) {
        const at = lead.appointmentAt;
        const d = new Date(at);
        list.push({
          id: `${lead.id}-termin`,
          lead,
          kind: 'termin',
          at,
          dateKey: toDateKey(d),
          timeStr: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr',
          label: formatScheduleLabel(at),
          relative: formatRelativeSchedule(at),
          overdue: d.getTime() < Date.now(),
          leadName: lead.name || lead.fullName || 'Ohne Namen',
          phone: lead.phone || '',
          email: lead.email || '',
          product: leadProduct(lead) || lead.product || 'Versicherung',
        });
      }
      if (lead.followUpAt) {
        const at = lead.followUpAt;
        const d = new Date(at);
        list.push({
          id: `${lead.id}-wiedervorlage`,
          lead,
          kind: 'wiedervorlage',
          at,
          dateKey: toDateKey(d),
          timeStr: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr',
          label: formatScheduleLabel(at),
          relative: formatRelativeSchedule(at),
          overdue: d.getTime() < Date.now(),
          leadName: lead.name || lead.fullName || 'Ohne Namen',
          phone: lead.phone || '',
          email: lead.email || '',
          product: leadProduct(lead) || lead.product || 'Versicherung',
        });
      }
    });
    return list.sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [pipelineLeads]);

  // Apply filters & search query
  const filteredEvents = useMemo(() => {
    let result = allEvents;
    if (typeFilter === 'termin') {
      result = result.filter((e) => e.kind === 'termin');
    } else if (typeFilter === 'wiedervorlage') {
      result = result.filter((e) => e.kind === 'wiedervorlage');
    } else if (typeFilter === 'overdue') {
      result = result.filter((e) => e.overdue);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) =>
        e.leadName.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.product.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allEvents, typeFilter, searchQuery]);

  // Map of events by date key
  const byDay = useMemo(() => {
    const map = {};
    filteredEvents.forEach((entry) => {
      if (!map[entry.dateKey]) map[entry.dateKey] = [];
      map[entry.dateKey].push(entry);
    });
    return map;
  }, [filteredEvents]);

  // Overall counts for toolbar stats
  const countStats = useMemo(() => {
    const termin = allEvents.filter((e) => e.kind === 'termin').length;
    const wv = allEvents.filter((e) => e.kind === 'wiedervorlage').length;
    const overdue = allEvents.filter((e) => e.overdue).length;
    const today = allEvents.filter((e) => e.dateKey === todayKey).length;
    const upcoming = allEvents.filter((e) => !e.overdue).length;
    return { all: allEvents.length, termin, wv, overdue, today, upcoming };
  }, [allEvents, todayKey]);

  // Month navigation & cells
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });
  const cells = useMemo(() => getCalendarMonthGrid(cursor.year, cursor.month), [cursor.year, cursor.month]);

  // Week reference date & week days
  const [weekCursorDate, setWeekCursorDate] = useState(() => new Date());
  const weekDays = useMemo(() => getWeekDays(weekCursorDate), [weekCursorDate]);
  const weekLabel = useMemo(() => {
    if (!weekDays.length) return '';
    const start = weekDays[0].date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const end = weekDays[6].date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${start} – ${end}`;
  }, [weekDays]);

  // Handlers
  const handlePrev = () => {
    if (viewMode === 'week') {
      const next = new Date(weekCursorDate);
      next.setDate(next.getDate() - 7);
      setWeekCursorDate(next);
      setCursor({ year: next.getFullYear(), month: next.getMonth() });
    } else {
      setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      const next = new Date(weekCursorDate);
      next.setDate(next.getDate() + 7);
      setWeekCursorDate(next);
      setCursor({ year: next.getFullYear(), month: next.getMonth() });
    } else {
      setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
    }
  };

  const handleToday = () => {
    const t = new Date();
    setCursor({ year: t.getFullYear(), month: t.getMonth() });
    setWeekCursorDate(t);
  };

  async function handleSaveSchedule(iso) {
    if (!scheduleTarget) return;
    const { lead, kind } = scheduleTarget;
    setSavingSchedule(true);
    setError('');
    try {
      const payload = await updateLead(lead.id, contactUpdatePayload(kind, {
        followUpAt: kind === 'wiedervorlage' ? iso : null,
        appointmentAt: kind === 'termin' ? iso : null,
      }));
      if (setLeadStatus) {
        setLeadStatus(lead.id, kind);
      }
      setLeads((prev) =>
        prev.map((l) => (String(l.id) === String(lead.id) ? { ...l, ...payload.lead, complaint: l.complaint } : l)),
      );
      setScheduleTarget(null);
      if (showToast) {
        showToast(kind === 'termin' ? 'Termin erfolgreich aktualisiert.' : 'Wiedervorlage aktualisiert.');
      }
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern');
    } finally {
      setSavingSchedule(false);
    }
  }

  // Grouped events for Agenda view
  const groupedAgenda = useMemo(() => {
    const groups = {};
    filteredEvents.forEach((event) => {
      if (!groups[event.dateKey]) groups[event.dateKey] = [];
      groups[event.dateKey].push(event);
    });
    return Object.entries(groups).map(([dKey, items]) => {
      const [y, m, d] = dKey.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      let dayTitle = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (dKey === todayKey) dayTitle = `Heute · ${dayTitle}`;
      return { dateKey: dKey, title: dayTitle, items };
    });
  }, [filteredEvents, todayKey]);

  return (
    <div className="broker-page broker-gcal-page">
      {/* Top Heading */}
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Terminplaner</div>
          <h1>Kalender</h1>
          <p className="lede">
            Alle Beratungstermine und Wiedervorlagen im Überblick.
          </p>
        </div>
      </div>

      {error ? <div className="broker-alert">{error}</div> : null}

      {/* Google Calendar Style Controls Bar */}
      <div className="broker-gcal-header">
        {/* Row 1: Navigation */}
        <div className="broker-gcal-nav-row">
          <div className="broker-gcal-nav">
            <button
              type="button"
              className="broker-gcal-today-btn"
              onClick={handleToday}
            >
              Heute
            </button>
            <div className="broker-gcal-nav-arrows">
              <button
                type="button"
                className="broker-gcal-arrow-btn"
                aria-label="Zurück"
                onClick={handlePrev}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="broker-gcal-arrow-btn"
                aria-label="Weiter"
                onClick={handleNext}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <h2 className="broker-gcal-period-title">
              {viewMode === 'week' ? weekLabel : monthLabel}
            </h2>
          </div>
        </div>

        {/* Row 2: Search + View Toggle */}
        <div className="broker-gcal-controls-row">
          {/* Search */}
          <div className="broker-cal-search-box">
            <Search size={14} className="broker-cal-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="broker-cal-search-input"
              placeholder="Lead oder Sparte suchen…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className="broker-cal-search-clear"
                aria-label="Suche leeren"
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </button>
            ) : null}
          </div>

          {/* View Toggle */}
          <div className="broker-cal-view-modes" role="tablist" aria-label="Ansicht wählen">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'month'}
              className={`broker-cal-view-btn${viewMode === 'month' ? ' is-active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              <CalendarIcon size={14} />
              <span>Monat</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'week'}
              className={`broker-cal-view-btn${viewMode === 'week' ? ' is-active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              <LayoutGrid size={14} />
              <span>Woche</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'agenda'}
              className={`broker-cal-view-btn${viewMode === 'agenda' ? ' is-active' : ''}`}
              onClick={() => setViewMode('agenda')}
            >
              <List size={14} />
              <span>Agenda</span>
            </button>
          </div>
        </div>
      </div>


      {/* Full-Width Main Calendar Area */}
      <div className="broker-gcal-container">
        {loading ? (
          <div className="broker-cal-loading">
            <span className="broker-inline-loader" aria-hidden="true" />
            <span>Lade Termine…</span>
          </div>
        ) : viewMode === 'month' ? (
          /* Google Calendar Month View */
          <div className="broker-gcal-month">
            {/* Weekday Row */}
            <div className="broker-gcal-weekdays">
              {['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'].map((d) => (
                <div key={d} className="broker-gcal-weekday-col">{d}</div>
              ))}
            </div>

            {/* 35/42 Grid */}
            <div className="broker-gcal-grid">
              {cells.map((cell) => {
                const isToday = cell.dateKey === todayKey;
                const dayEvents = byDay[cell.dateKey] || [];
                const maxVisible = 3;
                const visibleEvents = dayEvents.slice(0, maxVisible);
                const hasMore = dayEvents.length > maxVisible;

                return (
                  <div
                    key={cell.dateKey}
                    className={`broker-gcal-cell${cell.isCurrentMonth ? '' : ' is-other-month'}${isToday ? ' is-today' : ''}`}
                    onClick={() => {
                      if (!cell.isCurrentMonth) {
                        setCursor({ year: cell.year, month: cell.month });
                      }
                    }}
                  >
                    <div className="broker-gcal-cell-top">
                      <span className={`broker-gcal-day-badge${isToday ? ' is-today' : ''}`}>
                        {cell.day}
                      </span>
                    </div>

                    <div className="broker-gcal-chips-stack">
                      {visibleEvents.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          className={`broker-gcal-event-chip is-${ev.kind}${ev.overdue ? ' is-overdue' : ''}`}
                          title={`${ev.timeStr} • ${ev.leadName} (${ev.product})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }}
                        >
                          <span className="broker-gcal-chip-dot" />
                          <span className="broker-gcal-chip-time">{ev.timeStr.replace(' Uhr', '')}</span>
                          <span className="broker-gcal-chip-title">{ev.leadName}</span>
                        </button>
                      ))}

                      {hasMore ? (
                        <button
                          type="button"
                          className="broker-gcal-more-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDayModalEvents({
                              dateKey: cell.dateKey,
                              title: cell.date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                              events: dayEvents,
                            });
                          }}
                        >
                          +{dayEvents.length - maxVisible} weitere
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'week' ? (
          /* Google Calendar Week View */
          <div className="broker-gcal-week">
            <div className="broker-gcal-week-track">
              {weekDays.map((col) => {
                const isToday = col.dateKey === todayKey;
                const colEvents = byDay[col.dateKey] || [];

                return (
                  <div
                    key={col.dateKey}
                    className={`broker-gcal-week-col${isToday ? ' is-today' : ''}`}
                  >
                    <div className="broker-gcal-week-header">
                      <span className="broker-gcal-week-dayname">{col.dayName}</span>
                      <span className={`broker-gcal-week-daynum${isToday ? ' is-today' : ''}`}>
                        {col.dayNumber}
                      </span>
                    </div>

                    <div className="broker-gcal-week-body">
                      {colEvents.length ? (
                        colEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className={`broker-gcal-week-card is-${ev.kind}${ev.overdue ? ' is-overdue' : ''}`}
                            onClick={() => setSelectedEvent(ev)}
                          >
                            <div className="broker-gcal-week-card-time">{ev.timeStr}</div>
                            <strong className="broker-gcal-week-card-name">{ev.leadName}</strong>
                            <span className="broker-gcal-week-card-prod">{ev.product}</span>
                          </div>
                        ))
                      ) : (
                        <div className="broker-gcal-week-empty">—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Google Calendar Agenda View */
          <div className="broker-cal-agenda-view">
            {groupedAgenda.length ? (
              groupedAgenda.map((group) => (
                <div key={group.dateKey} className="broker-cal-agenda-group">
                  <div className="broker-cal-agenda-group-title">
                    <span className="broker-cal-group-dot" />
                    <strong>{group.title}</strong>
                    <span className="broker-cal-group-count">{group.items.length} Termin(e)</span>
                  </div>
                  <div className="broker-cal-agenda-cards">
                    {group.items.map((ev) => (
                      <div
                        key={ev.id}
                        className={`broker-cal-agenda-card is-${ev.kind}${ev.overdue ? ' is-overdue' : ''}`}
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <div className="broker-cal-agenda-card-time">
                          <span className="broker-cal-agenda-clock">
                            {ev.kind === 'termin' ? <CalendarClock size={18} /> : <Clock size={18} />}
                          </span>
                          <strong>{ev.timeStr}</strong>
                          <small>{ev.relative}</small>
                        </div>

                        <div className="broker-cal-agenda-card-body">
                          <div className="broker-cal-agenda-card-lead-row">
                            <span className="broker-cal-avatar">{calAvatarInitials(ev.leadName)}</span>
                            <div>
                              <span className="broker-cal-lead-link">{ev.leadName}</span>
                              <div className="broker-cal-lead-meta">
                                <span className={`broker-badge-pill is-${ev.kind}`}>
                                  {ev.kind === 'termin' ? 'Beratungstermin' : 'Wiedervorlage'}
                                </span>
                                <span className="broker-cal-product-tag">{ev.product}</span>
                                {ev.overdue ? (
                                  <span className="broker-cal-overdue-tag">
                                    <AlertCircle size={12} /> Überfällig
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="broker-cal-agenda-card-cta" onClick={(e) => e.stopPropagation()}>
                          {ev.phone ? (
                            <a href={`tel:${ev.phone}`} className="btn btn-sm btn-outline">
                              <Phone size={13} /> {ev.phone}
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setScheduleTarget({ lead: ev.lead, kind: ev.kind })}
                          >
                            Verschieben
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => navigate(`/dashboard/leads/${ev.lead.id}`)}
                          >
                            Lead öffnen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="broker-empty">
                <strong>Keine anstehenden Termine gefunden</strong>
                <p>Passen Sie die Suche oder Filter an, oder legen Sie Termine in einem Lead an.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Calendar Event Detail Modal */}
      {selectedEvent ? (
        <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="gcal-event-title">
          <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={() => setSelectedEvent(null)} />
          <div className="broker-modal__panel broker-gcal-detail-modal">
            <div className="broker-modal__top">
              <span className={`broker-badge-pill is-${selectedEvent.kind}`}>
                {selectedEvent.kind === 'termin' ? 'Beratungstermin' : 'Wiedervorlage'}
              </span>
              <button type="button" className="broker-modal__close" aria-label="Schließen" onClick={() => setSelectedEvent(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="broker-gcal-modal-content">
              <div className="broker-gcal-modal-header">
                <span className="broker-cal-avatar">{calAvatarInitials(selectedEvent.leadName)}</span>
                <div>
                  <h2 id="gcal-event-title">{selectedEvent.leadName}</h2>
                  <span className="broker-gcal-modal-prod">{selectedEvent.product}</span>
                </div>
              </div>

              <div className="broker-gcal-modal-info-list">
                <div className="broker-gcal-modal-info-row">
                  <CalendarClock size={16} className="broker-gcal-modal-icon" />
                  <div>
                    <strong>{selectedEvent.label || selectedEvent.timeStr}</strong>
                    <small>{selectedEvent.relative}</small>
                  </div>
                </div>

                {selectedEvent.phone ? (
                  <div className="broker-gcal-modal-info-row">
                    <Phone size={16} className="broker-gcal-modal-icon" />
                    <div>
                      <a href={`tel:${selectedEvent.phone}`} className="broker-gcal-contact-link">
                        {selectedEvent.phone}
                      </a>
                      <small>Telefonnummer (Klick zum Anrufen)</small>
                    </div>
                  </div>
                ) : null}

                {selectedEvent.email ? (
                  <div className="broker-gcal-modal-info-row">
                    <Mail size={16} className="broker-gcal-modal-icon" />
                    <div>
                      <a href={`mailto:${selectedEvent.email}`} className="broker-gcal-contact-link">
                        {selectedEvent.email}
                      </a>
                      <small>E-Mail-Adresse</small>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="broker-gcal-modal-actions">
                {selectedEvent.phone ? (
                  <a href={`tel:${selectedEvent.phone}`} className="btn btn-outline btn-sm">
                    <Phone size={13} /> Anrufen
                  </a>
                ) : null}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setScheduleTarget({ lead: selectedEvent.lead, kind: selectedEvent.kind });
                    setSelectedEvent(null);
                  }}
                >
                  Termin ändern
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/dashboard/leads/${selectedEvent.lead.id}`)}
                >
                  Lead öffnen
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Day Events Overview Modal (triggered by +N weitere) */}
      {dayModalEvents ? (
        <div className="broker-modal" role="dialog" aria-modal="true">
          <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={() => setDayModalEvents(null)} />
          <div className="broker-modal__panel broker-gcal-day-modal">
            <div className="broker-modal__top">
              <h2>{dayModalEvents.title}</h2>
              <button type="button" className="broker-modal__close" aria-label="Schließen" onClick={() => setDayModalEvents(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="broker-gcal-day-modal-list">
              {dayModalEvents.events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`broker-gcal-event-chip is-${ev.kind} is-large`}
                  onClick={() => {
                    setSelectedEvent(ev);
                    setDayModalEvents(null);
                  }}
                >
                  <span className="broker-gcal-chip-dot" />
                  <span className="broker-gcal-chip-time">{ev.timeStr}</span>
                  <strong className="broker-gcal-chip-title">{ev.leadName}</strong>
                  <span className="broker-gcal-chip-prod">({ev.product})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Schedule Modal for direct rescheduling from calendar */}
      {scheduleTarget ? (
        <LeadScheduleModal
          kind={scheduleTarget.kind}
          value={scheduleTarget.kind === 'termin' ? scheduleTarget.lead.appointmentAt : scheduleTarget.lead.followUpAt}
          saving={savingSchedule}
          locked={false}
          leadName={scheduleTarget.lead.fullName || scheduleTarget.lead.name}
          onSave={handleSaveSchedule}
          onClose={() => {
            if (!savingSchedule) setScheduleTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

export function BeraterAcademy() {
  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Lernen</div>
          <h1>Academy</h1>
          <p className="lede">Schulungen, Videos und Unterlagen für Ihren Bestand — in Kürze.</p>
        </div>
      </div>
      <section className="broker-panel broker-coming-soon">
        <span className="broker-coming-soon-icon" aria-hidden="true">
          <GraduationCap size={28} strokeWidth={1.8} />
        </span>
        <em>Coming soon</em>
        <strong>Academy folgt in Kürze</strong>
        <p>Dieser Bereich wird vorbereitet. Sobald Inhalte bereitstehen, finden Sie sie hier.</p>
      </section>
    </div>
  );
}

export function BeraterPartners() {
  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Netzwerk</div>
          <h1>Partner</h1>
          <p className="lede">Partner anlegen und verwalten — in Kürze.</p>
        </div>
      </div>
      <section className="broker-panel broker-coming-soon">
        <span className="broker-coming-soon-icon" aria-hidden="true">
          <Handshake size={28} strokeWidth={1.8} />
        </span>
        <em>Coming soon</em>
        <strong>Partner folgt in Kürze</strong>
        <p>Dieser Bereich wird vorbereitet. Sobald Sie Partner anlegen können, finden Sie sie hier.</p>
      </section>
    </div>
  );
}

export function BeraterSupport() {
  const { user } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState({
    category: 'general',
    priority: 'normal',
    subject: '',
    message: '',
    phone: user?.phone || '',
    leadRef: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const faqs = [
    {
      q: 'Wie schnell antwortet der Support?',
      a: 'Werktags in der Regel innerhalb eines Arbeitstages. Dringende Anfragen zu laufenden Terminen behandeln wir bevorzugt.',
    },
    {
      q: 'Lead ungültig oder falsch?',
      a: 'Reklamationen zu einzelnen Leads bitte direkt im Lead unter „Reklamation“ einreichen — inkl. Nachweis. Der Support hier ist für Portal, Konto und Abrechnung.',
    },
    {
      q: 'Rechnung oder Paket',
      a: 'Unter Mein Paket finden Sie Zahlungen und Rechnungen. Für Korrekturen senden Sie uns die Rechnungsnummer mit.',
    },
  ];

  const company = user?.profile?.company || '';
  const customerNumber = user?.customerNumber || '';
  const display = displayName(user) || user?.email || '';

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSent(false);
  }

  async function addSupportFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setSent(false);

    const room = SUPPORT_ATTACH_MAX - files.length;
    if (room <= 0) {
      setError('Maximal 3 Dateien.');
      return;
    }

    const sliced = incoming.slice(0, room);
    try {
      const parsed = [];
      for (const file of sliced) {
        parsed.push(await readProofFile(file));
      }
      setFiles((prev) => [
        ...prev,
        ...parsed.filter(Boolean).map((item, index) => ({
          id: `${item.name}-${item.data.length}-${Date.now()}-${index}`,
          name: item.name,
          data: item.data,
          type: String(item.data.match(/^data:([^;]+)/)?.[1] || '').toLowerCase(),
        })),
      ]);
      setError(incoming.length > room
        ? 'Maximal 3 Dateien — überzählige wurden nicht hinzugefügt.'
        : '');
    } catch (err) {
      setError(err.message || 'Datei konnte nicht gelesen werden.');
    }
  }

  function removeSupportFile(id) {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSent(false);

    if (!form.subject.trim() || form.message.trim().length < 20) {
      setError('Bitte geben Sie einen Betreff und eine Nachricht mit mindestens 20 Zeichen an.');
      return;
    }

    setSending(true);
    try {
      const session = readStoredSession();
      const response = await fetch(apiUrl('/api/contact'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          name: display,
          email: user?.email || '',
          phone: form.phone,
          company,
          customerNumber,
          userId: user?.id || '',
          category: form.category,
          priority: form.priority,
          subject: form.subject,
          message: form.message,
          leadRef: form.leadRef,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          attachments: files.map((file) => ({
            name: file.name,
            type: file.type,
            data: file.data,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Nachricht konnte nicht gesendet werden.');
      }

      setSent(true);
      setFiles([]);
      setForm((prev) => ({ ...prev, subject: '', message: '', leadRef: '' }));
      showToast('Ihre Nachricht wurde gesendet.');
    } catch (err) {
      setError(err.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setSending(false);
    }
  }

  const messageLen = form.message.trim().length;

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Support</div>
          <h1>Hilfe & <em>Kontakt</em></h1>
          <p className="lede">Fragen zum Bestand, zur Abrechnung oder zum Konto — wir antworten werktags.</p>
        </div>
      </div>

      <div className="broker-support-layout">
        <section className="broker-panel">
          <div className="broker-panel-header">
            <div>
              <h2>Nachricht an VANTARO</h2>
              <p>Anliegen beschreiben — wir erhalten Ihre Kontodaten automatisch.</p>
            </div>
          </div>
          <div className="broker-panel-body">
            {sent ? (
              <div className="broker-support-success" role="status">
                <span className="broker-support-success-icon" aria-hidden="true">
                  <CheckCircle2 size={22} />
                </span>
                <div>
                  <strong>Anfrage gesendet</strong>
                  <p>Wir haben Ihre Nachricht erhalten und eine Bestätigung an {user?.email} geschickt.</p>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="broker-support-form">
              {error ? (
                <div className="broker-alert" role="alert">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="broker-support-fieldset">
                <span className="broker-support-label">Priorität</span>
                <div className="broker-support-priority" role="radiogroup" aria-label="Priorität">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.priority === 'normal'}
                    className={form.priority === 'normal' ? 'is-active' : undefined}
                    disabled={sending}
                    onClick={() => updateField('priority', 'normal')}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.priority === 'urgent'}
                    className={`is-urgent${form.priority === 'urgent' ? ' is-active' : ''}`}
                    disabled={sending}
                    onClick={() => updateField('priority', 'urgent')}
                  >
                    <Flag size={14} />
                    Dringend
                  </button>
                </div>
              </div>

              <div className="broker-form-grid">
                <label className="is-full">
                  Betreff
                  <input
                    value={form.subject}
                    onChange={(event) => updateField('subject', event.target.value)}
                    placeholder="z. B. Rechnung vom März oder Termin-Erinnerung"
                    maxLength={140}
                    disabled={sending}
                    required
                  />
                </label>
                <label>
                  Rückrufnummer
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    placeholder="Optional"
                    disabled={sending}
                  />
                </label>
                <label>
                  Lead-Bezug
                  <input
                    value={form.leadRef}
                    onChange={(event) => updateField('leadRef', event.target.value)}
                    placeholder="Name oder ID, optional"
                    disabled={sending}
                  />
                </label>
                <label className="is-full">
                  Nachricht
                  <textarea
                    className="broker-support-message"
                    value={form.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    placeholder="Was ist passiert, was erwarten Sie, und seit wann besteht das Thema?"
                    rows={7}
                    maxLength={4000}
                    disabled={sending}
                    required
                  />
                  <span className={`broker-support-count${messageLen < 20 ? ' is-short' : ''}`}>
                    {messageLen} / 4000 · mindestens 20 Zeichen
                  </span>
                </label>
              </div>

              <div
                className={`broker-support-upload${dragOver ? ' is-over' : ''}${files.length >= SUPPORT_ATTACH_MAX ? ' is-full' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!sending && files.length < SUPPORT_ATTACH_MAX) setDragOver(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  if (!sending) addSupportFiles(event.dataTransfer.files);
                }}
              >
                <span className="broker-support-label">Anhang</span>
                <label className="broker-support-drop">
                  <Paperclip size={18} aria-hidden="true" />
                  <span>
                    <strong>Dateien oder Bilder anhängen</strong>
                    <small>PDF, JPG, PNG, WebP · max. 3 · 1,2 MB je Datei</small>
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    multiple
                    disabled={sending || files.length >= SUPPORT_ATTACH_MAX}
                    onChange={(event) => {
                      addSupportFiles(event.target.files);
                      event.target.value = '';
                    }}
                  />
                </label>
                {files.length ? (
                  <ul className="broker-support-files">
                    {files.map((file) => (
                      <li key={file.id}>
                        {file.type.startsWith('image/') ? (
                          <img src={file.data} alt="" />
                        ) : (
                          <span className="broker-support-file-icon" aria-hidden="true">
                            <FileCheck2 size={22} />
                          </span>
                        )}
                        <span title={file.name}>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSupportFile(file.id)}
                          disabled={sending}
                          aria-label={`${file.name} entfernen`}
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="broker-support-actions">
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? 'Wird gesendet…' : (
                    <>
                      <Send size={16} />
                      Nachricht senden
                    </>
                  )}
                </button>
                <p>Antwort an {user?.email || 'Ihre Konto-E-Mail'}.</p>
              </div>
            </form>
          </div>
        </section>

        <aside className="broker-support-aside">
          <section className="broker-panel">
            <div className="broker-panel-header">
              <div>
                <h2>Erreichbarkeit</h2>
                <p>Montag bis Freitag, außer Feiertage.</p>
              </div>
            </div>
            <div className="broker-support-hours">
              <div className="broker-support-hours-item">
                <strong>Zeiten</strong>
                <span>09:00 – 17:00 Uhr</span>
              </div>
              <a className="broker-support-card" href="mailto:info@vantaro.io">
                <span className="broker-support-icon" aria-hidden="true">
                  <Mail size={18} />
                </span>
                <div>
                  <strong>E-Mail</strong>
                  <span>info@vantaro.io</span>
                </div>
              </a>
            </div>
          </section>

          <section className="broker-panel">
            <div className="broker-panel-header">
              <div>
                <h2>Häufige Fragen</h2>
              </div>
            </div>
            <div className="broker-faq-list">
              {faqs.map((item) => (
                <details key={item.q} className="broker-faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </aside>
      </div>
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
  const [outcomeOpen, setOutcomeOpen] = useState(false);
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
      closeOutcome: times.closeOutcome,
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
    if (statusId === 'abgeschlossen') {
      setDraftStatus(statusId);
      setOutcomeOpen(true);
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

  async function saveOutcome(outcomeId) {
    setSavingSchedule(true);
    setError('');
    try {
      await persistContact('abgeschlossen', { closeOutcome: outcomeId });
      setOutcomeOpen(false);
      showToast(
        outcomeId === 'erfolgreich'
          ? 'Lead als erfolgreich gespeichert.'
          : 'Lead als nicht erfolgreich gespeichert.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

  function closeOutcomeModal() {
    if (savingSchedule) return;
    setOutcomeOpen(false);
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
  const outcome = closeOutcomeOf(lead);

  return (
    <div className="broker-page">
      <button type="button" className="broker-back" onClick={() => navigate('/dashboard/leads')}>
        <ArrowLeft size={16} />
        Zurück zu Ihren Leads
      </button>

      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-heading broker-detail-heading">
        <span className="broker-detail-avatar" aria-hidden="true">{leadInitials(lead)}</span>
        <div className="broker-detail-heading-main">
          <div className="eyebrow">Ihr Gespräch</div>
          <h1>{view.name || 'Ohne Namen'}</h1>
          <p className="lede">
            {[view.address !== '—' ? view.address : '', distance ? `${distance} entfernt` : '']
              .filter(Boolean)
              .join(' · ') || 'Keine Adresse hinterlegt'}
          </p>
        </div>
        <LeadStatusDropdown
          lead={view}
          status={status}
          disabled={notesLocked || savingSchedule}
          saving={savingSchedule}
          onSelectStatus={handleStatusClick}
        />
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
            <div className="broker-detail-facts">
              <DetailFact label="Hinweis" wide>
                {lead.notes || null}
              </DetailFact>
            </div>
          </section>
        </div>

        <aside className="broker-panel broker-detail-side">
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

          {view.status === 'abgeschlossen' ? (
            <div className={`broker-detail-side-block broker-detail-schedule-summary${outcome ? ' is-active' : ''}`}>
              <div className="broker-detail-wiedervorlage-head">
                <span className="broker-detail-wiedervorlage-icon" aria-hidden="true">
                  {outcome === 'fehlgeschlagen' ? <CircleX size={18} /> : <CircleCheck size={18} />}
                </span>
                <div>
                  <h3>Abschluss</h3>
                  <p>
                    {outcome
                      ? closeOutcomeLabel(outcome)
                      : 'Bitte wählen, ob der Lead Kunde wurde oder nicht.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline broker-calendar-save"
                disabled={notesLocked || savingSchedule}
                onClick={() => {
                  setDraftStatus('abgeschlossen');
                  setOutcomeOpen(true);
                }}
              >
                {outcome ? 'Ergebnis ändern' : 'Ergebnis wählen'}
              </button>
            </div>
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
      {outcomeOpen ? (
        <LeadCloseOutcomeModal
          leadName={lead.fullName}
          value={outcome}
          saving={savingSchedule}
          onSave={saveOutcome}
          onClose={closeOutcomeModal}
        />
      ) : null}
    </div>
  );
}

export function BeraterPayments() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activePackageId, selectPackage, activePackage } = useBroker();
  const [qtyByPackage, setQtyByPackage] = useState({});
  const [payments, setPayments] = useState([]);
  const [leadsUsed, setLeadsUsed] = useState(0);
  const [checkout, setCheckout] = useState(null);
  const [paying, setPaying] = useState(false);
  const [syncingId, setSyncingId] = useState('');
  const [invoiceBusyId, setInvoiceBusyId] = useState('');
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get('payment');
    if (!payment) return;

    if (payment === 'success') {
      setNotice('Zahlung erfolgreich. Ihre Lead-Anforderung wurde angelegt.');
      setError('');
    } else if (payment === 'failed') {
      setError(params.get('error') || 'Zahlung fehlgeschlagen oder abgebrochen.');
      setNotice('');
    } else if (payment === 'pending') {
      setNotice('Zahlung noch nicht abgeschlossen. Der Status wird aktualisiert, sobald die Bank bestätigt.');
      setError('');
    }

    loadBilling().catch(() => {});
    navigate('/dashboard/paket', { replace: true });
  }, [location.search, navigate]);

  const minLeads = 10;
  const leadStep = 5;

  const getQty = (packageId) => {
    const raw = qtyByPackage[packageId];
    if (raw == null) return minLeads;
    return Math.max(minLeads, raw);
  };

  const leadQuota = payments
    .filter((entry) => entry.status === 'paid')
    .reduce((sum, entry) => sum + (entry.leadCount || 0), 0);
  const leadsRemaining = Math.max(0, leadQuota - leadsUsed);
  const checkoutPkg = checkout ? packageById(checkout.packageId) : null;
  const checkoutQty = checkout?.qty || minLeads;
  const checkoutNet = checkoutPkg ? packTotalCents(checkoutPkg, checkoutQty) : 0;

  const setQty = (packageId, next) => {
    const parsed = Math.round(Number(next) / leadStep) * leadStep;
    const value = Math.max(minLeads, parsed || minLeads);
    setQtyByPackage((prev) => ({ ...prev, [packageId]: value }));
  };

  const confirmPay = async () => {
    if (!checkoutPkg || paying) return;
    setPaying(true);
    setError('');
    setNotice('');
    try {
      const result = await checkoutLeadPackage({
        packageId: checkoutPkg.id,
        requestedCount: checkoutQty,
        browser: collectBrowserPaymentMeta(),
      });
      selectPackage(checkoutPkg.id);
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      throw new Error('Zahlungsseite der Bank konnte nicht geöffnet werden.');
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  };

  const handleSyncPending = async (paymentId) => {
    if (!paymentId || syncingId) return;
    setSyncingId(paymentId);
    setError('');
    try {
      const result = await syncMyPayment(paymentId);
      await loadBilling();
      if (result.outcome === 'paid') {
        setNotice('Zahlung bestätigt. Ihre Lead-Anforderung wurde angelegt.');
      } else if (result.outcome === 'failed') {
        setError('Zahlung wurde von der Bank abgelehnt oder abgebrochen.');
      } else {
        setNotice('Zahlung ist bei der Bank noch offen. Bitte später erneut prüfen.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingId('');
    }
  };

  const runInvoiceAction = async (paymentId, action) => {
    if (!paymentId || invoiceBusyId) return;
    setInvoiceBusyId(paymentId);
    setError('');
    try {
      await action(paymentId);
    } catch (err) {
      setError(err.message || 'Rechnung konnte nicht geladen werden.');
    } finally {
      setInvoiceBusyId('');
    }
  };

  return (
    <div className="broker-page">
      {/* Header */}
      <div className="broker-heading broker-billing-heading">
        <div>
          <div className="eyebrow">Abrechnung</div>
          <h1>Pakete &amp; Guthaben</h1>
          <p className="lede">
            Laden Sie Ihr Lead-Kontingent nach Bedarf auf. Die Zahlung erfolgt über die ProCredit Bank.
          </p>
        </div>
      </div>

      {/* Unified Compact Status Bar */}
      <div className="broker-panel broker-simple-status-bar">
        <div className="broker-status-stat">
          <span className="broker-stat-label">Verfügbares Kontingent</span>
          <div className="broker-stat-val">
            <strong>{leadsRemaining} Leads</strong>
            <small>({leadsUsed} zugewiesen von {leadQuota} gebucht)</small>
          </div>
        </div>
        <div className="broker-status-divider" />
        <div className="broker-status-stat">
          <span className="broker-stat-label">Aktives Paket</span>
          <div className="broker-stat-val">
            <strong>{activePackage?.label || 'Kein Paket gewählt'}</strong>
          </div>
        </div>
        <div className="broker-status-divider" />
        <div className="broker-status-stat broker-status-stat--link">
          <Link to="/dashboard/unternehmen" className="broker-text-btn">
            <Building2 size={15} /> Rechnungsadresse
          </Link>
        </div>
      </div>

      {notice ? (
        <div className="broker-alert broker-alert--ok">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      ) : null}
      {error ? (
        <div className="broker-alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Clean 2-Card Package Grid */}
      <div className="broker-simple-packages">
        {PACKAGES.map((pkg) => {
          const active = activePackageId === pkg.id;
          const qty = getQty(pkg.id);
          const net = packTotalCents(pkg, qty);

          return (
            <article
              key={pkg.id}
              className={`broker-panel broker-simple-pkg-card${pkg.featured ? ' is-featured' : ''}`}
            >
              <div className="broker-simple-pkg-header">
                <div>
                  <span className="broker-simple-scope-tag">
                    {pkg.scope === 'regional' ? 'Regional' : 'Deutschlandweit'}
                  </span>
                  <h3>{pkg.title}</h3>
                </div>
                <div className="broker-simple-price-box">
                  <strong>{formatEuroExact(pkg.packCents)}</strong>
                  <small>/ Lead</small>
                </div>
              </div>

              <p className="broker-simple-desc">{pkg.description}</p>

              <div className="broker-simple-stepper-row">
                <span className="broker-simple-row-label">Lead-Menge (ab 10)</span>
                <div className="broker-qty-controls">
                  <button
                    type="button"
                    onClick={() => setQty(pkg.id, qty - leadStep)}
                    disabled={qty <= minLeads}
                    aria-label="Weniger"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={minLeads}
                    step={leadStep}
                    value={qty}
                    onChange={(event) => setQty(pkg.id, event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setQty(pkg.id, qty + leadStep)}
                    aria-label="Mehr"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="broker-simple-sum-row">
                <span>Gesamt ({qty} nicht im Inland steuerbare Leistung, ohne MwSt.)</span>
              </div>

              <div className="broker-simple-btn-group">
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
                  <CreditCard size={15} /> Leads buchen
                </button>
                {!active ? (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => selectPackage(pkg.id)}
                  >
                    Als Standard merken
                  </button>
                ) : (
                  <span className="broker-simple-active-badge">
                    <Check size={13} /> Aktiver Standard
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Confirm → redirect to ProCredit Hosted Payment Page */}
      {checkoutPkg ? (
        <div
          className="broker-checkout-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget && !paying) setCheckout(null);
          }}
        >
          <div className="broker-checkout-panel broker-simple-modal">
            <div className="broker-simple-modal-head">
              <div>
                <h2>Zahlung bestätigen</h2>
                <p>
                  {checkoutQty} Leads
                </p>
              </div>
              <button
                type="button"
                className="broker-checkout-close"
                disabled={paying}
                onClick={() => setCheckout(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="broker-simple-sum-row" style={{ marginBottom: '1rem' }}>
              <span>{checkoutPkg.label}</span>
              <strong>{formatEuroExact(checkoutNet)}</strong>
            </div>
            <p className="lede" style={{ marginBottom: '1.25rem' }}>
              Sie werden zur sicheren Zahlungsseite der ProCredit Bank weitergeleitet.
              Kartendaten werden ausschließlich bei der Bank eingegeben.
            </p>

            <div className="broker-checkout-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={paying}
                onClick={() => setCheckout(null)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={paying}
                onClick={confirmPay}
              >
                {paying ? 'Weiterleitung…' : `${formatEuroExact(checkoutNet)} bezahlen`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Invoices List */}
      <section className="broker-panel broker-invoice-panel">
        <div className="broker-panel-header">
          <div>
            <h2>Rechnungen</h2>
            <p>Übersicht Ihrer bisherigen Zahlungen</p>
          </div>
        </div>

        {payments.length ? (
          <div className="broker-invoice-table-wrap">
            <table className="broker-invoice-table">
              <thead>
                <tr>
                  <th>Rechnung</th>
                  <th>Datum</th>
                  <th>Paket</th>
                  <th>Zahlung</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Betrag</th>
                  <th className="broker-invoice-actions-col">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <button
                        type="button"
                        className="broker-invoice-id"
                        disabled={Boolean(invoiceBusyId)}
                        onClick={() => runInvoiceAction(invoice.id, openPaymentInvoice)}
                      >
                        <FileText size={14} />
                        {invoice.invoiceNumber}
                      </button>
                    </td>
                    <td>{formatDateTime(invoice.paidAt || invoice.createdAt)}</td>
                    <td>
                      <strong>{invoice.packageLabel}</strong>
                      <small>{invoice.leadCount} Leads</small>
                    </td>
                    <td>
                      <span>{formatCardMask(invoice)}</span>
                    </td>
                    <td>
                      <span className={`broker-invoice-status ${invoice.status === 'paid' ? 'is-paid' : 'is-unpaid'}`}>
                        {invoice.status === 'paid' ? 'Bezahlt' : paymentStatusLabel(invoice.status)}
                      </span>
                      {invoice.status === 'pending' ? (
                        <button
                          type="button"
                          className="broker-text-btn"
                          style={{ display: 'block', marginTop: 6 }}
                          disabled={Boolean(syncingId)}
                          onClick={() => handleSyncPending(invoice.id)}
                        >
                          {syncingId === invoice.id ? 'Prüfe…' : 'Status prüfen'}
                        </button>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className="broker-inv-amount">{formatEuroExact(invoice.netCents || invoice.grossCents)}</strong>
                    </td>
                    <td>
                      <div className="broker-invoice-actions">
                        <button
                          type="button"
                          className="broker-invoice-action"
                          title="Rechnung öffnen"
                          aria-label={`Rechnung ${invoice.invoiceNumber} öffnen`}
                          disabled={Boolean(invoiceBusyId)}
                          onClick={() => runInvoiceAction(invoice.id, openPaymentInvoice)}
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          type="button"
                          className="broker-invoice-action"
                          title="Rechnung herunterladen"
                          aria-label={`Rechnung ${invoice.invoiceNumber} herunterladen`}
                          disabled={Boolean(invoiceBusyId)}
                          onClick={() => runInvoiceAction(invoice.id, downloadPaymentInvoice)}
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="broker-empty">
            <p>Noch keine Rechnungen vorhanden.</p>
          </div>
        )}
      </section>
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
    { id: 'einstellungen', to: '/dashboard/einstellungen', label: 'Einstellungen', icon: Settings },
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
      <ThemeMode variant="nav" />
    </nav>
  );
}

function SettingsShell({ active, title, lede, children }) {
  return (
    <div className="broker-page broker-page--settings">
      <div className="broker-heading broker-heading--settings">
        <div>
          <div className="eyebrow">Konto & Einstellungen</div>
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
  const [phoneError, setPhoneError] = useState('');
  const [avatarName, setAvatarName] = useState('');

  useEffect(() => {
    setForm(personalForm(user));
    setAvatarName('');
  }, [user?.id, user?.firstName, user?.lastName, user?.phone, user?.avatarUrl]);

  const previewInitials = initials({
    firstName: form.firstName,
    lastName: form.lastName,
    email: user?.email,
  });

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
    setPhoneError('');
    if (!form.firstName.trim() || form.firstName.trim().length < 2) {
      setError('Bitte geben Sie Ihren Vornamen an.');
      return;
    }
    if (!form.lastName.trim() || form.lastName.trim().length < 2) {
      setError('Bitte geben Sie Ihren Nachnamen an.');
      return;
    }
    if (!isValidMobile(form.phone)) {
      setPhoneError('Bitte geben Sie eine gültige Telefonnummer an.');
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
      title="Profil"
      lede="So erscheinen Sie im Portal — Bild, Name und Erreichbarkeit."
    >
      <form className="broker-panel broker-settings broker-settings--wide broker-settings--profile" onSubmit={save}>
        {error && <div className="broker-alert">{error}</div>}

        <section className="broker-profile-hero" id="foto" aria-label="Profilbild">
          <div className="broker-profile-hero__visual">
            <div className="broker-avatar broker-avatar--hero" aria-hidden="true">
              {form.avatarUrl ? <img src={form.avatarUrl} alt="" /> : previewInitials}
            </div>
            <div className="broker-profile-hero__upload">
              <label className="broker-upload-card" htmlFor="profile-avatar">
                <input
                  id="profile-avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatar}
                  disabled={saving}
                />
                <span className="broker-upload-card__title">Profilbild</span>
                <span className="broker-upload-card__meta">
                  {avatarName || (form.avatarUrl ? 'Aktuelles Bild behalten' : 'PNG oder JPG · optional')}
                </span>
                <span className="broker-upload-card__cta">Bild auswählen</span>
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
                <User size={16} strokeWidth={2.2} />
              </span>
              Persönliche Angaben
            </h3>
            <p>Name und Telefon für Vertrag, Rückfragen und die Anzeige in Ihrem Konto.</p>
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
                onChange={(phone) => {
                  setPhoneError('');
                  setForm((prev) => ({ ...prev, phone }));
                }}
                disabled={saving}
                required
                className="vantaro-phone-input--light"
                error={phoneError}
              />
            </label>
          </div>
        </section>

        <div className="broker-settings-actions broker-settings-actions--bar">
          <p className="broker-settings-actions__hint">Änderungen gelten sofort nach dem Speichern in Ihrem Konto.</p>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} strokeWidth={2.2} aria-hidden="true" />
            {saving ? 'Wird gespeichert…' : 'Profil speichern'}
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

function SettingSwitch({ id, checked, onChange, disabled, label, hint }) {
  return (
    <label className={`broker-setting-row${disabled ? ' is-disabled' : ''}`} htmlFor={id}>
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <span className="cookie-switch">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <i />
      </span>
    </label>
  );
}

function writeCookiePrefs(prefs) {
  const payload = {
    ...DEFAULT_PREFS,
    ...prefs,
    necessary: true,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  applyConsent(payload);
  window.dispatchEvent(new CustomEvent('vantaro:consent', { detail: payload }));
  return payload;
}

export function BeraterSettings() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useBroker();
  const [prefs, setPrefs] = useState(readBrokerSettings);
  const [cookies, setCookies] = useState(() => readStoredConsent() || DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [browserNote, setBrowserNote] = useState('');

  useEffect(() => subscribeBrokerSettings(setPrefs), []);

  useEffect(() => {
    if (user?.settings) setPrefs(writeBrokerSettings(user.settings));
  }, [user?.id]);

  useEffect(() => {
    const saved = readStoredConsent();
    if (saved) setCookies(saved);
    function onConsent(event) {
      if (event.detail) setCookies({ ...DEFAULT_PREFS, ...event.detail, necessary: true });
    }
    window.addEventListener('vantaro:consent', onConsent);
    return () => window.removeEventListener('vantaro:consent', onConsent);
  }, []);

  async function applyPrefs(partial) {
    const next = writeBrokerSettings(partial);
    setPrefs(next);
    setError('');
    setSaving(true);
    try {
      await updateProfile({ settings: next });
      return true;
    } catch (err) {
      setError(err.message || 'Einstellungen konnten nicht gespeichert werden.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleBrowserAlerts(next) {
    setBrowserNote('');
    if (next) {
      if (typeof Notification === 'undefined') {
        setBrowserNote('Dieser Browser unterstützt keine Desktop-Benachrichtigungen.');
        return;
      }
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        setBrowserNote('Bitte Benachrichtigungen in den Browser-Einstellungen zulassen.');
        await applyPrefs({ browserAlerts: false });
        return;
      }
    }
    await applyPrefs({ browserAlerts: next });
    if (next) showToast('Browser-Benachrichtigungen sind aktiv.');
  }

  function toggleCookie(key, value) {
    const next = writeCookiePrefs({ ...cookies, [key]: value });
    setCookies(next);
  }

  return (
    <SettingsShell
      active="einstellungen"
      title="Einstellungen"
      lede="Hinweise, Kalender und Datenschutz — so steuern Sie Ihr Portal."
    >
      <div className="broker-panel broker-settings broker-settings--wide">
        {error ? (
          <div className="broker-alert" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="broker-settings-section">
          <header>
            <h3>
              <span className="broker-settings-section__icon" aria-hidden="true">
                <Bell size={16} strokeWidth={2.2} />
              </span>
              Benachrichtigungen
            </h3>
            <p>Legen Sie fest, wofür Sie Hinweise bekommen — oder schalten Sie sie komplett aus.</p>
          </header>
          <div className="broker-setting-rows">
            <SettingSwitch
              id="setting-termin"
              checked={prefs.terminAlerts}
              disabled={saving}
              onChange={(checked) => applyPrefs({ terminAlerts: checked })}
              label="Neue Termine"
              hint="Mail, Glocke und Kalender, wenn ein Termin gelegt wird oder näher rückt."
            />
            <SettingSwitch
              id="setting-wiedervorlage"
              checked={prefs.wiedervorlageAlerts}
              disabled={saving}
              onChange={(checked) => applyPrefs({ wiedervorlageAlerts: checked })}
              label="Neue Wiedervorlagen"
              hint="Mail, Glocke und Kalender, wenn eine Wiedervorlage gelegt wird oder näher rückt."
            />
            <SettingSwitch
              id="setting-toast"
              checked={prefs.toastAlerts}
              disabled={saving}
              onChange={(checked) => applyPrefs({ toastAlerts: checked })}
              label="Hinweise in der Glocke"
              hint="Rote Markierung und Kurzhinweis im Portal, wenn ein Termin näher rückt."
            />
            <SettingSwitch
              id="setting-browser"
              checked={prefs.browserAlerts}
              disabled={saving}
              onChange={toggleBrowserAlerts}
              label="Browser-Benachrichtigungen"
              hint="Meldung auf dem Rechner, auch wenn das Portal im Hintergrund liegt."
            />
            {browserNote ? <p className="broker-setting-note">{browserNote}</p> : null}
            <SettingSwitch
              id="setting-email"
              checked={prefs.emailReminders}
              disabled={saving}
              onChange={(checked) => applyPrefs({ emailReminders: checked })}
              label="E-Mail-Erinnerungen"
              hint="Eine Mail 1 Stunde vorher, eine weitere 15 Minuten vorher."
            />
          </div>
        </section>

        <section className="broker-settings-section">
          <header>
            <h3>
              <span className="broker-settings-section__icon" aria-hidden="true">
                <CalendarClock size={16} strokeWidth={2.2} />
              </span>
              Google Kalender
            </h3>
            <p>
              Termine und Wiedervorlagen gehen als Kalendereinladung an Ihre Konto-E-Mail und erscheinen in Google Kalender. Trennen Sie die Verbindung, wenn das nicht mehr geschehen soll.
            </p>
          </header>
          <div className="broker-setting-connect">
            <div>
              <span className={`broker-setting-status${prefs.googleCalendar ? ' is-on' : ''}`}>
                {prefs.googleCalendar ? 'Verbunden' : 'Nicht verbunden'}
              </span>
              <p>
                {prefs.googleCalendar
                  ? `Einladungen gehen an ${user?.email || 'Ihre Konto-E-Mail'}. Speichern Sie einen Termin oder eine Wiedervorlage erneut, damit der Eintrag im Kalender erscheint.`
                  : 'Nicht verbunden. Termine bleiben nur im Portal — ohne Einladung an Google Kalender.'}
              </p>
            </div>
            <button
              type="button"
              className={prefs.googleCalendar ? 'btn btn-outline' : 'btn btn-primary'}
              disabled={saving}
              onClick={async () => {
                const next = !prefs.googleCalendar;
                const ok = await applyPrefs({ googleCalendar: next });
                if (ok) {
                  showToast(next
                    ? 'Google Kalender ist verbunden.'
                    : 'Google Kalender wurde getrennt.');
                }
              }}
            >
              {prefs.googleCalendar ? 'Verbindung trennen' : 'Google Kalender verbinden'}
            </button>
          </div>
        </section>

        <section className="broker-settings-section">
          <header>
            <h3>
              <span className="broker-settings-section__icon" aria-hidden="true">
                <Cookie size={16} strokeWidth={2.2} />
              </span>
              Datenschutz
            </h3>
            <p>Notwendige Cookies bleiben immer aktiv. Statistik und Marketing können Sie abwählen.</p>
          </header>
          <div className="broker-setting-rows">
            <SettingSwitch
              id="setting-cookie-necessary"
              checked
              disabled
              onChange={() => {}}
              label="Notwendig"
              hint="Anmeldung, Sicherheit und grundlegende Funktionen."
            />
            <SettingSwitch
              id="setting-cookie-analytics"
              checked={Boolean(cookies.analytics)}
              onChange={(checked) => toggleCookie('analytics', checked)}
              label="Statistik"
              hint="Hilft uns zu verstehen, wie das Portal genutzt wird."
            />
            <SettingSwitch
              id="setting-cookie-marketing"
              checked={Boolean(cookies.marketing)}
              onChange={(checked) => toggleCookie('marketing', checked)}
              label="Marketing"
              hint="Optional für eingebettete Inhalte und Messung."
            />
          </div>
        </section>
      </div>
    </SettingsShell>
  );
}
