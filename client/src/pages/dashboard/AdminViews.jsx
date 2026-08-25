import { Link } from 'react-router-dom';
import { useDashboard } from '../../hooks/useDashboard';
import { roleLabel } from '../../lib/roles';
import { formatDate } from './helpers';

function Metric({ label, value, hint, tone }) {
  return (
    <div className={`dash-metric${tone ? ` dash-metric--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
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

function UsersTable({ users, empty }) {
  if (!users?.length) {
    return <div className="dash-empty"><p>{empty}</p></div>;
  }

  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Firma</th>
            <th>E-Mail</th>
            <th>Rolle</th>
            <th>Status</th>
            <th>Seit</th>
          </tr>
        </thead>
        <tbody>
          {users.map((entry) => (
            <tr key={entry.id}>
              <td>
                <div>{entry.fullName || '—'}</div>
                {entry.customerNumber ? <small>{entry.customerNumber}</small> : null}
              </td>
              <td>{entry.company || '—'}</td>
              <td>{entry.email}</td>
              <td>
                <span className={`dash-badge dash-badge--${entry.role}`}>
                  {roleLabel(entry.role)}
                </span>
              </td>
              <td className={entry.verified ? undefined : 'dash-unverified'}>
                {entry.verified
                  ? (entry.onboardingComplete ? 'Verifiziert' : 'E-Mail ok')
                  : 'Unbestätigt'}
              </td>
              <td>{formatDate(entry.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOverview() {
  const { admin, loading, error } = useDashboard();
  const counts = admin?.users || { total: 0, berater: 0, admin: 0, unverified: 0 };

  return (
    <div className="dash-stack">
      <div className="dash-intro">
        <div>
          <h2>Dashboard</h2>
          <p>Konten, Leads und Zahlungen im Überblick.</p>
        </div>
      </div>

      {error && <div className="dash-alert">{error}</div>}

      <div className="dash-metrics">
        <Metric label="Konten" value={loading ? '—' : counts.total} hint="gesamt" />
        <Metric label="Berater" value={loading ? '—' : counts.berater} hint="Workspace-Zugang" />
        <Metric label="Admins" value={loading ? '—' : counts.admin} hint="intern" />
        <Metric label="Unbestätigt" value={loading ? '—' : counts.unverified} hint="E-Mail offen" tone="signal" />
      </div>

      <div className="dash-grid">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <strong>Neue Konten</strong>
            <Link to="/dashboard/nutzer">Alle Nutzer</Link>
          </div>
          <UsersTable users={admin?.recentUsers} empty="Noch keine Nutzer geladen." />
        </section>
        <EmptyPanel
          title="Leads"
          action="Öffnen"
          to="/dashboard/leads"
          text="Noch keine Leads in der Warteschlange. Qualifizierte Kontakte erscheinen hier."
        />
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { admin, loading } = useDashboard();

  return (
    <div className="dash-stack">
      <div className="dash-intro">
        <div>
          <h2>Nutzer</h2>
          <p>Neue Konten sind Berater. Admins setzen Sie in Supabase unter App Metadata auf <code>role: admin</code>.</p>
        </div>
      </div>
      <section className="dash-panel">
        <div className="dash-panel-head">
          <strong>Verzeichnis</strong>
          <span>{loading ? 'Laden…' : `${admin?.directory?.length || 0} Konten`}</span>
        </div>
        <UsersTable users={admin?.directory} empty="Keine Konten gefunden." />
      </section>
    </div>
  );
}

export function AdminLeads() {
  return (
    <div className="dash-stack">
      <div className="dash-intro">
        <div>
          <h2>Leads</h2>
          <p>Eingehende Leads prüfen und verwalten.</p>
        </div>
      </div>
      <EmptyPanel
        title="Lead-Warteschlange"
        text="Noch keine Leads. Eingehende Kontakte erscheinen hier."
      />
    </div>
  );
}

export function AdminPayment() {
  return (
    <div className="dash-stack">
      <div className="dash-intro">
        <div>
          <h2>Zahlung</h2>
          <p>Guthaben und Zahlungen der Berater im Blick behalten.</p>
        </div>
      </div>
      <EmptyPanel
        title="Zahlungen"
        text="Noch keine Zahlungsaktivitäten."
      />
    </div>
  );
}
