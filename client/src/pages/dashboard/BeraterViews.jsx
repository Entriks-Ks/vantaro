import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, EyeOff, FileText, Flag, LayoutGrid, List, Mail, Paperclip, Shield, Target, User, Wand2, X } from 'lucide-react';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import AddressMap from '../../components/AddressMap';
import PhoneField, { isValidMobile } from '../../components/PhoneField';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import { didGoogleMapsAuthFail, geocodeAddress, hasGoogleMapsKey, isInGermany, reverseGeocode } from '../../lib/googleMaps';
import { LEGAL_FORMS, fileToAvatarDataUrl, generatePassword, validatePassword } from '../../lib/profile';
import { firstName, formatDate, formatEuroExact, greeting, initials } from './helpers';
import {
  formatDistance,
  formatFollowUpDateTime,
  formatMonthlyPremium,
  formatOccupationSituation,
  getReportWindow,
  insuranceStatusLabel,
  LEAD_REPORT_DETAIL_MIN,
  LEAD_REPORT_REASONS,
  LEAD_REPORT_WINDOW_DAYS,
  LEAD_STATUSES,
  LEADS,
  leadDeliveredAt,
  leadStreet,
  mainConcernLabel,
  personGroupLabel,
  PRODUCT_FILTERS,
  leadById,
  reportReasonLabel,
  reportStatusMeta,
  statusLabel,
  VIEW_MODES,
} from './leads';
import { MIN_LEAD_PACK, PACKAGES, packageById, packTotalCents } from './packages';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function buildCalendarDays(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days = [];

  for (let i = 0; i < startOffset; i += 1) {
    days.push(null);
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }
  return days;
}

function isFollowUpValid(date, time) {
  if (!date || !time) return false;
  const todayKey = toDateKey(startOfToday());
  if (date < todayKey) return false;
  if (date === todayKey) {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const selected = new Date();
    selected.setHours(hours, minutes, 0, 0);
    return selected > now;
  }
  return true;
}

function FollowUpCalendar({ savedFollowUp, onSave }) {
  const todayKey = toDateKey(startOfToday());
  const savedDate = savedFollowUp?.date || '';
  const savedTime = savedFollowUp?.time || '';
  const [viewDate, setViewDate] = useState(() => (
    savedDate ? new Date(`${savedDate}T12:00:00`) : new Date()
  ));
  const [selectedDate, setSelectedDate] = useState(savedDate);
  const [selectedTime, setSelectedTime] = useState(savedTime || '10:00');

  useEffect(() => {
    setSelectedDate(savedDate);
    setSelectedTime(savedTime || '10:00');
    if (savedDate) {
      setViewDate(new Date(`${savedDate}T12:00:00`));
    }
  }, [savedDate, savedTime]);

  const monthLabel = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(viewDate);
  const days = buildCalendarDays(viewDate);
  const canSave = isFollowUpValid(selectedDate, selectedTime);

  function shiftMonth(delta) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function handleSave() {
    if (!canSave) return;
    onSave(selectedDate, selectedTime);
  }

  return (
    <div className="broker-calendar">
      <div className="broker-calendar-nav">
        <button type="button" className="broker-calendar-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">
          <ChevronLeft size={16} />
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" className="broker-calendar-nav-btn" onClick={() => shiftMonth(1)} aria-label="N├ñchster Monat">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="broker-calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="broker-calendar-grid">
        {days.map((day, index) => {
          if (!day) {
            return <span key={`empty-${index}`} className="broker-calendar-day is-empty" />;
          }
          const key = toDateKey(day);
          const isPast = key < todayKey;
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          return (
            <button
              key={key}
              type="button"
              className={[
                'broker-calendar-day',
                isPast ? 'is-past' : '',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              disabled={isPast}
              onClick={() => setSelectedDate(key)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="broker-calendar-time">
        <label htmlFor="followUpTime">
          <Clock size={15} aria-hidden="true" />
          <span>Uhrzeit</span>
        </label>
        <input
          id="followUpTime"
          type="time"
          step="900"
          value={selectedTime}
          onChange={(event) => setSelectedTime(event.target.value)}
        />
      </div>

      {savedDate && savedTime ? (
        <div className="broker-calendar-saved">
          <Check size={15} aria-hidden="true" />
          <span>
            R├╝ckruf geplant: <strong>{formatFollowUpDateTime(savedDate, savedTime)}</strong>
          </span>
        </div>
      ) : null}

      {!canSave && selectedDate && selectedTime ? (
        <p className="broker-calendar-hint">Bitte eine Uhrzeit in der Zukunft w├ñhlen.</p>
      ) : null}

      <button
        type="button"
        className="btn btn-primary broker-calendar-save"
        disabled={!canSave}
        onClick={handleSave}
      >
        {savedDate ? 'Wiedervorlage aktualisieren' : 'Wiedervorlage speichern'}
      </button>
    </div>
  );
}

function LeadReportPanel({ leadId, leadName, lead, report, onReport }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [grundId, setGrundId] = useState('');
  const [begruendung, setBegruendung] = useState('');
  const [proofName, setProofName] = useState('');
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const detailRef = useRef(null);
  const lastClickRef = useRef({ id: '', at: 0 });

  const windowInfo = useMemo(
    () => getReportWindow(leadDeliveredAt(lead)),
    [lead],
  );

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTarget = closeBtnRef.current || panelRef.current;
    window.requestAnimationFrame(() => focusTarget?.focus?.());

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && step === 2) {
      window.requestAnimationFrame(() => detailRef.current?.focus?.());
    }
  }, [open, step]);

  function closeModal() {
    setOpen(false);
    setStep(1);
    setGrundId('');
    setBegruendung('');
    setProofName('');
  }

  function goToStep2() {
    if (!grundId) return;
    setStep(2);
  }

  function selectReason(id) {
    setGrundId(id);
    const now = Date.now();
    const prev = lastClickRef.current;
    if (prev.id === id && now - prev.at < 450) {
      lastClickRef.current = { id: '', at: 0 };
      setStep(2);
      return;
    }
    lastClickRef.current = { id, at: now };
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (step === 1) {
      goToStep2();
      return;
    }
    if (!grundId || begruendung.trim().length < LEAD_REPORT_DETAIL_MIN) return;
    const result = onReport(grundId, begruendung.trim(), proofName);
    if (result?.ok !== false) {
      closeModal();
    }
  }

  function handleProof(event) {
    const file = event.target.files?.[0];
    setProofName(file ? file.name : '');
    event.target.value = '';
  }

  const selectedReason = LEAD_REPORT_REASONS.find((reason) => reason.id === grundId);
  const detailLen = begruendung.trim().length;
  const canContinue = Boolean(grundId);
  const canSubmit = Boolean(grundId && detailLen >= LEAD_REPORT_DETAIL_MIN);
  const statusMeta = report ? reportStatusMeta(report.status || 'in_pruefung') : null;

  if (report) {
    return (
      <div className="broker-detail-side-block broker-detail-report-block is-submitted">
        <div className={`broker-detail-report-done broker-detail-report-done--${report.status || 'in_pruefung'}`}>
          <span className="broker-detail-report-done-icon" aria-hidden="true">
            <Check size={18} />
          </span>
          <div>
            <strong>{statusMeta.label}</strong>
            <span>{statusMeta.hint}</span>
            <span>{formatDate(report.at)} ┬À {reportReasonLabel(report.reasonId)}</span>
            {report.detail ? <em>ÔÇ×{report.detail}"</em> : null}
            {report.proofName ? (
              <small className="broker-report-proof-chip">
                <Paperclip size={12} />
                {report.proofName}
              </small>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (!windowInfo.open) {
    return (
      <div className="broker-detail-side-block broker-detail-report-block">
        <div className="broker-report-closed">
          <strong>Reklamationsfrist abgelaufen</strong>
          <span>
            Meldung war {LEAD_REPORT_WINDOW_DAYS} Tage nach ├£bergabe m├Âglich
            {windowInfo.deadline ? ` (bis ${formatDate(windowInfo.deadline)})` : ''}.
          </span>
        </div>
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
            <small>
              Noch {windowInfo.daysLeft} {windowInfo.daysLeft === 1 ? 'Tag' : 'Tage'} ┬À Storno oder Ersatz pr├╝fen lassen
            </small>
          </span>
          <ChevronRight size={16} className="broker-report-trigger-caret" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div className="broker-modal broker-report-modal-wrap" role="dialog" aria-modal="true" aria-labelledby={`report-modal-title-${leadId}`}>
          <button type="button" className="broker-modal__backdrop" aria-label="Schlie├ƒen" onClick={closeModal} />
          <form
            ref={panelRef}
            className={`broker-modal__panel broker-report-modal${step === 2 ? ' is-step-2' : ''}`}
            onSubmit={handleSubmit}
          >
            <div className="broker-report-modal__head">
              <div className="broker-report-modal__intro">
                <span className="broker-report-modal__badge">Reklamation</span>
                <h2 id={`report-modal-title-${leadId}`}>Lead reklamieren</h2>
                {leadName ? <p className="broker-report-modal__lead">{leadName}</p> : null}
                {step === 1 ? (
                  <p className="broker-report-modal__hint">
                    Nur bei nachweisbaren M├ñngeln. Frist: noch {windowInfo.daysLeft}{' '}
                    {windowInfo.daysLeft === 1 ? 'Tag' : 'Tage'}
                    {windowInfo.deadline ? ` (bis ${formatDate(windowInfo.deadline)})` : ''}.
                  </p>
                ) : null}
                <div className="broker-report-progress" aria-label={`Schritt ${step} von 2`}>
                  <span className={step === 1 ? 'is-current' : 'is-done'}>
                    <span>1</span>
                    Grund
                  </span>
                  <span aria-hidden="true" className={`broker-report-progress__rail${step > 1 ? ' is-done' : ''}`} />
                  <span className={step === 2 ? 'is-current' : ''}>
                    <span>2</span>
                    Begr├╝ndung
                  </span>
                </div>
              </div>
              <button
                type="button"
                ref={closeBtnRef}
                className="broker-report-close"
                onClick={closeModal}
                aria-label="Schlie├ƒen"
              >
                <X size={18} />
              </button>
            </div>

            <div className="broker-report-modal__body">
              {step === 1 ? (
                <section className="broker-report-step">
                  <div className="broker-report-step__copy">
                    <h3>Grund w├ñhlen</h3>
                    <p>Doppelklick oder Auswahl + Weiter ÔÇö akzeptierte Gr├╝nde laut Richtlinie</p>
                  </div>
                  <div className="broker-report-reasons" role="radiogroup" aria-label="Grund der Reklamation">
                    {LEAD_REPORT_REASONS.map((reason) => {
                      const selected = grundId === reason.id;
                      return (
                        <label
                          key={reason.id}
                          className={selected ? 'is-selected' : undefined}
                          tabIndex={0}
                          role="radio"
                          aria-checked={selected}
                          onClick={(event) => {
                            event.preventDefault();
                            selectReason(reason.id);
                          }}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            setGrundId(reason.id);
                            setStep(2);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              selectReason(reason.id);
                            }
                          }}
                        >
                          <input
                            type="radio"
                            className="broker-report-reason-input"
                            name={`report-grund-${leadId}`}
                            value={reason.id}
                            checked={selected}
                            onChange={() => setGrundId(reason.id)}
                            tabIndex={-1}
                          />
                          <span className="broker-report-reason-card">
                            <span className="broker-report-reason-check" aria-hidden="true">
                              {selected ? <Check size={14} strokeWidth={2.5} /> : null}
                            </span>
                            <span className="broker-report-reason-copy">
                              <strong>{reason.label}</strong>
                              <small>{reason.description}</small>
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
                    <h3>Begr├╝ndung</h3>
                    <p>Was ist beim Kontaktversuch passiert? Mindestens {LEAD_REPORT_DETAIL_MIN} Zeichen.</p>
                  </div>
                  {selectedReason ? (
                    <button
                      type="button"
                      className="broker-report-chosen"
                      onClick={() => setStep(1)}
                    >
                      <span>
                        <small>Gew├ñhlter Grund</small>
                        <strong>{selectedReason.label}</strong>
                      </span>
                      <em>├ändern</em>
                    </button>
                  ) : null}
                  <label className="broker-report-detail-field" htmlFor={`report-detail-${leadId}`}>
                    <span>Ihre Beschreibung</span>
                    <textarea
                      id={`report-detail-${leadId}`}
                      ref={detailRef}
                      className="broker-report-detail"
                      value={begruendung}
                      onChange={(event) => setBegruendung(event.target.value)}
                      placeholder="z. B. Nummer ist nicht vergeben, Anruf wird sofort beendet, Person kennt die Anfrage nicht ÔÇª"
                      rows={6}
                      required
                      minLength={LEAD_REPORT_DETAIL_MIN}
                    />
                    <span className={`broker-report-detail-meta${detailLen < LEAD_REPORT_DETAIL_MIN ? ' is-short' : ' is-ok'}`}>
                      <strong>{detailLen}</strong>
                      <span>/</span>
                      <span>{LEAD_REPORT_DETAIL_MIN}</span>
                      <em>Zeichen min.</em>
                    </span>
                  </label>
                  <div className="broker-report-proof">
                    <span className="broker-report-proof__label">Nachweis (optional)</span>
                    <label className="broker-report-proof__btn" htmlFor={`report-proof-${leadId}`}>
                      <input
                        id={`report-proof-${leadId}`}
                        type="file"
                        accept="image/*,.pdf,.txt"
                        onChange={handleProof}
                      />
                      <Paperclip size={16} />
                      <span>{proofName || 'Datei anh├ñngen'}</span>
                    </label>
                    {proofName ? (
                      <button
                        type="button"
                        className="broker-text-btn"
                        onClick={() => setProofName('')}
                      >
                        Entfernen
                      </button>
                    ) : null}
                  </div>
                </section>
              )}
            </div>

            <div className="broker-report-modal__footer">
              <div className={`broker-report-actions${step === 2 ? ' is-split' : ''}`}>
                {step === 1 ? (
                  <button type="button" className="btn btn-outline" onClick={closeModal}>
                    Abbrechen
                  </button>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                    Zur├╝ck
                  </button>
                )}
                {step === 1 ? (
                  <button type="submit" className="btn btn-primary" disabled={!canContinue}>
                    Weiter
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                    Reklamation einreichen
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function DetailSection({ icon: Icon, title, children }) {
  return (
    <section className="broker-panel broker-detail-section">
      <div className="broker-detail-section-head">
        <span className="broker-detail-section-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <h2>{title}</h2>
      </div>
      <div className="broker-detail-fields">
        {children}
      </div>
    </section>
  );
}

function DetailField({ label, children }) {
  return (
    <div className="broker-detail-field">
      <span className="broker-detail-field-label">{label}</span>
      <div className="broker-detail-field-value">{children}</div>
    </div>
  );
}

export function BeraterHome() {
  const { user } = useAuth();
  const { purchased, leadStatuses } = useBroker();

  const stats = useMemo(() => {
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s.id, 0]));
    purchased.forEach((lead) => {
      const status = leadStatuses[String(lead.id)] || lead.status || 'neu';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    return {
      total: purchased.length,
      neu: byStatus.neu || 0,
      kontaktiert: byStatus.kontaktiert || 0,
      termin: byStatus.termin || 0,
      abgeschlossen: byStatus.abgeschlossen || 0,
      wiedervorlage: byStatus.wiedervorlage || 0,
    };
  }, [purchased, leadStatuses]);

  const recent = purchased.slice(0, 5);

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Lead-├£bersicht</div>
          <h1>{greeting()}, <em>{firstName(user)}</em></h1>
          <p className="lede">Pipeline und Bestand Ihrer Chancen ÔÇö ohne Zahlungsfokus.</p>
        </div>
      </div>

      <div className="broker-home-metrics broker-home-metrics--leads">
        <div className="broker-home-metric is-signal">
          <span>Im Bestand</span>
          <strong>{stats.total}</strong>
          <small>Aktive Leads</small>
        </div>
        <div className="broker-home-metric">
          <span>Neu</span>
          <strong>{stats.neu}</strong>
          <small>Noch nicht kontaktiert</small>
        </div>
        <div className="broker-home-metric">
          <span>In Bearbeitung</span>
          <strong>{stats.kontaktiert + stats.termin}</strong>
          <small>{stats.kontaktiert} kontaktiert ┬À {stats.termin} Termin</small>
        </div>
        <div className="broker-home-metric">
          <span>Abgeschlossen</span>
          <strong>{stats.abgeschlossen}</strong>
          <small>Vorg├ñnge beendet</small>
        </div>
      </div>

      <div className="broker-home-actions">
        <Link className="btn btn-primary" to="/dashboard/leads">Zu Meine Leads</Link>
        <Link className="btn btn-outline" to="/dashboard/leads">Kanban ├Âffnen</Link>
      </div>

      <section className="broker-panel broker-home-recent">
        <div className="broker-panel-header">
          <div>
            <h2>Aktuelle Leads</h2>
            <p>Schnellzugriff auf Ihren Bestand</p>
          </div>
          <Link to="/dashboard/leads" className="broker-text-btn">Alle anzeigen</Link>
        </div>
        {recent.length ? (
          <ul className="broker-home-lead-list">
            {recent.map((lead) => (
              <li key={lead.id}>
                <Link to={`/dashboard/leads/${lead.id}`}>
                  <span>
                    <strong>{lead.name}</strong>
                    <small>{lead.product} ┬À {statusLabel(lead.status)}</small>
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

function LeadCard({ lead, onOpen, dragging, onDragStart, onDragEnd }) {
  const draggedRef = useRef(false);

  return (
    <article
      className={[
        'broker-panel',
        'broker-lead-card',
        'is-clickable',
        dragging ? 'is-dragging' : '',
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={(event) => {
        draggedRef.current = true;
        event.dataTransfer.setData('text/plain', String(lead.id));
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(lead.id);
      }}
      onDragEnd={() => {
        onDragEnd();
        window.setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (draggedRef.current) return;
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
          <div className="broker-lead-address">Ôîû {lead.address}</div>
        </div>
        <span className="broker-status">{statusLabel(lead.status)}</span>
      </div>
      <div className="broker-lead-meta">
        <span>{formatDistance(lead.distanceKm)} entfernt</span>
        <span>{lead.product}</span>
        <span>{lead.quality || 'Exklusiv'}</span>
      </div>
      <p className="broker-lead-note">{lead.note}</p>
      <div className="broker-lead-bottom">
        <div className="broker-lead-price">
          {formatEuroExact(lead.priceCents)}
          <span>bezahlt</span>
        </div>
        <span className="broker-muted-action">Details ├Âffnen</span>
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
      <span className="broker-list-meta">{lead.product}</span>
      <span className="broker-list-meta">{lead.quality}</span>
      <span className={`broker-status broker-status--${lead.status}`}>{statusLabel(lead.status)}</span>
      <span className="broker-list-price">{formatEuroExact(lead.priceCents)}</span>
    </button>
  );
}

export function BeraterLeads() {
  const navigate = useNavigate();
  const { purchasedIds, leadStatuses, setLeadStatus } = useBroker();
  const [product, setProduct] = useState('all');
  const [view, setView] = useState('kanban');
  const [page, setPage] = useState(1);
  const [draggingLeadId, setDraggingLeadId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const pageSize = 6;

  const visible = useMemo(() => (
    LEADS
      .filter((lead) => purchasedIds.includes(lead.id))
      .filter((lead) => product === 'all' || lead.product === product)
      .map((lead) => ({
        ...lead,
        status: leadStatuses[String(lead.id)] || 'neu',
      }))
  ), [product, purchasedIds, leadStatuses]);

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

  function handleDragStart(leadId) {
    setDraggingLeadId(leadId);
  }

  function handleDragEnd() {
    setDraggingLeadId(null);
    setDropTargetId(null);
  }

  function handleDrop(statusId, event) {
    event.preventDefault();
    const leadId = Number(event.dataTransfer.getData('text/plain'));
    if (!leadId) return;
    setLeadStatus(leadId, statusId);
    handleDragEnd();
  }
  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Gekaufte Chancen</div>
          <h1>Meine <em>Leads</em></h1>
          <p className="lede">Kanban per Drag &amp; Drop ÔÇö oder klicken Sie einen Lead f├╝r alle Details.</p>
        </div>
      </div>

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
        <span className="broker-filter-count">{visible.length} in Ihrem Bestand</span>
      </div>

      {!visible.length ? (
        <div className="broker-panel broker-empty">
          <strong>Noch keine Leads gekauft</strong>
          <p>Sobald Sie eine Chance ├╝bernehmen, erscheint sie hier in Ihrem Bestand.</p>
        </div>
      ) : view === 'list' ? (
        <>
          <div className="broker-panel broker-list-panel">
            <div className="broker-list-head" aria-hidden="true">
              <span>Kontakt</span>
              <span>Produkt</span>
              <span>Qualit├ñt</span>
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
                Zur├╝ck
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
            const isDropTarget = dropTargetId === column.id && draggingLeadId !== null;
            return (
              <section
                key={column.id}
                className={[
                  'broker-kanban-column',
                  isDropTarget ? 'is-drop-target' : '',
                ].filter(Boolean).join(' ')}
              >
                <header>
                  <div>
                    <strong>{column.label}</strong>
                    <small>{column.hint}</small>
                  </div>
                  <span className="broker-count">{items.length}</span>
                </header>
                <div
                  className={[
                    'broker-kanban-stack',
                    isDropTarget ? 'is-drop-target' : '',
                  ].filter(Boolean).join(' ')}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDropTargetId(column.id);
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget)) return;
                    setDropTargetId((current) => (current === column.id ? null : current));
                  }}
                  onDrop={(event) => handleDrop(column.id, event)}
                >
                  {items.length ? items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      dragging={draggingLeadId === lead.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onOpen={openLead}
                    />
                  )) : (
                    <div className="broker-kanban-empty">
                      {isDropTarget ? 'Hier ablegen' : 'Keine Leads'}
                    </div>
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
  const {
    purchasedIds,
    leadStatuses,
    leadNotes,
    leadFollowUps,
    leadReports,
    setLeadStatus,
    setLeadNotes,
    setLeadFollowUp,
    reportLead,
  } = useBroker();
  const lead = leadById(leadId);
  const owned = lead && purchasedIds.includes(lead.id);
  const status = lead ? (leadStatuses[String(lead.id)] || 'neu') : 'neu';
  const savedNotes = lead ? (leadNotes[String(lead.id)] || '') : '';
  const followUp = lead ? leadFollowUps[String(lead.id)] : null;
  const report = lead ? leadReports[String(lead.id)] : null;
  const [notes, setNotes] = useState(savedNotes);

  useEffect(() => {
    setNotes(savedNotes);
  }, [lead?.id, savedNotes]);

  if (!lead || !owned) {
    return <Navigate to="/dashboard/leads" replace />;
  }

  function saveNotes() {
    if (notes !== savedNotes) {
      setLeadNotes(lead.id, notes);
    }
  }

  function handleReportLead(grundId, begruendung, proofName) {
    return reportLead(lead.id, grundId, begruendung, proofName);
  }

  return (
    <div className="broker-page">
      <button type="button" className="broker-back" onClick={() => navigate('/dashboard/leads')}>
        <ArrowLeft size={16} />
        Zur├╝ck zu Meine Leads
      </button>

      <div className="broker-heading broker-detail-heading">
        <div>
          <div className="eyebrow">Lead-Details</div>
          <h1>{lead.name}</h1>
          <p className="lede">{leadStreet(lead)}, {lead.zip} {lead.city}</p>
        </div>
        <span className={`broker-status broker-status--lg broker-status--${status}`}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="broker-detail-grid">
        <div className="broker-detail-sections">
          <DetailSection icon={User} title="Pers├Ânliche Daten">
            <DetailField label="Vor- und Nachname">{lead.name}</DetailField>
            <DetailField label="Geburtsdatum">{formatDate(lead.dateOfBirth)}</DetailField>
            <DetailField label="Adresse">{leadStreet(lead)}</DetailField>
            <DetailField label="PLZ / Ort">
              {lead.zip && lead.city ? `${lead.zip} ${lead.city}` : 'ÔÇö'}
            </DetailField>
          </DetailSection>

          <DetailSection icon={Mail} title="Kontakt">
            <DetailField label="E-Mail">
              <a href={`mailto:${lead.email}`}>{lead.email}</a>
            </DetailField>
            <DetailField label="Mobil / Telefon">
              <a href={`tel:${lead.phone.replace(/\s/g, '')}`}>{lead.phone}</a>
            </DetailField>
          </DetailSection>

          <DetailSection icon={Briefcase} title="Berufliche Situation">
            <DetailField label="Situation">{formatOccupationSituation(lead)}</DetailField>
          </DetailSection>

          <DetailSection icon={Shield} title="Versicherung">
            <DetailField label="Versicherungsstatus">{insuranceStatusLabel(lead.insuranceStatus)}</DetailField>
            <DetailField label="Aktuelle Gesellschaft / Krankenkasse">{lead.insuranceCompany || 'ÔÇö'}</DetailField>
            <DetailField label="Monatlicher Beitrag">{formatMonthlyPremium(lead.monthlyPremiumEuro)}</DetailField>
            <DetailField label="Personenkreis">{personGroupLabel(lead.personGroup)}</DetailField>
          </DetailSection>

          <DetailSection icon={Target} title="Hauptanliegen">
            <DetailField label="Anliegen">{mainConcernLabel(lead.mainConcern)}</DetailField>
          </DetailSection>
        </div>

        <aside className="broker-detail-side-stack">
          <section className="broker-panel broker-detail-side">
            <div className="broker-detail-side-block">
              <h2>Bearbeitungsstatus</h2>
              <p className="broker-detail-side-hint">Pipeline-Status f├╝r diesen Lead.</p>
              <div className="broker-status-picker">
                {LEAD_STATUSES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      status === option.id ? 'is-active' : '',
                      option.id === 'wiedervorlage' ? 'is-wiedervorlage' : '',
                    ].filter(Boolean).join(' ') || undefined}
                    onClick={() => setLeadStatus(lead.id, option.id)}
                  >
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </button>
                ))}
              </div>

              {status === 'wiedervorlage' ? (
                <div className={`broker-status-followup${followUp ? ' is-set' : ''}`}>
                  <p className="broker-status-followup-label">R├╝ckruf planen</p>
                  <FollowUpCalendar
                    savedFollowUp={followUp}
                    onSave={(date, time) => setLeadFollowUp(lead.id, date, time)}
                  />
                </div>
              ) : null}
            </div>

            <LeadReportPanel
              leadId={lead.id}
              leadName={lead.name}
              lead={lead}
              report={report}
              onReport={handleReportLead}
            />

            <div className="broker-detail-side-block">
              <h2>Notizen</h2>
              <p className="broker-detail-side-hint">Eigene Notizen ÔÇö nur f├╝r Sie sichtbar.</p>
              <textarea
                className="broker-detail-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={saveNotes}
                placeholder="z. B. R├╝ckruf vereinbart, offene Fragen, n├ñchste SchritteÔÇª"
                rows={5}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}


export function BeraterPayments() {
  const { user } = useAuth();
  const {
    invoices,
    activePackageId,
    selectPackage,
    buyLeadPack,
    leadQuota,
    leadsUsed,
    leadsRemaining,
    quotaLabel,
    activePackage,
  } = useBroker();
  const [qtyByPackage, setQtyByPackage] = useState(() => (
    Object.fromEntries(PACKAGES.map((pkg) => [pkg.id, MIN_LEAD_PACK]))
  ));
  const [checkout, setCheckout] = useState(null);
  const [paying, setPaying] = useState(false);

  const progressPct = leadQuota ? Math.min(100, Math.round((leadsUsed / leadQuota) * 100)) : 0;
  const company = user?.profile?.company || 'ÔÇö';
  const billingEmail = user?.email || 'ÔÇö';
  const customerNumber = user?.customerNumber || 'ÔÇö';
  const billingName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || user?.fullName
    || 'ÔÇö';
  const checkoutPkg = checkout ? packageById(checkout.packageId) : null;
  const checkoutQty = checkout?.qty || MIN_LEAD_PACK;
  const checkoutNet = checkoutPkg ? packTotalCents(checkoutPkg, checkoutQty) : 0;
  const checkoutTax = Math.round(checkoutNet * 0.19);
  const checkoutGross = checkoutNet + checkoutTax;

  const setQty = (packageId, next) => {
    const value = Math.max(MIN_LEAD_PACK, Math.round(Number(next) / MIN_LEAD_PACK) * MIN_LEAD_PACK);
    setQtyByPackage((prev) => ({ ...prev, [packageId]: value }));
  };

  const confirmPay = async () => {
    if (!checkoutPkg || paying) return;
    setPaying(true);
    try {
      const result = buyLeadPack(checkout.packageId, checkout.qty);
      if (result?.ok) setCheckout(null);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="broker-page">
      <div className="broker-heading broker-billing-heading">
        <div>
          <div className="eyebrow">Billing</div>
          <h1>Zah<em>lung</em></h1>
          <p className="lede">
            Kontingent, Pl├ñne und Rechnungen ÔÇö wie in einem professionellen Berater-Billing-Portal.
            Mindestabnahme {MIN_LEAD_PACK} Leads.
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
          <p>{leadsUsed} zugewiesen ┬À {leadsRemaining} noch verf├╝gbar</p>
          <div className="broker-quota-bar broker-quota-bar--light" aria-hidden="true">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <small>Freie Pl├ñtze = bezahlt, noch nicht zugewiesen</small>
        </article>

        <article className="broker-panel broker-billing-card">
          <span className="broker-billing-kicker">Aktueller Plan</span>
          <strong className="broker-billing-metric-text">{activePackage?.label || 'Kein Plan'}</strong>
          <p>{activePackage?.title || 'W├ñhlen Sie ein Paket unten.'}</p>
          <small>Mindestabnahme {MIN_LEAD_PACK} Leads</small>
        </article>

        <article className="broker-panel broker-billing-card">
          <span className="broker-billing-kicker">Rechnung an</span>
          <strong className="broker-billing-metric-text">{company}</strong>
          <p>{billingName}</p>
          <small>{billingEmail} ┬À Kd.-Nr. {customerNumber}</small>
        </article>
      </div>

      <section className="broker-billing-section">
        <div className="broker-billing-section-head">
          <div>
            <h2>Pl├ñne</h2>
            <p>Menge w├ñhlen ÔÇö Checkout wie bei bekannten SaaS-Portalen (Testmodus).</p>
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
                    <span>Preis / Lead</span>
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
                      ÔêÆ
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
                    onClick={() => setCheckout({ packageId: pkg.id, qty })}
                  >
                    Weiter zur Zahlung ┬À {qty} Leads
                  </button>
                  {!active ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => selectPackage(pkg.id)}
                    >
                      Als Plan setzen
                    </button>
                  ) : (
                    <span className="broker-package-active">Aktiver Plan</span>
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
          <div className="broker-checkout-panel">
            <div className="broker-checkout-brand">VANTARO ┬À Testmodus</div>
            <h2 id="checkout-title">Zahlung best├ñtigen</h2>
            <p>
              Sie zahlen <strong>{formatEuroExact(checkoutGross)}</strong> f├╝r{' '}
              <strong>{checkoutPkg.label}</strong> ({checkoutQty} Leads).
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
            <p className="broker-checkout-note">
              Testzahlung ÔÇö erstellt sofort eine bezahlte Rechnung mit Ihren Kontodaten (kein echtes Geld).
            </p>
            <div className="broker-checkout-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={paying}
                onClick={() => setCheckout(null)}
              >
                Zur├╝ck
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={paying}
                onClick={confirmPay}
              >
                {paying ? 'Wird gebuchtÔÇª' : `Jetzt zahlen ┬À ${formatEuroExact(checkoutGross)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="broker-panel broker-invoice-panel">
        <div className="broker-panel-header">
          <div>
            <h2>Rechnungen</h2>
            <p>Bezahlte Rechnungen ÔÇö PDF-Download folgt in K├╝rze</p>
          </div>
        </div>

        {invoices.length ? (
          <div className="broker-invoice-table-wrap">
            <table className="broker-invoice-table">
              <thead>
                <tr>
                  <th>Rechnung</th>
                  <th>Datum</th>
                  <th>Beschreibung</th>
                  <th>Status</th>
                  <th>Betrag</th>
                  <th aria-label="Aktion" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const net = Math.abs(invoice.cents || 0);
                  const tax = invoice.taxCents || Math.round(net * 0.19);
                  const gross = net + tax;
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <span className="broker-invoice-id">
                          <FileText size={14} />
                          {invoice.number}
                        </span>
                      </td>
                      <td>{formatDate(invoice.at)}</td>
                      <td>
                        <strong>{invoice.label}</strong>
                        <small>{invoice.leads} Leads</small>
                      </td>
                      <td>
                        <span className="broker-invoice-status is-paid">Paid</span>
                      </td>
                      <td>
                        <strong>{formatEuroExact(gross)}</strong>
                        <small>inkl. MwSt.</small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="broker-invoice-download"
                          disabled
                          title="PDF-Download ist noch nicht verf├╝gbar"
                        >
                          <FileText size={14} />
                          Demn├ñchst
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Rechnungen</strong>
            <p>Nach dem ersten Paketkauf erscheinen Rechnungen hier.</p>
          </div>
        )}
      </section>

      <p className="broker-muted-note">
        Richtwerte zzgl. MwSt. ÔÇö abh├ñngig von Qualit├ñtsstufe, Region und Vereinbarung.
        Ein Lead ist kein garantierter Abschluss. Bankverbindung und PDF-Download folgen sp├ñter.
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
  GmbH: 'Gesellschaft mit beschr├ñnkter Haftung',
  'UG (haftungsbeschr├ñnkt)': 'Unternehmergesellschaft',
  AG: 'Aktiengesellschaft',
  'e.K.': 'Eingetragener Kaufmann / Kauffrau',
  GbR: 'Gesellschaft b├╝rgerlichen Rechts',
  OHG: 'Offene Handelsgesellschaft',
  KG: 'Kommanditgesellschaft',
  PartG: 'Partnerschaftsgesellschaft',
  'Freiberufler / Einzelunternehmen': 'Selbstst├ñndig ohne Gesellschaft',
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
            <span className="broker-legal-select__placeholder">Bitte w├ñhlen</span>
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
      setError('Die Passw├Ârter stimmen nicht ├╝berein.');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, password });
      showToast('Passwort wurde ge├ñndert');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="pw-modal-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schlie├ƒen" onClick={onClose} />
      <form className="broker-modal__panel broker-pw-modal" onSubmit={submit}>
        <div className="broker-pw-modal__head">
          <div>
            <h2 id="pw-modal-title">Passwort ├ñndern</h2>
            <p>Geben Sie Ihr aktuelles Passwort ein und w├ñhlen Sie ein neues.</p>
          </div>
          <button type="button" className="broker-pw-modal__close" onClick={onClose} aria-label="Schlie├ƒen">
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
            <span>Passwort best├ñtigen</span>
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
            {saving ? 'Wird gespeichertÔÇª' : 'Passwort ├ñndern'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Pers├Ânliche Daten: Bild, Name, E-Mail, Telefon */
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
      setError('Bitte geben Sie eine g├╝ltige Telefonnummer an.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(form);
      setAvatarName('');
      showToast('Pers├Ânliche Daten gespeichert');
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
      lede="Ihre pers├Ânlichen Daten: Bild, Name, E-Mail und Telefonnummer."
    >
      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <h2>Pers├Ânliche Daten</h2>
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
              <p className="broker-avatar-soft-hint">Optional ÔÇö ein Foto macht Ihr Konto pers├Ânlicher.</p>
            ) : null}
            <label className="broker-file-btn" htmlFor="profile-avatar">
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatar}
                disabled={saving}
              />
              <span>Bild ausw├ñhlen</span>
              <small>{avatarName || (form.avatarUrl ? 'Aktuelles Bild behalten' : 'Optional')}</small>
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
          {saving ? 'Wird gespeichertÔÇª' : 'Profil speichern'}
        </button>
      </form>
    </SettingsShell>
  );
}

export function BeraterCompany() {
  const { user, updateProfile, isAdmin } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState(() => companyForm(user));
  const [mapPin, setMapPin] = useState({ lat: null, lng: null });
  const [mapNotice, setMapNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const needsPhone = !String(user?.phone || '').trim();
  const req = !isAdmin;
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
  const setupIncomplete = !isAdmin && missingLive.length > 0;
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
            setMapNotice('Kartensuche vor├╝bergehend nicht verf├╝gbar ÔÇö Adresse bitte manuell eintragen.');
            return;
          }
          setMapNotice(err?.message || 'Geocoding fehlgeschlagen.');
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
      setMapNotice('Nur Standorte in Deutschland ÔÇö ├ûsterreich ist nicht erlaubt.');
      return;
    }

    const previousPin = mapPin;
    setMapNotice('Adresse wird ermitteltÔÇª');

    try {
      const place = await reverseGeocode(lat, lng);
      if (!place) {
        setMapNotice('Keine Adresse an diesem Punkt gefunden.');
        return;
      }
      if (!place.inGermany) {
        setMapPin(previousPin);
        setMapNotice('Nur Standorte in Deutschland ÔÇö ├ûsterreich und andere L├ñnder sind nicht erlaubt.');
        return;
      }
      applyPlaceToForm(place);
      setMapNotice('');
    } catch (err) {
      setMapPin(previousPin);
      if (didGoogleMapsAuthFail()) {
        setMapNotice('Kartensuche vor├╝bergehend nicht verf├╝gbar ÔÇö Adresse bitte manuell eintragen.');
        return;
      }
      setMapNotice(err?.message || 'Geocoding fehlgeschlagen.');
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');

    if (!isAdmin) {
      if (needsPhone) {
        setError('Bitte hinterlegen Sie zuerst Ihre Telefonnummer unter Profil.');
        return;
      }
      if (!form.company.trim() || !form.legalForm) {
        setError('Firmenname und Rechtsform sind erforderlich.');
        return;
      }
      if (!form.businessStreet.trim() || !form.businessZip.trim() || !form.businessCity.trim()) {
        setError('Bitte geben Sie die vollst├ñndige Gesch├ñftsadresse an.');
        return;
      }
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
        isAdmin
          ? 'Admin-Konto: Unternehmensdaten sind optional.'
          : user?.onboardingComplete
            ? 'Firma, Rechtsform und Adressen f├╝r Ihr Maklerkonto.'
            : 'Erg├ñnzen Sie Firma und Adresse ÔÇö danach ist Ihr Konto vollst├ñndig.'
      }
    >
      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <div className="broker-settings-head">
          <div>
            <h2>Unternehmensdaten{isAdmin ? ' (optional)' : ''}</h2>
            <p className="broker-muted-note">
              Angaben f├╝r Vertrag, Rechnungen und Verifizierung im Portal.
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

        {!isAdmin && needsPhone ? (
          <div className="broker-inline-hint">
            <p>Telefonnummer fehlt noch im Profil ÔÇö bitte zuerst erg├ñnzen.</p>
            <Link to="/dashboard/profil" className="broker-text-btn">
              Zum Profil
            </Link>
          </div>
        ) : null}

        {setupIncomplete && !needsPhone ? (
          <div className="broker-inline-hint broker-setup-hint">
            <p>Noch unvollst├ñndig ÔÇö Firma, Rechtsform und Adresse speichern, dann ist Ihr Konto eingerichtet.</p>
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
            <p>Name und Rechtsform f├╝r Dokumente und Anzeige.</p>
          </header>
          <div className="broker-form-grid">
            <label className={`is-full${highlightMissing && missingLive.includes('company') ? ' is-missing' : ''}`}>
              <FieldLabel required={req}>Firmenname</FieldLabel>
              <input
                name="company"
                value={form.company}
                onChange={handleChange}
                autoComplete="organization"
                placeholder="z. B. Muster Finanzberatung"
                disabled={saving}
                required={req}
              />
            </label>
            <div className={`is-full broker-field${highlightMissing && missingLive.includes('legalForm') ? ' is-missing' : ''}`}>
              <FieldLabel required={req}>Rechtsform</FieldLabel>
              <LegalFormSelect
                value={form.legalForm}
                onChange={(legalForm) => setForm((prev) => ({ ...prev, legalForm }))}
                disabled={saving}
                required={req}
              />
            </div>
          </div>
        </section>

        <section className="broker-settings-section">
          <header>
            <h3>
              {highlightMissing ? <span className="broker-step-num">2</span> : null}
              Gesch├ñftsadresse
            </h3>
            <p>Sitz Ihres Unternehmens ÔÇö Suche nutzen oder Pin auf der Karte setzen.</p>
          </header>
          <div className="broker-form-grid">
            <label className={`is-full${highlightMissing && missingLive.includes('address') ? ' is-missing' : ''}`}>
              <FieldLabel required={req}>Stra├ƒe und Hausnummer</FieldLabel>
              <AddressAutocomplete
                name="businessStreet"
                value={form.businessStreet}
                onChange={(businessStreet) => setForm((prev) => ({ ...prev, businessStreet }))}
                onPlaceSelect={(place) => {
                  applyPlaceToForm(place);
                  setMapNotice('');
                }}
                autoComplete="street-address"
                placeholder="z. B. Augsburg oder Stra├ƒe, Hausnummer"
                disabled={saving}
                required={req}
              />
            </label>
            <label className={highlightMissing && missingLive.includes('zip') ? 'is-missing' : undefined}>
              <FieldLabel required={req}>PLZ</FieldLabel>
              <input
                name="businessZip"
                value={form.businessZip}
                onChange={handleChange}
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="12345"
                disabled={saving}
                required={req}
              />
            </label>
            <label className={highlightMissing && missingLive.includes('city') ? 'is-missing' : undefined}>
              <FieldLabel required={req}>Ort</FieldLabel>
              <input
                name="businessCity"
                value={form.businessCity}
                onChange={handleChange}
                autoComplete="address-level2"
                placeholder="Berlin"
                disabled={saving}
                required={req}
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
            <h3>Online <span className="broker-optional">(optional)</span></h3>
            <p>Website Ihres Unternehmens ÔÇö ohne https:// m├Âglich.</p>
          </header>
          <div className="broker-form-grid">
            <label className="is-full">
              <FieldLabel>Website</FieldLabel>
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
          {saving ? 'Wird gespeichertÔÇª' : 'Unternehmen speichern'}
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
      lede="Passwort ├ñndern ÔÇö mit aktuellem Passwort und starken Regeln."
    >
      <section className="broker-panel broker-settings broker-settings--wide">
        <h2>Passwort</h2>
        <p className="broker-muted-note" style={{ marginTop: 8 }}>
          Mindestens 8 Zeichen, Gro├ƒ- und Kleinbuchstaben, Zahl und Sonderzeichen.
        </p>
        <button type="button" className="btn btn-primary broker-save" onClick={() => setModalOpen(true)}>
          Passwort ├ñndern
        </button>
      </section>

      <ChangePasswordModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </SettingsShell>
  );
}
