import { useEffect, useMemo, useState } from 'react';
import PhoneField, { isValidMobile } from '../../components/PhoneField';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import {
  cancelMyRequest,
  createMyRequest,
  fetchMyRequests,
  LEAD_TYPE_OPTIONS,
  leadTypeLabel,
  requestStatusLabel,
} from '../../lib/berater';
import {
  COMPLAINT_REASON_OPTIONS,
  complaintReasonLabel,
  complaintStatusLabel,
  isOpenComplaint,
  reportLead,
} from '../../lib/complaints';
import {
  CONCERN_OPTIONS,
  employmentLabel,
  fetchMyLeads,
  formatLeadAddress,
  formatLeadDate,
  formatPremium,
  listLabels,
} from '../../lib/leads';
import { LEGAL_FORMS, fileToAvatarDataUrl, formatAddress } from '../../lib/profile';
import { formatDate, formatEuroExact } from './helpers';

function leadStatusLabel(lead) {
  if (lead.complaint?.status === 'pending') return 'Gemeldet';
  if (lead.complaint?.status === 'declined') return 'Erstattung abgelehnt';
  return 'Zugestellt';
}

function LeadCard({ lead, onReported }) {
  const address = formatLeadAddress(lead);
  const complaint = lead.complaint;
  const open = isOpenComplaint(complaint);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('invalid');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submitReport(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await reportLead(lead.id, { reason, comment });
      setReporting(false);
      onReported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="broker-panel broker-lead-card" id={`lead-${lead.id}`}>
      <div className="broker-lead-top">
        <div>
          <div className="broker-lead-name">{lead.fullName}</div>
          <div className="broker-lead-address">{address}</div>
        </div>
        <span className={`broker-status${open ? ' is-reported' : ''}`}>{leadStatusLabel(lead)}</span>
      </div>
      <div className="broker-lead-meta">
        <span>{listLabels(lead.insuranceStatus, 'insurance')}</span>
        <span>{listLabels(lead.mainConcerns, 'concern')}</span>
        {lead.employmentStatus ? <span>{employmentLabel(lead.employmentStatus)}</span> : null}
        {lead.monthlyPremium != null ? <span>{formatPremium(lead.monthlyPremium)} / Monat</span> : null}
      </div>
      <dl className="broker-lead-facts">
        {lead.phone ? (
          <div>
            <dt>Telefon</dt>
            <dd><a href={`tel:${lead.phone}`}>{lead.phone}</a></dd>
          </div>
        ) : null}
        {lead.email ? (
          <div>
            <dt>E-Mail</dt>
            <dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
          </div>
        ) : null}
        {lead.dateOfBirth ? (
          <div>
            <dt>Geburtsdatum</dt>
            <dd>{formatLeadDate(lead.dateOfBirth)}</dd>
          </div>
        ) : null}
        {lead.currentInsurer ? (
          <div>
            <dt>Gesellschaft</dt>
            <dd>{lead.currentInsurer}</dd>
          </div>
        ) : null}
      </dl>
      {lead.notes ? <p className="broker-lead-note">{lead.notes}</p> : null}

      {complaint ? (
        <div className={`broker-complaint-note${complaint.status === 'declined' ? ' is-declined' : ''}`}>
          <strong>{complaintStatusLabel(complaint.status)}</strong>
          <span>{complaintReasonLabel(complaint.reason)}</span>
          {complaint.comment ? <p>{complaint.comment}</p> : null}
          {complaint.status === 'declined' && complaint.adminNote ? (
            <p><strong>Antwort Admin:</strong> {complaint.adminNote}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-lead-bottom">
        {open ? (
          <span className="broker-muted-action">
            Reklamation liegt dem Admin zur Prüfung vor.
          </span>
        ) : reporting ? (
          <form className="broker-report-form" onSubmit={submitReport}>
            <label>
              Grund
              <select value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving}>
                {COMPLAINT_REASON_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Zusatzinfo (optional)
              <textarea
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                disabled={saving}
                placeholder="Was ist an diesem Lead nicht korrekt?"
              />
            </label>
            <div className="broker-report-actions">
              <button type="submit" className="broker-save broker-save--inline" disabled={saving}>{saving ? 'Wird gesendet…' : 'Reklamation senden'}</button>
              <button type="button" className="broker-text-btn" disabled={saving} onClick={() => setReporting(false)}>
                Abbrechen
              </button>
            </div>
          </form>
        ) : (
          <>
            <span className="broker-muted-action">Nächster Schritt: Kontakt aufnehmen</span>
            <button type="button" className="broker-text-btn" onClick={() => setReporting(true)}>
              {complaint?.status === 'declined' ? 'Erneut reklamieren' : 'Lead reklamieren'}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function BeraterLeads() {
  const [leads, setLeads] = useState([]);
  const [request, setRequest] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('delivered');
  const [concern, setConcern] = useState('all');
  const [count, setCount] = useState(10);
  const [leadType, setLeadType] = useState('PKV');
  const [notes, setNotes] = useState('');

  async function load() {
    const [leadPayload, requestPayload] = await Promise.all([
      fetchMyLeads(),
      fetchMyRequests(),
    ]);
    setLeads(leadPayload.leads || []);
    setRequest(requestPayload.request || null);
    setRequests(requestPayload.requests || []);
  }

  useEffect(() => {
    let active = true;
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
  }, []);

  const delivered = useMemo(
    () => leads.filter((lead) => !isOpenComplaint(lead.complaint)),
    [leads],
  );
  const reported = useMemo(
    () => leads.filter((lead) => isOpenComplaint(lead.complaint)),
    [leads],
  );
  const source = tab === 'reported' ? reported : delivered;
  const visible = useMemo(
    () => source.filter((lead) => concern === 'all' || (lead.mainConcerns || []).includes(concern)),
    [concern, source],
  );

  const canRequest = !request || (request.status !== 'pending' && request.status !== 'active');

  async function submitRequest(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createMyRequest({ requestedCount: count, leadType, notes });
      await load();
      setNotes('');
      setNotice('Anfrage gesendet. Sie erscheint sofort im Admin-Dashboard.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest() {
    if (!request) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await cancelMyRequest(request.id);
      await load();
      setNotice('Anfrage storniert.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="broker-page">
      {notice ? <div className="broker-alert broker-alert--ok">{notice}</div> : null}
      {error ? <div className="broker-alert">{error}</div> : null}

      <div className="broker-stats">
        <div>
          <span>Status</span>
          <strong>{loading ? '—' : requestStatusLabel(request?.status)}</strong>
        </div>
        <div>
          <span>Angefragt</span>
          <strong>{loading ? '—' : request?.requestedCount || 0}</strong>
        </div>
        <div>
          <span>Zugestellt</span>
          <strong>{loading ? '—' : request?.deliveredCount || 0}</strong>
        </div>
        <div>
          <span>Gültig</span>
          <strong>{loading ? '—' : request?.validCount || 0}</strong>
        </div>
        <div>
          <span>Gemeldet</span>
          <strong>{loading ? '—' : request?.reportedCount || 0}</strong>
        </div>
        <div>
          <span>Erstattet</span>
          <strong>{loading ? '—' : request?.refundedCount || 0}</strong>
        </div>
        <div>
          <span>Offen</span>
          <strong>{loading ? '—' : request?.remaining || 0}</strong>
        </div>
      </div>

      <section className="broker-panel broker-request-card">
        {request && (request.status === 'pending' || request.status === 'active' || request.status === 'completed') ? (
          <div>
            <div className="broker-panel-header">
              <div>
                <h2>Aktuelle Anfrage</h2>
                <p>
                  {leadTypeLabel(request.leadType)} · {request.requestedCount} Leads · {formatDate(request.createdAt)}
                </p>
              </div>
              <span className="broker-count">{requestStatusLabel(request.status)}</span>
            </div>
            <div className="broker-request-facts">
              <span>Zugestellt {request.deliveredCount}</span>
              <span>Erstattet {request.refundedCount}</span>
              <span>Gültig {request.validCount}</span>
              <span>Offen {request.remaining}</span>
            </div>
            {request.status === 'pending' ? (
              <div className="broker-request-actions">
                <button type="button" className="broker-text-btn" disabled={saving} onClick={cancelRequest}>
                  Anfrage stornieren
                </button>
              </div>
            ) : null}
            {request.status === 'completed' ? (
              <p className="broker-muted-note">Auftrag erfüllt. Sie können eine neue Anfrage stellen.</p>
            ) : null}
          </div>
        ) : (
          <div className="broker-panel-header">
            <div>
              <h2>Leads anfragen</h2>
              <p>Anzahl und Kategorie wählen. Die Anfrage geht direkt an den Admin.</p>
            </div>
          </div>
        )}

        {canRequest ? (
          <form className="broker-request-form" onSubmit={submitRequest}>
            <label>
              Anzahl
              <input
                type="number"
                min={1}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                disabled={saving}
                required
              />
            </label>
            <label>
              Kategorie
              <select value={leadType} onChange={(event) => setLeadType(event.target.value)} disabled={saving}>
                {LEAD_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="is-full">
              Hinweis (optional)
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="z. B. Fokus Selbstständige in NRW"
                disabled={saving}
              />
            </label>
            <div className="broker-request-actions is-full">
              <button type="submit" className="broker-save broker-save--inline" disabled={saving}>
                {saving ? 'Wird gesendet…' : 'Anfrage senden'}
              </button>
            </div>
          </form>
        ) : null}

        {requests.length > 1 ? (
          <ul className="broker-request-history">
            {requests.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <span>{formatDate(entry.createdAt)} · {leadTypeLabel(entry.leadType)} · {entry.requestedCount} Leads</span>
                <b>{requestStatusLabel(entry.status)}</b>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="broker-filterbar">
        <div className="broker-tabs">
          <button type="button" className={tab === 'delivered' ? 'is-active' : undefined} onClick={() => setTab('delivered')}>
            Zugestellt ({delivered.length})
          </button>
          <button type="button" className={tab === 'reported' ? 'is-active' : undefined} onClick={() => setTab('reported')}>
            Gemeldet ({reported.length})
          </button>
        </div>
        <label htmlFor="concernFilter">Hauptanliegen</label>
        <select id="concernFilter" value={concern} onChange={(event) => setConcern(event.target.value)}>
          <option value="all">Alle Anliegen</option>
          {CONCERN_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <span className="broker-filter-count">
          {loading ? 'Laden…' : `${visible.length} in dieser Ansicht`}
        </span>
      </div>

      {loading ? (
        <div className="broker-panel broker-empty">
          <strong>Leads werden geladen</strong>
          <p>Einen Moment bitte.</p>
        </div>
      ) : visible.length ? (
        <div className="broker-leads-grid">
          {visible.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onReported={() => {
                load().catch((err) => setError(err.message));
              }}
            />
          ))}
        </div>
      ) : (
        <div className="broker-panel broker-empty">
          <strong>{tab === 'reported' ? 'Keine gemeldeten Leads' : 'Noch keine Leads zugestellt'}</strong>
          <p>
            {tab === 'reported'
              ? 'Reklamierte Leads erscheinen hier, bis der Admin entschieden hat.'
              : 'Sobald ein Admin Ihre Anfrage annimmt und Leads sendet, erscheinen sie hier.'}
          </p>
        </div>
      )}
    </div>
  );
}

export function BeraterPayments() {
  const { balanceCents, addFunds, transactions } = useBroker();

  return (
    <div className="broker-page">
      <div className="broker-payment-box">
        <div className="broker-payment-label">Verfügbares Guthaben</div>
        <div className="broker-balance">{formatEuroExact(balanceCents)}</div>
        <p>Jeder gekaufte Lead erscheint in Ihrem Verlauf.</p>
        <button type="button" onClick={() => addFunds(25000)}>+ 250 € aufladen</button>
      </div>

      <div className="broker-panel broker-history">
        <div className="broker-panel-header">
          <div>
            <h2>Verlauf</h2>
            <p>Aufladungen und Leadkäufe</p>
          </div>
        </div>
        {transactions.length ? (
          <ul className="broker-tx">
            {transactions.map((entry) => (
              <li key={entry.id}>
                <span>
                  <strong>{entry.label}</strong>
                  <small>{new Date(entry.at).toLocaleString('de-DE')}</small>
                </span>
                <b className={entry.cents < 0 ? 'is-debit' : 'is-credit'}>
                  {entry.cents > 0 ? '+' : ''}{formatEuroExact(entry.cents)}
                </b>
              </li>
            ))}
          </ul>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Buchungen</strong>
            <p>Käufe und Aufladungen erscheinen hier.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function profileForm(user) {
  const business = user?.profile?.businessAddress || {};
  const billing = user?.profile?.billingAddress || {};
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    company: user?.profile?.company || '',
    legalForm: user?.profile?.legalForm || '',
    businessStreet: business.street || '',
    businessZip: business.zip || '',
    businessCity: business.city || '',
    billingSame: user?.profile?.billingSame !== false,
    billingStreet: billing.street || '',
    billingZip: billing.zip || '',
    billingCity: billing.city || '',
    website: user?.profile?.website || '',
    avatarUrl: user?.avatarUrl || '',
    password: '',
    confirmPassword: '',
  };
}

export function BeraterProfile() {
  const { user, updateProfile, isAdmin } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState(() => profileForm(user));
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarName, setAvatarName] = useState('');

  useEffect(() => {
    setForm(profileForm(user));
    setAvatarName('');
  }, [user]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
    if (!isAdmin) {
      if (!form.company.trim() || !form.legalForm) {
        setError('Firmenname und Rechtsform sind erforderlich.');
        return;
      }
      if (!form.businessStreet.trim() || !form.businessZip.trim() || !form.businessCity.trim()) {
        setError('Bitte geben Sie die vollständige Geschäftsadresse an.');
        return;
      }
      if (!form.billingSame) {
        if (!form.billingStreet.trim() || !form.billingZip.trim() || !form.billingCity.trim()) {
          setError('Bitte geben Sie die vollständige Rechnungsadresse an.');
          return;
        }
      }
    }
    if (form.password && form.password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setSaving(true);
    try {
      const { password, confirmPassword, ...rest } = form;
      await updateProfile({
        ...rest,
        ...(password ? { password } : {}),
      });
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setAvatarName('');
      showToast(password ? 'Profil und Passwort gespeichert' : 'Profil gespeichert');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="broker-page">
      <p className="broker-page-lede">
            {isAdmin
              ? 'Admin-Konto: Name, Telefon und Passwort. Unternehmensdaten sind optional.'
              : user?.onboardingComplete
                ? 'Ansprechpartner, Unternehmen und Erreichbarkeit für Ihr Maklerkonto.'
                : 'Ergänzen Sie Telefon, Firma und Adresse — danach ist Ihr Konto vollständig.'}
      </p>

      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <h2>Benutzerkonto und Ansprechpartner</h2>
        {error && <div className="broker-alert">{error}</div>}

        <div className="broker-avatar-edit">
          <div className="broker-avatar-preview" aria-hidden="true">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" />
            ) : (
              <span>
                {(form.firstName[0] || '').toUpperCase()}
                {(form.lastName[0] || '').toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <span className="broker-field-label">Profilbild</span>
            <label className="broker-file-btn" htmlFor="profile-avatar">
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatar}
                disabled={saving}
              />
              <span>Bild auswählen</span>
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
            Vorname
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
            Nachname
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
            Geschäftliche E-Mail-Adresse
            <input type="email" value={user?.email || ''} autoComplete="email" disabled />
          </label>
          <label className="is-full">
            Mobilnummer / geschäftliche Telefonnummer
            <PhoneField
              id="profile-phone"
              value={form.phone}
              onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
              disabled={saving}
              required
              className="vantaro-phone-input--light"
            />
          </label>
          <label>
            Neues Passwort
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="Unverändert lassen"
                disabled={saving}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          <label>
            Passwort bestätigen
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              placeholder="Nur bei Änderung"
              disabled={saving}
            />
          </label>
        </div>

        <h2>Unternehmens- und Maklerdaten{isAdmin ? ' (optional)' : ''}</h2>
        {user?.customerNumber ? (
          <p className="broker-customer-number">
            Interne VANTARO-Kundennummer: <strong>{user.customerNumber}</strong>
          </p>
        ) : null}

        <div className="broker-form-grid">
          <label className="is-full">
            Firmenname
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              autoComplete="organization"
              disabled={saving}
              required={!isAdmin}
            />
          </label>
          <label className="is-full">
            Rechtsform
            <select
              name="legalForm"
              value={form.legalForm}
              onChange={handleChange}
              disabled={saving}
              required={!isAdmin}
            >
              <option value="">Bitte wählen</option>
              {LEGAL_FORMS.map((formName) => (
                <option key={formName} value={formName}>
                  {formName}
                </option>
              ))}
            </select>
          </label>
          <label className="is-full">
            Geschäftsadresse
            <input
              name="businessStreet"
              value={form.businessStreet}
              onChange={handleChange}
              placeholder="Straße und Hausnummer"
              disabled={saving}
              required={!isAdmin}
            />
          </label>
          <label>
            PLZ
            <input
              name="businessZip"
              value={form.businessZip}
              onChange={handleChange}
              disabled={saving}
              required={!isAdmin}
            />
          </label>
          <label>
            Ort
            <input
              name="businessCity"
              value={form.businessCity}
              onChange={handleChange}
              disabled={saving}
              required={!isAdmin}
            />
          </label>
          <label className="is-full broker-check">
            <input
              type="checkbox"
              name="billingSame"
              checked={form.billingSame}
              onChange={handleChange}
              disabled={saving}
            />
            Rechnungsadresse entspricht der Geschäftsadresse
          </label>
          {!form.billingSame && (
            <>
              <label className="is-full">
                Rechnungsadresse
                <input
                  name="billingStreet"
                  value={form.billingStreet}
                  onChange={handleChange}
                  placeholder="Straße und Hausnummer"
                  disabled={saving}
                  required={!isAdmin}
                />
              </label>
              <label>
                PLZ
                <input
                  name="billingZip"
                  value={form.billingZip}
                  onChange={handleChange}
                  disabled={saving}
                  required={!isAdmin}
                />
              </label>
              <label>
                Ort
                <input
                  name="billingCity"
                  value={form.billingCity}
                  onChange={handleChange}
                  disabled={saving}
                  required={!isAdmin}
                />
              </label>
            </>
          )}
          <label className="is-full">
            Website
            <input
              name="website"
              type="url"
              value={form.website}
              onChange={handleChange}
              placeholder="https://www.beispiel.de"
              disabled={saving}
            />
          </label>
        </div>

        {(form.businessStreet || form.businessZip || form.businessCity) ? (
          <p className="broker-muted-note">
            Aktuelle Geschäftsadresse:{' '}
            {formatAddress({
              street: form.businessStreet,
              zip: form.businessZip,
              city: form.businessCity,
            })}
          </p>
        ) : null}

        <button type="submit" className="broker-save" disabled={saving}>
          {saving ? 'Wird gespeichert…' : 'Profil speichern'}
        </button>
      </form>
    </div>
  );
}
