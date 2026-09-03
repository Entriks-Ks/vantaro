import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Eye,
  EyeOff,
  Flag,
  Inbox,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import { useDashboard } from '../../hooks/useDashboard';
import { leadTypeLabel, requestStatusLabel, requestStatusTone } from '../../lib/berater';
import { fetchAllPayments, formatCardExpiry, formatCardMask } from '../../lib/payments';
import { leadScopeLabel } from '../../lib/scopes';
import { fileToAvatarDataUrl, validatePassword } from '../../lib/profile';
import { roleLabel } from '../../lib/roles';
import { LeadListItem } from './AdminLeads';
import { formatDate, formatDateTime, formatEuroExact, initials } from './helpers';

function Metric({ label, value, hint, tone, to }) {
  const className = `dash-metric${tone ? ` dash-metric--${tone}` : ''}${to ? ' is-link' : ''}`;
  const inner = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
      {to ? <ArrowUpRight className="dash-metric-go" size={16} aria-hidden="true" /> : null}
    </>
  );
  return to ? <Link className={className} to={to}>{inner}</Link> : <div className={className}>{inner}</div>;
}

function FocusCard({ label, value, hint, to, icon: Icon }) {
  const busy = Number(value) > 0;
  return (
    <Link
      className={`dash-focus-card${busy ? ' is-busy' : ''}`}
      to={to}
    >
      <span className="dash-focus-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="dash-focus-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{hint}</small>
      </span>
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}

function EmptyPanel({ title, text, action, to }) {
  return (
    <section className="dash-panel">
      <div className="dash-panel-head">
        <strong>{title}</strong>
        {to && <Link to={to}>{action}</Link>}
      </div>
      <div className="dash-empty">
        <p>{text}</p>
      </div>
    </section>
  );
}

function PersonRow({ entry }) {
  return (
    <div className="dash-person-row">
      <span className="dash-avatar dash-avatar--sm" aria-hidden="true">
        {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : initials(entry)}
      </span>
      <div className="dash-person-copy">
        {entry.role === 'berater' ? (
          <Link to={`/dashboard/berater/${entry.id}`}>{entry.fullName || entry.email || '—'}</Link>
        ) : (
          <strong>{entry.fullName || entry.email || '—'}</strong>
        )}
        <span>{[entry.company, entry.email].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="dash-person-side">
        <span className={`dash-badge dash-badge--${entry.role}`}>{roleLabel(entry.role)}</span>
        <small className={entry.verified ? undefined : 'dash-unverified'}>
          {entry.verified ? (entry.onboardingComplete ? 'Verifiziert' : 'E-Mail bestätigt') : 'Unbestätigt'}
        </small>
      </div>
    </div>
  );
}

function UsersTable({ users, empty }) {
  if (!users?.length) {
    return <div className="dash-empty"><p>{empty}</p></div>;
  }

  return (
    <div className="dash-people-list">
      {users.map((entry) => (
        <PersonRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export function AdminOverview() {
  const { admin, loading, error } = useDashboard();
  const counts = admin?.users || { total: 0, berater: 0, admin: 0, unverified: 0 };
  const workflow = admin?.workflow || {};
  const dash = loading ? '—' : undefined;

  return (
    <div className="dash-stack">
      {error ? <div className="dash-alert">{error}</div> : null}

      <section>
        <h3 className="dash-section-label">Jetzt prüfen</h3>
        <div className="dash-focus-grid">
          <FocusCard
            label="Anforderungen"
            value={dash ?? (workflow.activeRequests || 0)}
            hint="aktiv, Leads zu senden"
            to="/dashboard/anfordern"
            icon={Inbox}
          />
          <FocusCard
            label="Reklamationen"
            value={dash ?? (workflow.pendingComplaints || 0)}
            hint="in Prüfung"
            to="/dashboard/reklamationen"
            icon={Flag}
          />
          <FocusCard
            label="Ohne Berater"
            value={dash ?? (admin?.unmatched || 0)}
            hint="Leads im Pool"
            to="/dashboard/leads"
            icon={ListChecks}
          />
          <FocusCard
            label="Unbestätigt"
            value={dash ?? counts.unverified}
            hint="E-Mail offen"
            to="/dashboard/nutzer"
            icon={AlertTriangle}
          />
        </div>
      </section>

      <section>
        <h3 className="dash-section-label">Bestand</h3>
        <div className="dash-metrics">
          <Metric label="Berater" value={dash ?? counts.berater} hint="Konten" to="/dashboard/berater" />
          <Metric label="Aktive Aufträge" value={dash ?? (workflow.activeRequests || 0)} hint="empfangsberechtigt" to="/dashboard/anfordern" />
          <Metric label="Zugestellt" value={dash ?? (workflow.deliveredLeads || 0)} hint="Leads gesendet" to="/dashboard/leads" />
          <Metric label="Ungültig" value={dash ?? (workflow.refundedLeads || 0)} hint="ersetzt nach Erstattung" to="/dashboard/leads/ungueltig" />
        </div>
      </section>

      <div className="dash-grid">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <strong>Anforderungen</strong>
              <p className="dash-panel-lede">Neueste Berater-Aufträge</p>
            </div>
            <Link to="/dashboard/anfordern">Alle</Link>
          </div>
          {workflow.recentRequests?.length ? (
            <div className="dash-lead-list">
              {workflow.recentRequests.map((entry) => (
                <Link
                  key={entry.id}
                  className="dash-lead-row"
                  to={entry.beraterId ? `/dashboard/berater/${entry.beraterId}` : '/dashboard/anfordern'}
                >
                  <span className="dash-avatar dash-avatar--sm" aria-hidden="true">
                    {initials(entry.berater || {})}
                  </span>
                  <div className="dash-lead-row-main">
                    <strong>
                      {entry.berater?.fullName || entry.berater?.email || 'Berater'}
                      {entry.code ? <span className="dash-request-code"> · {entry.code}</span> : null}
                    </strong>
                    <span className="dash-lead-row-sub">
                      {leadScopeLabel(entry.scope)} · {leadTypeLabel(entry.leadType)} · {entry.requestedCount} angefordert · {entry.validCount} gültig
                      {entry.payment ? ` · ${entry.payment.invoiceNumber} · ${formatEuroExact(entry.payment.grossCents)}` : ''}
                    </span>
                  </div>
                  <div className="dash-lead-row-side">
                    <span className={`dash-badge dash-badge--${requestStatusTone(entry.status)}`}>
                      {requestStatusLabel(entry.status)}
                    </span>
                    <small>{formatDate(entry.createdAt)}</small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="dash-empty">
              <p>Keine offenen Anforderungen. Neue Berater-Anforderungen erscheinen hier sofort.</p>
              <Link className="dash-btn dash-btn--ghost" to="/dashboard/anfordern">Zu den Anforderungen</Link>
            </div>
          )}
        </section>

        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <strong>Leads</strong>
              <p className="dash-panel-lede">
                {loading ? 'Laden…' : `${admin?.qualityQueue || 0} neu · ${admin?.unmatched || 0} ohne Berater`}
              </p>
            </div>
            <Link to="/dashboard/leads">Alle</Link>
          </div>
          {admin?.recentLeads?.length ? (
            <div className="dash-lead-list">
              {admin.recentLeads.map((lead) => (
                <LeadListItem key={lead.id} lead={lead} />
              ))}
            </div>
          ) : (
            <div className="dash-empty">
              <p>Noch keine Leads in der Warteschlange.</p>
              <Link className="dash-btn dash-btn--ghost" to="/dashboard/leads">Leads öffnen</Link>
            </div>
          )}
        </section>
      </div>

      <section className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <strong>Neue Konten</strong>
            <p className="dash-panel-lede">Zuletzt registriert</p>
          </div>
          <Link to="/dashboard/nutzer">Alle Nutzer</Link>
        </div>
        <UsersTable users={admin?.recentUsers} empty="Noch keine Nutzer geladen." />
      </section>
    </div>
  );
}

export function AdminUsers() {
  const { admin, loading } = useDashboard();

  return (
    <div className="dash-stack">
      <section className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <strong>Verzeichnis</strong>
            <p className="dash-panel-lede">
              {loading ? 'Laden…' : `${admin?.directory?.length || 0} Konten`}
            </p>
          </div>
          <Link to="/dashboard/berater">Berater</Link>
        </div>
        <UsersTable users={admin?.directory} empty="Keine Konten gefunden." />
      </section>
    </div>
  );
}

export function AdminPayment() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchAllPayments()
      .then((payload) => {
        if (active) setPayments(payload.payments || []);
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

  const paidCount = payments.filter((entry) => entry.status === 'paid').length;
  const paidTotal = payments
    .filter((entry) => entry.status === 'paid')
    .reduce((sum, entry) => sum + (entry.grossCents || 0), 0);

  return (
    <div className="dash-stack">
      {error ? <div className="dash-alert">{error}</div> : null}

      <div className="dash-metrics dash-metrics--three">
        <div className="dash-metric">
          <span>Zahlungen</span>
          <strong>{loading ? '—' : paidCount}</strong>
          <small>Testbetrieb, bezahlt</small>
        </div>
        <div className="dash-metric">
          <span>Umsatz</span>
          <strong>{loading ? '—' : formatEuroExact(paidTotal)}</strong>
          <small>inkl. MwSt.</small>
        </div>
        <div className="dash-metric">
          <span>Leads gekauft</span>
          <strong>{loading ? '—' : payments.reduce((sum, entry) => sum + (entry.leadCount || 0), 0)}</strong>
          <small>über Testzahlung</small>
        </div>
      </div>

      <section className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <strong>Zahlungseingänge</strong>
            <p className="dash-panel-lede">Kartendaten sind Testdaten — nur letzte 4 Ziffern, keine echte Belastung.</p>
          </div>
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : payments.length ? (
          <div className="dash-lead-list">
            {payments.map((entry) => (
              <article key={entry.id} className="dash-lead-row dash-request-row">
                <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
                  {initials(entry.berater || {})}
                </span>
                <div className="dash-lead-row-main">
                  <strong>{entry.berater?.fullName || entry.berater?.email || 'Berater'}</strong>
                  <span className="dash-lead-row-sub">
                    {[entry.billingCompany || entry.berater?.company, entry.billingEmail || entry.berater?.email]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="dash-lead-row-tags">
                    {entry.invoiceNumber} · {leadScopeLabel(entry.scope)} · {entry.leadCount} Leads · {entry.packageLabel}
                  </span>
                  <span className="dash-lead-row-tags">
                    {formatCardMask(entry)} · {formatCardExpiry(entry)}
                    {entry.cardHolder ? ` · ${entry.cardHolder}` : ''}
                    {entry.testMode ? ' · Testbetrieb' : ''}
                  </span>
                </div>
                <div className="dash-lead-row-side">
                  <span className="dash-badge dash-badge--ok">Bezahlt</span>
                  <strong>{formatEuroExact(entry.grossCents)}</strong>
                  <small>{formatDateTime(entry.paidAt || entry.createdAt)}</small>
                  {entry.beraterId ? (
                    <div className="dash-row-actions">
                      <Link className="dash-btn dash-btn--ghost" to={`/dashboard/berater/${entry.beraterId}`}>
                        Berater
                      </Link>
                      <Link className="dash-btn dash-btn--ghost" to="/dashboard/anfordern">
                        Anforderung
                      </Link>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="dash-empty">
            <p>Noch keine Testzahlungen. Sobald ein Berater ein Paket kauft, erscheint der Vorgang hier.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function adminProfileForm(user) {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    avatarUrl: user?.avatarUrl || '',
  };
}

function PasswordField({ label, value, onChange, show, onToggle, autoComplete, disabled }) {
  return (
    <label className="is-full">
      {label}
      <div className="password-input-wrapper">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggle}
          aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
        >
          {show ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </button>
      </div>
    </label>
  );
}

export function AdminProfile() {
  const { user, updateProfile, changePassword } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState(() => adminProfileForm(user));
  const [avatarName, setAvatarName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    setForm(adminProfileForm(user));
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
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  };

  const saveProfile = async (event) => {
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
    setSaving(true);
    try {
      await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        avatarUrl: form.avatarUrl,
      });
      setAvatarName('');
      showToast('Profil gespeichert');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (!currentPassword) {
      setPasswordError('Bitte geben Sie Ihr aktuelles Passwort ein.');
      return;
    }
    const nextError = validatePassword(password);
    if (nextError) {
      setPasswordError(nextError);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, password });
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      showToast('Passwort wurde geändert');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="dash-stack">
      <form className="dash-panel" onSubmit={saveProfile}>
        <div className="dash-panel-head">
          <div>
            <strong>Admin-Konto</strong>
            <p className="dash-panel-lede">Persönliche Angaben für den einzigen Admin — unabhängig von Berater-Stammdaten.</p>
          </div>
          <span className="dash-badge dash-badge--muted">{roleLabel(user?.role)}</span>
        </div>

        {error ? <div className="dash-alert">{error}</div> : null}

        <div className="dash-profile-id">
          <span className="dash-avatar dash-avatar--lg" aria-hidden="true">
            {form.avatarUrl
              ? <img src={form.avatarUrl} alt="" />
              : initials({ firstName: form.firstName, lastName: form.lastName, email: user?.email })}
          </span>
          <div className="dash-profile-id-copy">
            <label className="dash-file">
              <input type="file" accept="image/*" onChange={handleAvatar} disabled={saving} />
              <span className="dash-btn dash-btn--ghost">Bild wählen</span>
            </label>
            <small>
              {avatarName || (form.avatarUrl ? 'Aktuelles Bild behalten' : 'Kein Bild hinterlegt')}
            </small>
            {form.avatarUrl ? (
              <button
                type="button"
                className="dash-text-btn"
                disabled={saving}
                onClick={() => {
                  setForm((prev) => ({ ...prev, avatarUrl: '' }));
                  setAvatarName('');
                }}
              >
                Bild entfernen
              </button>
            ) : null}
          </div>
        </div>

        <div className="dash-form">
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
            E-Mail-Adresse
            <input type="email" value={user?.email || ''} autoComplete="email" disabled />
          </label>
          <label className="is-full">
            Telefon <span className="dash-optional">freiwillig</span>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              disabled={saving}
            />
          </label>
        </div>

        <div className="dash-form-actions">
          <button type="submit" className="dash-btn" disabled={saving}>
            {saving ? 'Speichern…' : 'Profil speichern'}
          </button>
        </div>
      </form>

      <form className="dash-panel" onSubmit={savePassword}>
        <div className="dash-panel-head">
          <div>
            <strong>Passwort</strong>
            <p className="dash-panel-lede">Mindestens 8 Zeichen, Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.</p>
          </div>
        </div>

        {passwordError ? <div className="dash-alert">{passwordError}</div> : null}

        <div className="dash-form">
          <PasswordField
            label="Aktuelles Passwort"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((value) => !value)}
            autoComplete="current-password"
            disabled={savingPassword}
          />
          <PasswordField
            label="Neues Passwort"
            value={password}
            onChange={setPassword}
            show={showNew}
            onToggle={() => setShowNew((value) => !value)}
            autoComplete="new-password"
            disabled={savingPassword}
          />
          <PasswordField
            label="Passwort bestätigen"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm((value) => !value)}
            autoComplete="new-password"
            disabled={savingPassword}
          />
        </div>

        <div className="dash-form-actions">
          <button type="submit" className="dash-btn" disabled={savingPassword}>
            {savingPassword ? 'Wird gespeichert…' : 'Passwort ändern'}
          </button>
        </div>
      </form>
    </div>
  );
}
