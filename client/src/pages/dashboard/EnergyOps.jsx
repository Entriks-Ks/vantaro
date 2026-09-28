import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Flag, KeyRound, Mail, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { COMPLAINT_COMMENT_MIN } from '../../lib/complaints';
import {
  ENERGY_COMPLAINT_REASONS,
  ENERGY_COMPLAINT_STATUS,
  ENERGY_DEFAULT_PAGE_IDS,
  ENERGY_PAGE_OPTIONS,
  ENERGY_ROLE_LABELS,
  ENERGY_STATUS_LABELS,
  assignEnergyHolder,
  createEnergyPartner,
  decideEnergyComplaint,
  fetchEnergyBilling,
  fetchEnergyComplaints,
  fetchEnergyPartners,
  invoiceEnergyLines,
  openEnergyComplaint,
  saveEnergyBilling,
  setEnergyOutcome,
  updateEnergyPartner,
} from '../../lib/energy';
import { energyTypeLabel, energyLeadTypeOf } from '../../lib/vertical';
import { formatDate, formatDateTime, initials } from './helpers';

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return 'nicht hinterlegt';
  return `${Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`;
}

export function EnergyLeadActions({ lead, onChange }) {
  const { user, isAdmin } = useAuth();
  const role = user?.energyRole || 'main';
  const [partners, setPartners] = useState([]);
  const [holderId, setHolderId] = useState(lead.energyHolderId || '');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role !== 'main' && role !== 'dispatcher' && !isAdmin) return undefined;
    fetchEnergyPartners().then((payload) => setPartners(payload.partners || [])).catch(() => {});
    return undefined;
  }, [role, isAdmin]);

  const run = async (task) => {
    setError('');
    setBusy(true);
    try {
      const payload = await task();
      if (payload?.lead) onChange(payload.lead);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canAssign = role === 'main' || role === 'dispatcher' || isAdmin;
  const canOutcome = role === 'field_rep' || role === 'sub_partner' || canAssign;

  return (
    <section className="broker-panel broker-detail-section">
      <div className="broker-detail-section-head">
        <div>
          <h2>Bearbeitung</h2>
          <p>Zuweisen oder den Stand setzen</p>
        </div>
      </div>
      <p>Status: {ENERGY_STATUS_LABELS[lead.energyStatus] || 'Zugewiesen'}</p>
      {error ? <div className="broker-alert">{error}</div> : null}
      {canAssign ? (
        <form className="broker-form-grid" onSubmit={(event) => {
          event.preventDefault();
          run(() => assignEnergyHolder(lead.id, holderId));
        }}>
          <label>
            An Unterpartner oder Außendienst
            <select value={holderId} onChange={(event) => setHolderId(event.target.value)} required>
              <option value="">Bitte wählen</option>
              {partners.filter((partner) => partner.active !== false).map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.fullName} · {ENERGY_ROLE_LABELS[partner.energyRole]}
                </option>
              ))}
            </select>
          </label>
          <button className="dash-btn" type="submit" disabled={busy}>Zuweisen</button>
        </form>
      ) : null}
      {canOutcome ? (
        <div className="energy-card-list">
          {[
            ['CONFIRMED', 'Start'],
            ['COMPLETED', 'Abgeschlossen'],
            ['NO_SHOW', 'Nicht erschienen'],
            ['FOLLOW_UP', 'Wiedervorlage'],
          ].map(([status, label]) => (
            <button key={status} type="button" className="dash-btn dash-btn--ghost" disabled={busy} onClick={() => run(() => setEnergyOutcome(lead.id, { status }))}>
              {label}
            </button>
          ))}
          {canAssign ? (
            <button type="button" className="dash-btn dash-btn--ghost" disabled={busy} onClick={() => run(() => setEnergyOutcome(lead.id, { status: 'CANCELLED' }))}>
              Absagen
            </button>
          ) : null}
        </div>
      ) : null}
      {lead.deliveryType === 'appointment' ? (
        <form className="broker-form-grid" onSubmit={(event) => {
          event.preventDefault();
          run(() => setEnergyOutcome(lead.id, { status: 'FOLLOW_UP', appointmentAt: new Date(when).toISOString() }));
        }}>
          <label>
            Termin verschieben
            <input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} required />
          </label>
          <button className="dash-btn" type="submit" disabled={busy}>Verschieben</button>
        </form>
      ) : null}
    </section>
  );
}

function complaintTone(status) {
  if (status === 'approved' || status === 'replacement') return 'gutgeschrieben';
  if (status === 'partial') return 'teilweise';
  if (status === 'rejected') return 'abgelehnt';
  return 'in_pruefung';
}

function shortLeadId(id) {
  const value = String(id || '');
  return value ? value.slice(0, 8).toUpperCase() : '—';
}

export function EnergyLeadReport({ lead, onChange }) {
  const { isAdmin } = useAuth();
  const complaint = lead?.complaint;
  const pending = complaint?.status === 'pending';
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const detailRef = useRef(null);
  const selected = ENERGY_COMPLAINT_REASONS.find((item) => item.id === reason);
  const detailLen = comment.trim().length;

  const closeModal = () => {
    setOpen(false);
    setStep(1);
    setReason('');
    setComment('');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (step === 1) {
      if (reason) setStep(2);
      return;
    }
    if (detailLen < COMPLAINT_COMMENT_MIN) return;
    setSaving(true);
    setError('');
    try {
      await openEnergyComplaint(lead.id, { reason, comment: comment.trim() });
      const { fetchLead } = await import('../../lib/leads');
      const payload = await fetchLead(lead.id);
      if (payload.lead) onChange?.(payload.lead);
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (status) => {
    if (!complaint || saving) return;
    setSaving(true);
    setError('');
    try {
      await decideEnergyComplaint(complaint.id, status);
      const { fetchLead } = await import('../../lib/leads');
      const payload = await fetchLead(lead.id);
      if (payload.lead) onChange?.(payload.lead);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const modal = open ? (
    <div className="broker-modal broker-report-modal-wrap" role="dialog" aria-modal="true" aria-labelledby={`energy-report-${lead.id}`}>
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={saving ? undefined : closeModal} disabled={saving} />
      <form className={`broker-modal__panel broker-report-modal${step === 2 ? ' is-step-2' : ''}`} onSubmit={submit}>
        <div className="broker-report-modal__head">
          <div className="broker-report-modal__intro">
            <span className="broker-report-modal__badge">Reklamation</span>
            <h2 id={`energy-report-${lead.id}`}>Reklamation einreichen</h2>
            {lead.fullName ? <p className="broker-report-modal__lead">{lead.fullName}</p> : null}
            <p className="broker-report-modal__hint">Nur bei den Energie-Gründen. VANTARO prüft den Fall und entscheidet über Gutschrift oder Ersatz.</p>
            <div className="broker-report-progress" aria-label={`Schritt ${step} von 2`}>
              <span className={step === 1 ? 'is-current' : 'is-done'}><span>1</span>Grund</span>
              <span aria-hidden="true" className={`broker-report-progress__rail${step > 1 ? ' is-done' : ''}`} />
              <span className={step === 2 ? 'is-current' : undefined}><span>2</span>Angaben</span>
            </div>
          </div>
          <button type="button" className="broker-report-close" onClick={saving ? undefined : closeModal} aria-label="Schließen"><X size={18} /></button>
        </div>
        <div className="broker-report-modal__body">
          {error ? <div className="broker-alert">{error}</div> : null}
          {step === 1 ? (
            <section className="broker-report-step">
              <div className="broker-report-step__copy">
                <h3>Grund wählen</h3>
                <p>Akzeptierte Gründe für Photovoltaik und Wärmepumpe</p>
              </div>
              <div className="broker-report-reasons" role="radiogroup" aria-label="Grund der Reklamation">
                {ENERGY_COMPLAINT_REASONS.map((option) => {
                  const active = reason === option.id;
                  return (
                    <label key={option.id} className={active ? 'is-selected' : undefined}>
                      <input
                        type="radio"
                        className="broker-report-reason-input"
                        name={`energy-report-${lead.id}`}
                        value={option.id}
                        checked={active}
                        disabled={saving}
                        onChange={() => setReason(option.id)}
                      />
                      <span className="broker-report-reason-card">
                        <span className="broker-report-reason-check" aria-hidden="true">{active ? <Check size={14} strokeWidth={2.5} /> : null}</span>
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
              {selected ? (
                <button type="button" className="broker-report-chosen" onClick={() => setStep(1)} disabled={saving}>
                  <span><small>Gewählter Grund</small><strong>{selected.label}</strong></span>
                  <em>Ändern</em>
                </button>
              ) : null}
              <dl className="broker-report-facts">
                <div><dt>Lead-ID</dt><dd>{shortLeadId(lead.id)}</dd></div>
                <div><dt>Paket</dt><dd>{energyTypeLabel(energyLeadTypeOf(lead))}</dd></div>
                <div><dt>Übergabe</dt><dd>{formatDateTime(lead.assignedAt)}</dd></div>
                <div><dt>Art</dt><dd>{lead.deliveryType === 'appointment' ? 'Termin' : 'Lead'}</dd></div>
                <div className="is-wide"><dt>Adresse</dt><dd>{[lead.street, lead.houseNumber, lead.zip, lead.city, lead.state].filter(Boolean).join(', ') || 'Keine Adresse'}</dd></div>
                {lead.appointmentAt ? <div className="is-wide"><dt>Termin</dt><dd>{formatDateTime(lead.appointmentAt)}</dd></div> : null}
              </dl>
              <label className="broker-report-detail-field" htmlFor={`energy-report-detail-${lead.id}`}>
                <span>Kurze Begründung</span>
                <textarea
                  ref={detailRef}
                  id={`energy-report-detail-${lead.id}`}
                  className="broker-report-detail"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={selected?.placeholder || 'Beschreiben Sie den Mangel möglichst konkret…'}
                  rows={5}
                  disabled={saving}
                  required
                />
                <span className={`broker-report-detail-meta${detailLen < COMPLAINT_COMMENT_MIN ? ' is-short' : ' is-ok'}`}>
                  <strong>{detailLen}</strong><span>/</span><span>{COMPLAINT_COMMENT_MIN}</span><em>Zeichen min.</em>
                </span>
              </label>
            </section>
          )}
        </div>
        <div className="broker-report-modal__footer">
          <div className={`broker-report-actions${step === 2 ? ' is-split' : ''}`}>
            <button type="button" className="btn btn-outline" disabled={saving} onClick={step === 1 ? closeModal : () => setStep(1)}>
              {step === 1 ? 'Abbrechen' : 'Zurück'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || (step === 1 ? !reason : detailLen < COMPLAINT_COMMENT_MIN)}>
              {step === 1 ? 'Weiter' : (saving ? 'Wird gesendet…' : 'Reklamation einreichen')}
            </button>
          </div>
        </div>
      </form>
    </div>
  ) : null;
  const host = typeof document !== 'undefined' ? document.querySelector('.broker') || document.querySelector('.dash') : null;
  const portal = modal && host ? createPortal(modal, host) : modal;

  if (complaint) {
    const reasonLabel = ENERGY_COMPLAINT_REASONS.find((item) => item.id === complaint.reason)?.label || complaint.reason;
    return (
      <div className="broker-detail-side-block broker-detail-report-block is-submitted">
        {error ? <div className="broker-alert">{error}</div> : null}
        <div className={`broker-detail-report-done broker-detail-report-done--${complaintTone(complaint.status)}`}>
          <span className="broker-detail-report-done-icon" aria-hidden="true"><Flag size={16} /></span>
          <div className="broker-detail-report-done-body">
            <strong>{ENERGY_COMPLAINT_STATUS[complaint.status] || complaint.status}</strong>
            <span>{reasonLabel}</span>
            {complaint.comment ? <em>Reklamation: {complaint.comment}</em> : null}
            <small>{formatDate(complaint.createdAt)}</small>
          </div>
        </div>
        {pending ? <p className="broker-muted-note">VANTARO prüft den Fall. Sie sehen das Ergebnis hier.</p> : (
          <button type="button" className="broker-detail-report-again" onClick={() => setOpen(true)}>Erneut reklamieren</button>
        )}
        {isAdmin && pending ? (
          <div className="broker-detail-notes-actions">
            {[
              ['approved', 'Genehmigen'],
              ['partial', 'Teilgutschrift'],
              ['replacement', 'Ersatz'],
              ['rejected', 'Ablehnen'],
            ].map(([status, label]) => (
              <button key={status} type="button" className="btn btn-outline" disabled={saving} onClick={() => decide(status)}>{label}</button>
            ))}
          </div>
        ) : null}
        {portal}
      </div>
    );
  }

  return (
    <>
      <div className="broker-detail-side-block broker-detail-report-block">
        <button type="button" className="broker-report-trigger" onClick={() => setOpen(true)}>
          <span className="broker-report-trigger-icon" aria-hidden="true"><Flag size={18} /></span>
          <span className="broker-report-trigger-copy">
            <strong>Reklamation einreichen</strong>
            <small>Grund und Begründung zu diesem Lead</small>
          </span>
          <ChevronRight size={16} className="broker-report-trigger-caret" aria-hidden="true" />
        </button>
      </div>
      {portal}
    </>
  );
}

function emptyPartnerForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    energyRole: 'sub_partner',
  };
}

function PartnerPageAccess({ pages, disabled, onChange }) {
  return (
    <div className="energy-partner-pages" role="group" aria-label="Seitenzugriff">
      {ENERGY_PAGE_OPTIONS.map((option) => {
        const checked = pages.includes(option.id);
        return (
          <label key={option.id} className={`energy-partner-page${checked ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                const next = checked
                  ? pages.filter((id) => id !== option.id)
                  : [...pages, option.id];
                onChange(next.length ? next : ['dashboard']);
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function EnergyPartners() {
  const [partners, setPartners] = useState([]);
  const [form, setForm] = useState(emptyPartnerForm);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [accessPartner, setAccessPartner] = useState(null);
  const [accessPages, setAccessPages] = useState([]);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const load = () => fetchEnergyPartners().then((payload) => {
    setPartners(payload.partners || []);
  }).catch((err) => setError(err.message));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showCreate && !accessPartner) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (creating || savingAccess) return;
      if (showCreate) {
        setShowCreate(false);
        setFormError('');
        setForm(emptyPartnerForm());
      }
      if (accessPartner) {
        setAccessPartner(null);
        setAccessError('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreate, accessPartner, creating, savingAccess]);

  const accepted = partners.filter((item) => item.inviteStatus === 'accepted');
  const pending = partners.filter((item) => item.inviteStatus !== 'accepted');
  const activeCount = partners.filter((item) => item.active !== false).length;
  const visible = partners.filter((item) => {
    if (filter === 'accepted') return item.inviteStatus === 'accepted';
    if (filter === 'pending') return item.inviteStatus !== 'accepted';
    if (filter === 'active') return item.active !== false;
    if (filter === 'inactive') return item.active === false;
    return true;
  });

  const closeCreate = () => {
    if (creating) return;
    setShowCreate(false);
    setFormError('');
    setForm(emptyPartnerForm());
  };

  const openAccess = (partner) => {
    const pages = Array.isArray(partner.pages) && partner.pages.length
      ? partner.pages
      : ENERGY_DEFAULT_PAGE_IDS;
    setAccessError('');
    setAccessPages([...pages]);
    setAccessPartner(partner);
  };

  const closeAccess = () => {
    if (savingAccess) return;
    setAccessPartner(null);
    setAccessError('');
  };

  const patchPartner = async (partnerId, patch) => {
    setError('');
    setBusyId(partnerId);
    try {
      const payload = await updateEnergyPartner(partnerId, patch);
      setPartners((list) => list.map((item) => (item.id === partnerId ? { ...item, ...payload.partner } : item)));
      return payload.partner;
    } catch (err) {
      setError(err.message);
      await load();
      throw err;
    } finally {
      setBusyId('');
    }
  };

  const createModal = showCreate ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-create-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={closeCreate} />
      <div className="broker-modal__panel energy-partner-create-modal">
        <div className="energy-partner-create-head">
          <div className="energy-partner-create-title">
            <span className="energy-partner-create-icon" aria-hidden="true">
              <UserPlus size={20} />
            </span>
            <div>
              <h2 id="energy-partner-create-title">Zugang anlegen</h2>
              <p>Partner erhält Zugangsdaten per E-Mail und Passwort.</p>
            </div>
          </div>
          <button type="button" className="energy-partner-create-close" aria-label="Schließen" disabled={creating} onClick={closeCreate}>
            <X size={18} />
          </button>
        </div>

        <form
          className="energy-partner-create-body"
          onSubmit={async (event) => {
            event.preventDefault();
            setFormError('');
            setError('');
            setCreating(true);
            try {
              const payload = await createEnergyPartner({
                ...form,
                pages: [...ENERGY_DEFAULT_PAGE_IDS],
              });
              setCreated(payload);
              setForm(emptyPartnerForm());
              setShowCreate(false);
              await load();
            } catch (err) {
              setFormError(err.message);
            } finally {
              setCreating(false);
            }
          }}
        >
          {formError ? <div className="broker-alert">{formError}</div> : null}

          <div className="energy-partner-create-grid">
            <label className="energy-partner-create-field">
              <span>Vorname</span>
              <input
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                placeholder="Max"
                required
                autoFocus
              />
            </label>
            <label className="energy-partner-create-field">
              <span>Nachname</span>
              <input
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                placeholder="Mustermann"
                required
              />
            </label>
            <label className="energy-partner-create-field is-full">
              <span>E-Mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="partner@firma.de"
                required
              />
            </label>
          </div>

          <div className="energy-partner-create-roles" role="radiogroup" aria-label="Rolle">
            <span className="energy-partner-create-label">Rolle</span>
            {[
              { id: 'dispatcher', title: 'Dispatcher', hint: 'Zuweisung und Koordination' },
              { id: 'sub_partner', title: 'Untervertriebspartner', hint: 'Verkauf und Betreuung' },
              { id: 'field_rep', title: 'Außendienst', hint: 'Termine vor Ort' },
            ].map((role) => (
              <button
                key={role.id}
                type="button"
                role="radio"
                aria-checked={form.energyRole === role.id}
                className={`energy-partner-create-role${form.energyRole === role.id ? ' is-active' : ''}`}
                onClick={() => setForm({ ...form, energyRole: role.id })}
              >
                <strong>{role.title}</strong>
                <small>{role.hint}</small>
              </button>
            ))}
          </div>

          <div className="energy-partner-create-note">
            Standardzugriff: Dashboard, Leads, Kalender, Akademie, Support.
            <em>Meine Pakete</em> kann später freigegeben werden.
          </div>

          <div className="energy-partner-create-footer">
            <button type="button" className="dash-btn dash-btn--ghost" disabled={creating} onClick={closeCreate}>Abbrechen</button>
            <button className="dash-btn" type="submit" disabled={creating}>
              <UserPlus size={16} />
              {creating ? 'Wird angelegt…' : 'Zugang anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const accessModal = accessPartner ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-access-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={closeAccess} />
      <div className="broker-modal__panel energy-partner-access-modal">
        <div className="broker-modal__top">
          <h2 id="energy-partner-access-title">Seitenzugriff</h2>
          <button type="button" className="broker-modal__close" aria-label="Schließen" disabled={savingAccess} onClick={closeAccess}>
            <X size={18} />
          </button>
        </div>
        <p className="energy-partner-create-lede">
          Für <strong>{accessPartner.fullName}</strong> festlegen, welche Seiten sichtbar sind.
        </p>
        {accessError ? <div className="broker-alert">{accessError}</div> : null}
        <PartnerPageAccess
          pages={accessPages}
          disabled={savingAccess}
          onChange={setAccessPages}
        />
        <div className="energy-partner-create-actions">
          <button type="button" className="dash-btn dash-btn--ghost" disabled={savingAccess} onClick={closeAccess}>Abbrechen</button>
          <button
            type="button"
            className="dash-btn"
            disabled={savingAccess}
            onClick={async () => {
              setAccessError('');
              setSavingAccess(true);
              try {
                await patchPartner(accessPartner.id, { pages: accessPages.length ? accessPages : ['dashboard'] });
                setAccessPartner(null);
              } catch (err) {
                setAccessError(err.message || 'Seitenzugriff konnte nicht gespeichert werden.');
              } finally {
                setSavingAccess(false);
              }
            }}
          >
            {savingAccess ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Netzwerk</div>
          <h1>Partner</h1>
          <p className="lede">
            Zugänge anlegen, Einladungsstatus prüfen, Seitenzugriff freigeben und Partner aktivieren oder sperren.
          </p>
        </div>
      </div>

      <div className="broker-home-metrics broker-home-metrics--leads">
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>Gesamt</span><strong>{partners.length}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>Aktiv</span><strong>{activeCount}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>Angenommen</span><strong>{accepted.length}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>Ausstehend</span><strong>{pending.length}</strong></div>
        </article>
      </div>

      {error ? <div className="broker-alert">{error}</div> : null}
      {created ? (
        <div className="broker-alert broker-alert--ok">
          Zugang für <strong>{created.user.email}</strong> angelegt. Einmaliges Passwort: <code>{created.password}</code>
        </div>
      ) : null}

      <section className="broker-panel energy-partner-board">
        <div className="broker-panel-header energy-partner-board-header">
          <div>
            <h2>Alle Partner</h2>
            <p>{partners.length} Zugänge in Ihrem Netzwerk</p>
          </div>
          <button type="button" className="dash-btn" onClick={() => { setFormError(''); setShowCreate(true); }}>
            <UserPlus size={16} />
            Zugang anlegen
          </button>
        </div>

        <div className="energy-partner-toolbar">
          <div className="dash-seg" role="tablist" aria-label="Filter">
            {[
              { id: 'all', label: 'Alle', count: partners.length },
              { id: 'accepted', label: 'Angenommen', count: accepted.length },
              { id: 'pending', label: 'Ausstehend', count: pending.length },
              { id: 'active', label: 'Aktiv', count: activeCount },
              { id: 'inactive', label: 'Inaktiv', count: partners.length - activeCount },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                className={filter === option.id ? 'is-active' : undefined}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
                <em>{option.count}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="energy-partner-list">
          {visible.length === 0 ? (
            <div className="energy-partner-empty">Keine Partner in diesem Filter.</div>
          ) : visible.map((partner) => {
            const busy = busyId === partner.id;
            const pages = Array.isArray(partner.pages) && partner.pages.length
              ? partner.pages
              : ENERGY_DEFAULT_PAGE_IDS;
            const isAccepted = partner.inviteStatus === 'accepted';
            const isActive = partner.active !== false;
            const avatar = initials({
              firstName: partner.firstName,
              lastName: partner.lastName,
              fullName: partner.fullName,
            }) || '?';
            return (
              <article
                key={partner.id}
                className={`broker-panel energy-partner-card${isActive ? '' : ' is-inactive'}${busy ? ' is-busy' : ''}`}
              >
                <div className="energy-partner-avatar" aria-hidden="true">{avatar}</div>

                <div className="energy-partner-identity">
                  <div className="energy-partner-name">{partner.fullName}</div>
                  <a className="energy-partner-email" href={`mailto:${partner.email}`}>
                    <Mail size={13} />
                    {partner.email}
                  </a>
                  <div className="energy-partner-meta-row">
                    <span className="broker-lead-type">{ENERGY_ROLE_LABELS[partner.energyRole] || partner.energyRole}</span>
                    <span className={`broker-status${isAccepted ? '' : ' is-reported'}`}>
                      {isAccepted ? 'Angenommen' : 'Ausstehend'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="energy-partner-access-btn"
                  disabled={busy}
                  onClick={() => openAccess(partner)}
                >
                  <KeyRound size={15} />
                  <span>Seitenzugriff</span>
                  <em>{pages.length}/{ENERGY_PAGE_OPTIONS.length}</em>
                </button>

                <button
                  type="button"
                  className={`energy-partner-toggle${isActive ? ' is-on' : ''}`}
                  disabled={busy}
                  aria-pressed={isActive}
                  aria-label={isActive ? 'Zugang deaktivieren' : 'Zugang aktivieren'}
                  onClick={() => patchPartner(partner.id, { active: !isActive })}
                >
                  <span className="energy-partner-toggle-track" aria-hidden />
                  <span>{isActive ? 'Aktiv' : 'Inaktiv'}</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {createModal ? createPortal(createModal, document.body) : null}
      {accessModal ? createPortal(accessModal, document.body) : null}
    </div>
  );
}

export function EnergyBilling() {
  const { isAdmin } = useAuth();
  const [companyId, setCompanyId] = useState('');
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [profile, setProfile] = useState({
    model: 'MONTHLY',
    pricePvLead: '',
    pricePvAppointment: '',
    priceHpLead: '',
    priceHpAppointment: '',
    complaintPeriodDays: '',
    thresholdQuantity: '',
    thresholdAmount: '',
    creditLimit: '',
    invoiceDay: '',
    paymentTermDays: '',
    complaintBlocksInvoice: false,
  });

  const load = (id) => fetchEnergyBilling(id).then((payload) => {
    setView(payload);
    if (payload.profile) {
      setProfile({
        model: payload.profile.model,
        pricePvLead: payload.profile.pricePvLead ?? '',
        pricePvAppointment: payload.profile.pricePvAppointment ?? '',
        priceHpLead: payload.profile.priceHpLead ?? '',
        priceHpAppointment: payload.profile.priceHpAppointment ?? '',
        complaintPeriodDays: payload.profile.complaintPeriodDays ?? '',
        thresholdQuantity: payload.profile.thresholdQuantity ?? '',
        thresholdAmount: payload.profile.thresholdAmount ?? '',
        creditLimit: payload.profile.creditLimit ?? '',
        invoiceDay: payload.profile.invoiceDay ?? '',
        paymentTermDays: payload.profile.paymentTermDays ?? '',
        complaintBlocksInvoice: payload.profile.complaintBlocksInvoice === true,
      });
    }
  }).catch((err) => setError(err.message));

  useEffect(() => { if (!isAdmin) load(); }, [isAdmin]);

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Energie</div>
          <h1>Abrechnung</h1>
          <p className="lede">Preise und Modell gelten je Hauptfirma. Jede Lieferung erzeugt eine offene Position.</p>
        </div>
      </div>
      {error ? <div className="broker-alert">{error}</div> : null}
      {isAdmin ? (
        <form className="broker-form-grid" onSubmit={(event) => { event.preventDefault(); load(companyId); }}>
          <label>Hauptfirma Benutzer-ID<input value={companyId} onChange={(event) => setCompanyId(event.target.value)} required /></label>
          <button className="dash-btn" type="submit">Laden</button>
        </form>
      ) : null}
      {view ? (
        <>
          <div className="broker-home-metrics">
            <article className="broker-home-metric"><div><span>Offen</span><strong>{view.openCount}</strong></div></article>
            <article className="broker-home-metric"><div><span>Offener Betrag</span><strong>{money(view.openAmount)}</strong></div></article>
            <article className="broker-home-metric"><div><span>Modell</span><strong>{view.profile?.model || 'nicht hinterlegt'}</strong></div></article>
          </div>
          {isAdmin && companyId ? (
            <form className="broker-settings-section broker-form-grid" onSubmit={async (event) => {
              event.preventDefault();
              setError('');
              try {
                await saveEnergyBilling(companyId, profile);
                await load(companyId);
              } catch (err) {
                setError(err.message);
              }
            }}>
              <label>Modell
                <select value={profile.model} onChange={(event) => setProfile({ ...profile, model: event.target.value })}>
                  <option value="PREPAID">Vorauszahlung</option>
                  <option value="MONTHLY">Monatsrechnung</option>
                  <option value="THRESHOLD">Schwelle</option>
                  <option value="CUSTOM">Individuell</option>
                </select>
              </label>
              <label>Preis PV-Lead<input value={profile.pricePvLead} onChange={(event) => setProfile({ ...profile, pricePvLead: event.target.value })} /></label>
              <label>Preis PV-Termin<input value={profile.pricePvAppointment} onChange={(event) => setProfile({ ...profile, pricePvAppointment: event.target.value })} /></label>
              <label>Preis WP-Lead<input value={profile.priceHpLead} onChange={(event) => setProfile({ ...profile, priceHpLead: event.target.value })} /></label>
              <label>Preis WP-Termin<input value={profile.priceHpAppointment} onChange={(event) => setProfile({ ...profile, priceHpAppointment: event.target.value })} /></label>
              <label>Reklamationsfrist Tage<input value={profile.complaintPeriodDays} onChange={(event) => setProfile({ ...profile, complaintPeriodDays: event.target.value })} /></label>
              <label>Schwelle Menge<input value={profile.thresholdQuantity} onChange={(event) => setProfile({ ...profile, thresholdQuantity: event.target.value })} /></label>
              <label>Schwelle Betrag<input value={profile.thresholdAmount} onChange={(event) => setProfile({ ...profile, thresholdAmount: event.target.value })} /></label>
              <label>Kreditlimit<input value={profile.creditLimit} onChange={(event) => setProfile({ ...profile, creditLimit: event.target.value })} /></label>
              <label>Rechnungstag<input value={profile.invoiceDay} onChange={(event) => setProfile({ ...profile, invoiceDay: event.target.value })} /></label>
              <label>Zahlungsziel Tage<input value={profile.paymentTermDays} onChange={(event) => setProfile({ ...profile, paymentTermDays: event.target.value })} /></label>
              <label>Offene Reklamation blockiert Rechnung
                <input type="checkbox" checked={profile.complaintBlocksInvoice} onChange={(event) => setProfile({ ...profile, complaintBlocksInvoice: event.target.checked })} />
              </label>
              <button className="dash-btn" type="submit">Profil speichern</button>
            </form>
          ) : null}
          {isAdmin && companyId ? (
            <form className="broker-form-grid" onSubmit={async (event) => {
              event.preventDefault();
              try {
                await invoiceEnergyLines(companyId, invoiceId);
                setInvoiceId('');
                await load(companyId);
              } catch (err) {
                setError(err.message);
              }
            }}>
              <label>Rechnungsnummer<input value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} required /></label>
              <button className="dash-btn" type="submit">Offene Positionen fakturieren</button>
            </form>
          ) : null}
          <div className="energy-card-list">
            {view.lines.map((line) => (
              <article key={line.id} className="broker-lead-card">
                <strong>{energyTypeLabel(line.productType)}</strong>
                <span>{money(line.unitPrice)} · {line.status}{line.invoiceId ? ` · ${line.invoiceId}` : ''}</span>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function EnergyComplaints() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const load = () => fetchEnergyComplaints().then((payload) => setItems(payload.complaints || [])).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);
  return (
    <div className="broker-page">
      <div className="broker-heading"><div><div className="eyebrow">Energie</div><h1>Reklamationen</h1></div></div>
      {error ? <div className="broker-alert">{error}</div> : null}
      <div className="energy-card-list">
        {items.map((item) => (
          <article key={item.id} className="broker-lead-card">
            <div>
              <strong>{ENERGY_COMPLAINT_REASONS.find((reason) => reason.id === item.reason)?.label || item.reason}</strong>
              <span>{item.comment || 'Kein Kommentar'} · {item.status}</span>
            </div>
            {isAdmin && item.status === 'pending' ? (
              <div>
                {[
                  ['approved', 'Genehmigt'],
                  ['rejected', 'Abgelehnt'],
                  ['partial', 'Teilgutschrift'],
                  ['replacement', 'Ersatz'],
                ].map(([status, label]) => (
                  <button key={status} type="button" className="dash-btn dash-btn--ghost" onClick={async () => {
                    await decideEnergyComplaint(item.id, status);
                    await load();
                  }}>{label}</button>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
