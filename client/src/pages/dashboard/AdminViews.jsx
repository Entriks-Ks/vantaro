import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Flag,
  Inbox,
  ListChecks,
} from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { leadTypeLabel, requestStatusLabel, requestStatusTone } from '../../lib/berater';
import { roleLabel } from '../../lib/roles';
import { LeadListItem } from './AdminLeads';
import { formatDate, initials } from './helpers';

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
          {entry.verified ? (entry.onboardingComplete ? 'Verifiziert' : 'E-Mail ok') : 'Unbestätigt'}
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
            label="Anfragen"
            value={dash ?? (workflow.pendingRequests || 0)}
            hint="warten auf Freigabe"
            to="/dashboard/anfragen"
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
          <Metric label="Aktive Aufträge" value={dash ?? (workflow.activeRequests || 0)} hint="empfangsberechtigt" to="/dashboard/anfragen" />
          <Metric label="Zugestellt" value={dash ?? (workflow.deliveredLeads || 0)} hint="Leads gesendet" to="/dashboard/leads" />
          <Metric label="Erstattet" value={dash ?? (workflow.refundedLeads || 0)} hint="verworfene Leads" to="/dashboard/leads/abgelehnt" />
        </div>
      </section>

      <div className="dash-grid">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <strong>Anfragen</strong>
              <p className="dash-panel-lede">Neueste Berater-Aufträge</p>
            </div>
            <Link to="/dashboard/anfragen">Alle</Link>
          </div>
          {workflow.recentRequests?.length ? (
            <div className="dash-lead-list">
              {workflow.recentRequests.map((entry) => (
                <Link
                  key={entry.id}
                  className="dash-lead-row"
                  to={entry.beraterId ? `/dashboard/berater/${entry.beraterId}` : '/dashboard/anfragen'}
                >
                  <span className="dash-avatar dash-avatar--sm" aria-hidden="true">
                    {initials(entry.berater || {})}
                  </span>
                  <div className="dash-lead-row-main">
                    <strong>{entry.berater?.fullName || entry.berater?.email || 'Berater'}</strong>
                    <span className="dash-lead-row-sub">
                      {leadTypeLabel(entry.leadType)} · {entry.requestedCount} angefragt · {entry.validCount} gültig
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
              <p>Keine offenen Anfragen. Neue Berater-Anfragen erscheinen hier sofort.</p>
              <Link className="dash-btn dash-btn--ghost" to="/dashboard/anfragen">Zu den Anfragen</Link>
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
  return (
    <div className="dash-stack">
      <EmptyPanel
        title="Zahlungen"
        text="Noch keine Zahlungsaktivitäten. Sobald Berater aufladen oder Leads kaufen, erscheint der Verlauf hier."
      />
    </div>
  );
}
