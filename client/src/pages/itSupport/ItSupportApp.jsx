import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  CircleUserRound,
  CreditCard,
  Database,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  PlugZap,
  ScrollText,
  Search,
  Sun,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';
import { readThemePreference, resolveTheme, subscribeTheme, writeThemePreference } from '../../lib/theme';
import { getLang, L, pick, setLang } from './i18n';
import { ToastProvider, useApi } from './ui';
import Overview from './Overview';
import LeadsPage from './Leads';
import AppointmentsPage from './Appointments';
import UsersPage from './Users';
import PaymentsPage from './Payments';
import IntegrationsPage from './Integrations';
import SystemErrorsPage from './SystemErrors';
import ActivityPage from './Activity';
import SearchPage from './SearchPage';
import DatabasePage from './Database';
import ProfilePage, { Avatar } from './Profile';
import './itSupport.css';

const NAV = [
  { to: '/it-support', end: true, label: ['Übersicht', 'Overview'], icon: LayoutDashboard },
  { section: ['Daten', 'Data'] },
  { to: '/it-support/leads', label: ['Leads', 'Leads'], icon: ListChecks, badge: 'leads' },
  { to: '/it-support/appointments', label: ['Termine', 'Appointments'], icon: CalendarClock, badge: 'appointments' },
  { to: '/it-support/users', label: ['Nutzer', 'Users'], icon: Users },
  { to: '/it-support/payments', label: ['Zahlungen', 'Payments'], icon: CreditCard, badge: 'payments' },
  { section: ['Technik', 'Technical'] },
  { to: '/it-support/database', label: ['Datenbank', 'Database'], icon: Database },
  { to: '/it-support/integrations', label: ['Integrationen', 'Integrations'], icon: PlugZap, badge: 'integrations' },
  { to: '/it-support/errors', label: ['Systemfehler', 'System errors'], icon: TriangleAlert, badge: 'errors' },
  { to: '/it-support/activity', label: ['Aktivitätsprotokoll', 'Activity log'], icon: ScrollText },
];

// Earlier German URLs keep working.
const LEGACY_PATHS = {
  termine: 'appointments',
  nutzer: 'users',
  zahlungen: 'payments',
  integrationen: 'integrations',
  systemfehler: 'errors',
  aktivitaet: 'activity',
  suche: 'search',
};

const PAGE_TITLES = {
  '': ['Übersicht', 'Overview'],
  leads: ['Leads', 'Leads'],
  appointments: ['Termine', 'Appointments'],
  users: ['Nutzer', 'Users'],
  payments: ['Zahlungen', 'Payments'],
  database: ['Datenbank', 'Database'],
  profile: ['Mein Profil', 'My profile'],
  integrations: ['Integrationen', 'Integrations'],
  errors: ['Systemfehler', 'System errors'],
  activity: ['Aktivitätsprotokoll', 'Activity log'],
  search: ['Suche', 'Search'],
};

function LegacyRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={`/it-support/${to}${location.search}${location.hash}`} replace />;
}

function badgeCounts(overview) {
  if (!overview) return {};
  const sum = (area, severities = ['error', 'warning']) => (overview.checks || [])
    .filter((check) => check.area === area && severities.includes(check.severity))
    .reduce((total, check) => total + (check.count || 0), 0);
  const appointmentChecks = (overview.checks || [])
    .filter((check) => ['appointment_reminder_missed', 'follow_up_reminder_missed', 'termin_without_date', 'wiedervorlage_without_date'].includes(check.id))
    .reduce((total, check) => total + (check.count || 0), 0);
  return {
    leads: sum('leads') - appointmentChecks,
    appointments: appointmentChecks,
    payments: sum('payments'),
    integrations: (overview.integrations || []).filter((entry) => entry.status === 'error').length + (overview.schema?.missingCount || 0),
    errors: overview.errors?.errors || 0,
  };
}

function ThemeToggle() {
  const { updateProfile } = useAuth();
  const [resolved, setResolved] = useState(() => resolveTheme(readThemePreference()));
  useEffect(() => subscribeTheme((applied) => setResolved(applied?.resolved || resolveTheme(readThemePreference()))), []);
  const next = resolved === 'dark' ? 'light' : 'dark';
  const Icon = resolved === 'dark' ? Sun : Moon;
  const text = next === 'light' ? L('Helles Design', 'Light theme') : L('Dunkles Design', 'Dark theme');
  const toggle = () => {
    setResolved(writeThemePreference(next).resolved);
    // Saved on the account like in the portal, so the choice survives reloads and other devices.
    updateProfile({ settings: { appearance: next } }).catch(() => {});
  };
  return (
    <button type="button" className="its-icon-btn" onClick={toggle} aria-label={text} title={text}>
      <Icon size={16} />
    </button>
  );
}

function LanguageToggle({ lang, onChange }) {
  return (
    <div className="its-lang" role="group" aria-label={L('Sprache', 'Language')}>
      {[['en', 'EN', 'English'], ['de', 'DE', 'Deutsch']].map(([value, short, name]) => (
        <button
          key={value}
          type="button"
          className={lang === value ? 'is-active' : undefined}
          aria-pressed={lang === value}
          title={name}
          onClick={() => onChange(value)}
        >
          {short}
        </button>
      ))}
    </div>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState('');
  useEffect(() => {
    if (location.pathname === '/it-support/search') {
      setValue(new URLSearchParams(location.search).get('q') || '');
    }
  }, [location.pathname, location.search]);
  return (
    <form
      className="its-global-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        if (!q) return;
        navigate(`/it-support/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search size={15} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={L('Lead, Nutzer, Rechnung oder ID suchen …', 'Search lead, user, invoice or ID …')}
        aria-label={L('Überall suchen', 'Search everywhere')}
      />
      <kbd>Enter</kbd>
    </form>
  );
}

function Shell({ lang, onLang }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const overview = useApi('/overview');
  const badges = badgeCounts(overview.data);

  useEffect(() => setMenuOpen(false), [location.pathname]);
  // Keep sidebar badges current while the console stays open.
  useEffect(() => {
    const timer = window.setInterval(overview.reload, 60_000);
    return () => window.clearInterval(timer);
  }, [overview.reload]);

  useEffect(() => {
    const section = location.pathname.replace(/^\/it-support\/?/, '').split('/')[0];
    const page = PAGE_TITLES[section] || PAGE_TITLES[''];
    document.title = `${pick(page)} — ${L('IT-Support', 'IT Support')} — VANTARO`;
    document.documentElement.lang = lang;
  }, [location.pathname, lang]);

  // Leaving the console: the rest of VANTARO is German.
  useEffect(() => () => {
    document.documentElement.lang = 'de';
  }, []);

  return (
    <div className="its">
      <aside className={`its-side${menuOpen ? ' is-open' : ''}`}>
        <div className="its-side-brand">
          <Link to="/it-support" className="its-logo" aria-label={L('IT-Support Übersicht', 'IT Support overview')}>
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span>
              <strong>VANTARO</strong>
              <em>{L('IT-Support', 'IT Support')}</em>
            </span>
          </Link>
          <button type="button" className="its-icon-btn its-only-mobile" onClick={() => setMenuOpen(false)} aria-label={L('Menü schließen', 'Close menu')}>
            <X size={16} />
          </button>
        </div>
        <nav className="its-nav" aria-label={L('IT-Support', 'IT Support')}>
          {NAV.map((item) => {
            if (item.section) return <span key={item.section[1]} className="its-nav-section">{pick(item.section)}</span>;
            const Icon = item.icon;
            const count = item.badge ? badges[item.badge] : 0;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `its-nav-link${isActive ? ' is-active' : ''}`}>
                <Icon size={16} aria-hidden="true" />
                <span>{pick(item.label)}</span>
                {count > 0 ? <em className="its-nav-badge" aria-label={L(`${count} Probleme`, `${count} problems`)}>{count > 99 ? '99+' : count}</em> : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="its-side-foot">
          {isAdmin ? (
            <Link to="/dashboard" className="its-nav-link">
              <Gauge size={16} aria-hidden="true" />
              <span>{L('Zum Admin-Portal', 'Back to admin portal')}</span>
            </Link>
          ) : null}
          <NavLink to="/it-support/profile" className={({ isActive }) => `its-nav-link${isActive ? ' is-active' : ''}`}>
            <CircleUserRound size={16} aria-hidden="true" />
            <span>{L('Mein Profil', 'My profile')}</span>
          </NavLink>
          <div className="its-user">
            <Link to="/it-support/profile" className="its-user-link" title={L('Mein Profil', 'My profile')}>
              <Avatar user={user} />
              <span className="its-user-text">
                <strong>{user?.fullName || user?.email}</strong>
                <em>{isAdmin ? 'Admin' : L('IT-Support', 'IT Support')}</em>
              </span>
            </Link>
            <ThemeToggle />
            <button type="button" className="its-icon-btn" onClick={logout} aria-label={L('Abmelden', 'Sign out')} title={L('Abmelden', 'Sign out')}>
              <LogOut size={16} />
            </button>
          </div>
          <LanguageToggle lang={lang} onChange={onLang} />
        </div>
      </aside>
      {menuOpen ? <button type="button" className="its-side-scrim" aria-label={L('Menü schließen', 'Close menu')} onClick={() => setMenuOpen(false)} /> : null}

      <div className="its-main">
        <header className="its-top">
          <button type="button" className="its-icon-btn its-only-mobile" onClick={() => setMenuOpen(true)} aria-label={L('Menü öffnen', 'Open menu')}>
            <Menu size={18} />
          </button>
          <GlobalSearch />
          {overview.data && overview.data.auditReady === false ? (
            <span className="its-top-warn" title="server/supabase/it_support.sql">
              <TriangleAlert size={14} /> {L('Aktivitätsprotokoll fehlt – Änderungen gesperrt', 'Activity log missing – changes blocked')}
            </span>
          ) : null}
        </header>
        <main className="its-content" id="inhalt">
          <Routes>
            <Route index element={<Overview overview={overview} />} />
            <Route path="leads" element={<LeadsPage onChanged={overview.reload} />} />
            <Route path="appointments" element={<AppointmentsPage onChanged={overview.reload} />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="payments" element={<PaymentsPage onChanged={overview.reload} />} />
            <Route path="database" element={<DatabasePage />} />
            <Route path="profile" element={<ProfilePage lang={lang} onLang={onLang} />} />
            <Route path="integrations" element={<IntegrationsPage onChanged={overview.reload} />} />
            <Route path="errors" element={<SystemErrorsPage onChanged={overview.reload} />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="search" element={<SearchPage />} />
            {Object.entries(LEGACY_PATHS).map(([from, to]) => (
              <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
            ))}
            <Route path="*" element={<Navigate to="/it-support" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function ItSupportApp() {
  const { role } = useAuth();
  const [lang, setLangState] = useState(getLang);
  if (role !== ROLES.IT_SUPPORT && role !== ROLES.ADMIN) return <Navigate to="/dashboard" replace />;
  const changeLang = (next) => {
    if (next === lang) return;
    setLang(next);
    setLangState(next);
  };
  // key={lang}: remount so every label, list and request switches language together.
  return (
    <ToastProvider key={lang}>
      <Shell lang={lang} onLang={changeLang} />
    </ToastProvider>
  );
}
