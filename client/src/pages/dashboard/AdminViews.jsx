import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Inbox,
  KeyRound,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Save,
  Shield,
  Trash2,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import { useDashboard } from '../../hooks/useDashboard';
import { leadTypeLabel, requestStatusLabel, requestStatusTone } from '../../lib/berater';
import { leadScopeLabel } from '../../lib/scopes';
import { fileToAvatarDataUrl, generatePassword, validatePassword } from '../../lib/profile';
import PhoneField, { formatPhoneDisplay, isValidMobile } from '../../components/PhoneField';
import ThemeMode from '../../components/ThemeMode';
import { roleLabel } from '../../lib/roles';
import { LeadListItem } from './AdminLeads';
import { displayName, formatDate, formatEuroExact, initials } from './helpers';

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

function n(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function DonutChart({ segments, centerValue, centerLabel }) {
  const size = 148;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, entry) => sum + n(entry.value), 0) || 1;
  let offset = 0;

  return (
    <div className="dash-donut" role="img" aria-label={centerLabel}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="dash-donut-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        {segments.map((entry) => {
          const value = n(entry.value);
          const length = total > 0 ? (value / total) * circumference : 0;
          const slice = (
            <circle
              key={entry.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={entry.color}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += length;
          return slice;
        })}
      </svg>
      <div className="dash-donut-center">
        <strong>{centerValue}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <ul className="dash-chart-legend">
      {items.map((item) => {
        const row = (
          <>
            <i style={{ background: item.color }} aria-hidden="true" />
            <span>{item.label}</span>
            <em>{item.display ?? item.value}</em>
          </>
        );
        return (
          <li key={item.id}>
            {item.to ? (
              <Link className="dash-chart-legend-row" to={item.to}>{row}</Link>
            ) : (
              <div className="dash-chart-legend-row">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function HBarChart({ rows, loading }) {
  const max = Math.max(...rows.map((row) => n(row.value)), 1);
  return (
    <div className="dash-hbar">
      {rows.map((row) => {
        const value = n(row.value);
        const width = loading ? 0 : Math.max((value / max) * 100, value > 0 ? 6 : 0);
        const inner = (
          <>
            <div className="dash-hbar-meta">
              <span>{row.label}</span>
              <em>{loading ? '—' : value}</em>
            </div>
            <div className="dash-hbar-track" aria-hidden="true">
              <span style={{ width: `${width}%`, background: row.color }} />
            </div>
          </>
        );
        return row.to ? (
          <Link key={row.id} className="dash-hbar-row is-link" to={row.to}>
            {inner}
          </Link>
        ) : (
          <div key={row.id} className="dash-hbar-row">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function StackBoard({ title, lede, segments, total, loading, action, to }) {
  const sum = segments.reduce((acc, entry) => acc + n(entry.value), 0) || 1;
  return (
    <section className="dash-panel dash-board-card">
      <div className="dash-panel-head">
        <div>
          <strong>{title}</strong>
          {lede ? <p className="dash-panel-lede">{lede}</p> : null}
        </div>
        {to ? <Link to={to}>{action}</Link> : null}
      </div>
      <div className="dash-stack-board" aria-hidden={loading}>
        <div className="dash-stack-track">
          {segments.map((entry) => {
            const value = n(entry.value);
            const pct = loading || value <= 0 ? 0 : Math.max((value / sum) * 100, 3);
            return (
              <span
                key={entry.id}
                className="dash-stack-seg"
                style={{ width: `${pct}%`, background: entry.color }}
                title={`${entry.label}: ${value}`}
              />
            );
          })}
        </div>
        <div className="dash-stack-total">
          <strong>{loading ? '—' : total}</strong>
          <span>gesamt</span>
        </div>
      </div>
      <ChartLegend
        items={segments.map((entry) => ({
          ...entry,
          display: loading ? '—' : entry.value,
        }))}
      />
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

  const requestSegments = useMemo(() => ([
    { id: 'active', label: 'Aktiv', value: n(workflow.activeRequests), color: '#37cdc0', to: '/dashboard/anfordern' },
    { id: 'paused', label: 'Pausiert', value: n(workflow.pausedRequests), color: '#f0b45a', to: '/dashboard/anfordern' },
    { id: 'done', label: 'Erfüllt', value: n(workflow.completedRequests), color: '#7aa2ff', to: '/dashboard/anfordern' },
  ]), [workflow.activeRequests, workflow.pausedRequests, workflow.completedRequests]);

  const requestTotal = requestSegments.reduce((sum, entry) => sum + entry.value, 0);

  const leadRows = useMemo(() => ([
    { id: 'queue', label: 'Neu in Warteschlange', value: n(admin?.qualityQueue), color: '#56d3c4', to: '/dashboard/leads' },
    { id: 'pool', label: 'Ohne Berater', value: n(admin?.unmatched), color: '#7aa2ff', to: '/dashboard/leads' },
    { id: 'sent', label: 'Zugestellt', value: n(workflow.deliveredLeads), color: '#9ad67a', to: '/dashboard/leads' },
    { id: 'invalid', label: 'Ungültig', value: n(workflow.refundedLeads), color: '#ff755a', to: '/dashboard/leads/ungueltig' },
  ]), [admin?.qualityQueue, admin?.unmatched, workflow.deliveredLeads, workflow.refundedLeads]);

  const complaintRows = useMemo(() => ([
    { id: 'pending', label: 'In Prüfung', value: n(workflow.pendingComplaints), color: '#ff755a', to: '/dashboard/reklamationen' },
    { id: 'approved', label: 'Genehmigt', value: n(workflow.approvedComplaints), color: '#37cdc0', to: '/dashboard/reklamationen' },
    { id: 'declined', label: 'Abgelehnt', value: n(workflow.declinedComplaints), color: '#8ea0b8', to: '/dashboard/reklamationen' },
  ]), [workflow.pendingComplaints, workflow.approvedComplaints, workflow.declinedComplaints]);

  const accountSegments = useMemo(() => ([
    { id: 'berater', label: 'Berater', value: n(counts.berater), color: '#56d3c4', to: '/dashboard/berater' },
    { id: 'admin', label: 'Admin', value: n(counts.admin), color: '#7aa2ff', to: '/dashboard/nutzer' },
  ]), [counts.berater, counts.admin]);

  return (
    <div className="dash-stack">
      {error ? <div className="dash-alert">{error}</div> : null}

      <section>
        <h3 className="dash-section-label">Jetzt prüfen</h3>
        <div className="dash-focus-grid">
          <FocusCard
            label="Anforderungen"
            value={dash ?? (workflow.pendingRequests || 0)}
            hint="ungesehen, prüfen"
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
        <h3 className="dash-section-label">Lagebild</h3>
        <div className="dash-board-grid">
          <section className="dash-panel dash-board-card">
            <div className="dash-panel-head">
              <div>
                <strong>Auftragsstatus</strong>
                <p className="dash-panel-lede">Verteilung aktiver Anforderungen</p>
              </div>
              <Link to="/dashboard/anfordern">Alle</Link>
            </div>
            <div className="dash-donut-layout">
              <DonutChart
                segments={requestSegments}
                centerValue={loading ? '—' : requestTotal}
                centerLabel="Aufträge"
              />
              <ChartLegend
                items={requestSegments.map((entry) => ({
                  ...entry,
                  display: loading ? '—' : entry.value,
                }))}
              />
            </div>
          </section>

          <section className="dash-panel dash-board-card">
            <div className="dash-panel-head">
              <div>
                <strong>Lead-Bestand</strong>
                <p className="dash-panel-lede">Pool, Zustellung und Erstattung</p>
              </div>
              <Link to="/dashboard/leads">Öffnen</Link>
            </div>
            <HBarChart rows={leadRows} loading={loading} />
          </section>

          <section className="dash-panel dash-board-card">
            <div className="dash-panel-head">
              <div>
                <strong>Reklamationen</strong>
                <p className="dash-panel-lede">Status der offenen Fälle</p>
              </div>
              <Link to="/dashboard/reklamationen">Prüfen</Link>
            </div>
            <HBarChart rows={complaintRows} loading={loading} />
          </section>
        </div>
      </section>

      <section>
        <h3 className="dash-section-label">Bestand</h3>
        <div className="dash-board-split">
          <StackBoard
            title="Konten"
            lede={loading ? 'Zusammensetzung im Portal' : `${counts.unverified || 0} unbestätigt · ${counts.total || 0} gesamt`}
            segments={accountSegments}
            total={n(counts.total) || accountSegments.reduce((sum, entry) => sum + entry.value, 0)}
            loading={loading}
            action="Nutzer"
            to="/dashboard/nutzer"
          />
          <div className="dash-metrics dash-metrics--board">
            <Metric label="Berater" value={dash ?? counts.berater} hint="Konten" to="/dashboard/berater" />
            <Metric label="Aktive Aufträge" value={dash ?? (workflow.activeRequests || 0)} hint="empfangsberechtigt" to="/dashboard/anfordern" />
            <Metric label="Zugestellt" value={dash ?? (workflow.deliveredLeads || 0)} hint="Leads gesendet" to="/dashboard/leads" />
            <Metric label="Ungültig" value={dash ?? (workflow.refundedLeads || 0)} hint="ersetzt nach Erstattung" to="/dashboard/leads/ungueltig" />
          </div>
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
                  to={`/dashboard/anfordern/${entry.id}`}
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
                      {entry.payment ? ` · ${entry.payment.invoiceNumber} · ${formatEuroExact(entry.payment.netCents || entry.payment.grossCents)}` : ''}
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

function adminProfileForm(user) {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
  };
}

function AdminProfileNav({ active }) {
  const { logout } = useAuth();
  const links = [
    { id: 'profil', to: '/dashboard/profil', label: 'Profil', icon: User },
    { id: 'sicherheit', to: '/dashboard/sicherheit', label: 'Sicherheit', icon: Shield },
  ];

  return (
    <nav className="dash-profile-nav" aria-label="Konto">
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
      <button
        type="button"
        className="dash-profile-nav__logout"
        onClick={() => logout()}
      >
        <LogOut size={16} strokeWidth={2} />
        Abmelden
      </button>
      <ThemeMode variant="nav" />
    </nav>
  );
}

function AdminSettingsShell({ active, children }) {
  return (
    <div className="dash-settings-layout">
      <AdminProfileNav active={active} />
      <div className="dash-settings-main">{children}</div>
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
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="admin-pw-modal-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={onClose} />
      <form className="broker-modal__panel broker-pw-modal" onSubmit={submit}>
        <div className="broker-pw-modal__head">
          <div>
            <h2 id="admin-pw-modal-title">Passwort ändern</h2>
            <p>Geben Sie Ihr aktuelles Passwort ein und wählen Sie ein neues.</p>
          </div>
          <button type="button" className="broker-pw-modal__close" onClick={onClose} aria-label="Schließen">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="broker-pw-modal__body">
          {error ? <div className="dash-alert">{error}</div> : null}

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
            {saving ? 'Wird gespeichert…' : 'Passwort ändern'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AdminProfile() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useBroker();
  const avatarInputRef = useRef(null);
  const [form, setForm] = useState(() => adminProfileForm(user));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (!editing) setForm(adminProfileForm(user));
  }, [editing, user?.id, user?.firstName, user?.lastName, user?.phone]);

  const shownAvatar = user?.avatarUrl || '';
  const heroInitials = initials({
    firstName: user?.firstName,
    lastName: user?.lastName,
    email: user?.email,
  });
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || displayName(user) || 'Admin';
  const phoneShown = formatPhoneDisplay(user?.phone);
  const personalComplete = Boolean(user?.firstName && user?.lastName);
  const role = roleLabel(user?.role);

  const infoGroups = [
    {
      id: 'person',
      title: 'Person',
      icon: User,
      items: [
        { id: 'firstName', label: 'Vorname', value: user?.firstName },
        { id: 'lastName', label: 'Nachname', value: user?.lastName },
      ],
    },
    {
      id: 'contact',
      title: 'Kontakt',
      icon: Phone,
      items: [
        { id: 'phone', label: 'Telefon', value: phoneShown },
        { id: 'email', label: 'E-Mail-Adresse', value: user?.email, locked: true },
      ],
    },
    {
      id: 'access',
      title: 'Zugriff',
      icon: Shield,
      items: [
        { id: 'role', label: 'Rolle', value: role, locked: true },
      ],
    },
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openAvatarPicker = () => {
    avatarInputRef.current?.click();
  };

  const saveAvatar = async (avatarUrl) => {
    setError('');
    setAvatarSaving(true);
    try {
      await updateProfile({ avatarUrl });
      showToast(avatarUrl ? 'Profilbild gespeichert' : 'Profilbild entfernt');
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      await saveAvatar(avatarUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  };

  const startEditing = () => {
    setForm(adminProfileForm(user));
    setError('');
    setPhoneError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(adminProfileForm(user));
    setError('');
    setPhoneError('');
    setEditing(false);
  };

  const saveProfile = async (event) => {
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
    if (form.phone && !isValidMobile(form.phone)) {
      setPhoneError('Bitte geben Sie eine gültige Telefonnummer an.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone,
      });
      setEditing(false);
      showToast('Profil gespeichert');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminSettingsShell active="profil">
      <div className="dash-stack dash-stack--profile">
        {error ? <div className="dash-alert">{error}</div> : null}

        <section className="dash-profile-card" aria-label="Kontoübersicht">
          <div className="dash-profile-card__cover" aria-hidden="true" />
          <div className="dash-profile-card__body">
            <div className="dash-profile-card__avatar">
              <div className="dash-avatar dash-avatar--hero" aria-hidden="true">
                {shownAvatar ? <img src={shownAvatar} alt="" /> : heroInitials}
              </div>
              <div className="dash-profile-card__avatar-tools">
                <button
                  type="button"
                  className="dash-profile-card__avatar-btn"
                  onClick={openAvatarPicker}
                  disabled={avatarSaving}
                  aria-label={shownAvatar ? 'Profilbild ändern' : 'Profilbild hochladen'}
                  title={shownAvatar ? 'Profilbild ändern' : 'Profilbild hochladen'}
                >
                  <Camera size={15} strokeWidth={2.2} />
                </button>
                {shownAvatar ? (
                  <button
                    type="button"
                    className="dash-profile-card__avatar-btn is-danger"
                    onClick={() => saveAvatar('')}
                    disabled={avatarSaving}
                    aria-label="Profilbild entfernen"
                    title="Profilbild entfernen"
                  >
                    <Trash2 size={15} strokeWidth={2.2} />
                  </button>
                ) : null}
              </div>
              <input
                ref={avatarInputRef}
                id="admin-profile-avatar"
                type="file"
                accept="image/*"
                className="dash-profile-card__file"
                onChange={handleAvatar}
                disabled={avatarSaving}
              />
            </div>

            <div className="dash-profile-card__identity">
              <span className="dash-profile-card__kicker">Mein Profil</span>
              <h3 className="dash-profile-card__name">{fullName}</h3>
              {user?.email ? (
                <p className="dash-profile-card__email">
                  <Mail size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>{user.email}</span>
                </p>
              ) : null}
              <div className="dash-profile-card__chips">
                <span className="dash-profile-chip">
                  <Shield size={13} strokeWidth={2.2} aria-hidden="true" />
                  {role}
                </span>
                <span className={`dash-profile-chip ${personalComplete ? 'is-ok' : 'is-warn'}`}>
                  {personalComplete
                    ? <CheckCircle2 size={13} strokeWidth={2.2} aria-hidden="true" />
                    : <AlertCircle size={13} strokeWidth={2.2} aria-hidden="true" />}
                  {personalComplete ? 'Profil vollständig' : 'Name fehlt'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className={`dash-panel dash-panel--profile dash-profile-info${editing ? ' is-editing' : ''}`}>
          <header className="dash-profile-info__head">
            <span className="dash-profile-section__icon" aria-hidden="true">
              <User size={16} strokeWidth={2.2} />
            </span>
            <div className="dash-profile-info__heading">
              <h3>Persönliche Angaben</h3>
              <p>Name und optional Telefon für Ihr Admin-Konto.</p>
            </div>
            {!editing ? (
              <button type="button" className="dash-profile-btn dash-profile-btn--ghost" onClick={startEditing}>
                <Pencil size={15} strokeWidth={2.2} aria-hidden="true" />
                Bearbeiten
              </button>
            ) : null}
          </header>

          {!editing ? (
            <div className="dash-profile-info__groups">
              {infoGroups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.id} className="dash-profile-info__group">
                    <h4 className="dash-profile-info__group-title">
                      <span className="dash-profile-info__group-icon" aria-hidden="true">
                        <GroupIcon size={15} strokeWidth={2.2} />
                      </span>
                      {group.title}
                    </h4>
                    <dl className="dash-profile-info__list">
                      {group.items.map((item) => (
                        <div key={item.id} className="dash-profile-info__row">
                          <dt>
                            {item.label}
                            {item.locked ? (
                              <Lock size={11} strokeWidth={2.4} aria-label="Kann nicht geändert werden" />
                            ) : null}
                          </dt>
                          <dd>
                            <span
                              className={[
                                'dash-profile-info__value',
                                item.value ? '' : 'is-empty',
                              ].filter(Boolean).join(' ')}
                            >
                              {item.value || 'Nicht hinterlegt'}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          ) : (
            <form className="dash-profile-info__form" onSubmit={saveProfile}>
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
                    autoFocus
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
                  <PhoneField
                    id="admin-profile-phone"
                    value={form.phone}
                    onChange={(phone) => {
                      setPhoneError('');
                      setForm((prev) => ({ ...prev, phone }));
                    }}
                    disabled={saving}
                    className="vantaro-phone-input--light"
                    error={phoneError}
                  />
                </label>
              </div>
              <div className="dash-profile-info__actions">
                <p className="dash-form-actions__hint">Änderungen gelten sofort nach dem Speichern.</p>
                <div className="dash-profile-card__btns">
                  <button
                    type="button"
                    className="dash-profile-btn dash-profile-btn--ghost"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Abbrechen
                  </button>
                  <button type="submit" className="dash-profile-btn dash-profile-btn--primary" disabled={saving}>
                    <Save size={15} strokeWidth={2.2} aria-hidden="true" />
                    {saving ? 'Speichern…' : 'Speichern'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      </div>
    </AdminSettingsShell>
  );
}

export function AdminSecurity() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <AdminSettingsShell active="sicherheit">
      <div className="dash-stack dash-stack--profile">
        <section className="dash-panel dash-panel--profile dash-profile-action">
          <header className="dash-profile-info__head dash-profile-info__head--flush">
            <span className="dash-profile-section__icon" aria-hidden="true">
              <KeyRound size={16} strokeWidth={2.2} />
            </span>
            <div className="dash-profile-info__heading">
              <h3>Passwort</h3>
              <p>Mindestens 8 Zeichen, Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.</p>
            </div>
          </header>
          <button
            type="button"
            className="dash-profile-btn dash-profile-btn--primary"
            onClick={() => setModalOpen(true)}
          >
            <KeyRound size={15} strokeWidth={2.2} aria-hidden="true" />
            Passwort ändern
          </button>
        </section>
      </div>
      <ChangePasswordModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </AdminSettingsShell>
  );
}

