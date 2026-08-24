import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  GitMerge,
  LogOut,
  ListChecks,
  Landmark,
  User,
} from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../hooks/useAuth';
import { roleLabel } from '../../lib/roles';
import { firstName, initials } from './helpers';

const BERATER_LINKS = [
  { to: '/dashboard', end: true, label: 'Meine Leads', icon: ListChecks },
  { to: '/dashboard/zahlung', label: 'Zahlung', icon: Landmark },
];

const ADMIN_LINKS = [
  { to: '/dashboard', end: true, label: 'Übersicht', icon: LayoutDashboard },
  { to: '/dashboard/nutzer', label: 'Nutzer', icon: Users },
  { to: '/dashboard/qualitaet', label: 'Qualität', icon: ShieldCheck },
  { to: '/dashboard/matching', label: 'Matching', icon: GitMerge },
  { to: '/dashboard/profil', label: 'Profil', icon: User },
];

function pageCopy(pathname) {
  if (pathname.startsWith('/dashboard/zahlung')) {
    return { title: 'Zahlung', subtitle: 'Guthaben für den nächsten Lead bereithalten.' };
  }
  if (pathname.startsWith('/dashboard/profil')) {
    return { title: 'Profil', subtitle: 'Name, E-Mail und Passwort verwalten.' };
  }
  return { title: 'Meine Leads', subtitle: 'Ihre gekauften Chancen an einem Ort.' };
}

function AdminShell({ user, logout, children }) {
  return (
    <div className="dash">
      <aside className="dash-sidebar">
        <Link className="dash-brand" to="/dashboard" aria-label="VANTARO Workspace">
          <span className="dash-brand-mark">V</span>
          <span>
            <strong>VANTARO</strong>
            <small>Admin</small>
          </span>
        </Link>
        <nav className="dash-nav" aria-label="Workspace">
          {ADMIN_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                <Icon size={16} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="dash-sidebar-foot">
          <Link className="dash-site-link" to="/">Zur Startseite</Link>
          <div className="dash-user-card">
            <span className="dash-avatar">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user)}
            </span>
            <span>
              <strong>{user.fullName || user.email}</strong>
              <small>{user.profile?.company || roleLabel(user.role)}</small>
            </span>
          </div>
          <button
            type="button"
            className="dash-logout"
            onClick={() => logout()}
          >
            <LogOut size={16} />
            Abmelden
          </button>
        </div>
      </aside>
      <div className="dash-main">
        <header className="dash-top">
          <div>
            <p className="dash-kicker">Betrieb</p>
            <h1>Admin-Dashboard</h1>
          </div>
          <span className="dash-period">Heute</span>
        </header>
        <div className="dash-body">{children}</div>
      </div>
    </div>
  );
}

function AccountMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
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
    <div className={`broker-account${open ? ' is-open' : ''}`} ref={menuRef}>
      <button
        type="button"
        className="broker-profile-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="broker-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user)}
        </span>
        <span className="broker-profile-name">{user.fullName || firstName(user)}</span>
        <svg className="broker-caret-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="broker-account-menu" role="menu">
          <Link
            to="/dashboard/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Profil
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Abmelden
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BeraterShell({ user, logout, children }) {
  const location = useLocation();
  const copy = pageCopy(location.pathname);

  return (
    <div className="broker">
      <aside className="broker-nav">
        <Brand to="/dashboard" />
        <div className="broker-nav-end">
          <nav aria-label="Workspace">
            {BERATER_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                >
                  <Icon size={16} />
                  {link.label}
                </NavLink>
              );
            })}
          </nav>
          <AccountMenu user={user} logout={logout} />
        </div>
      </aside>

      <div className="broker-content">
        <header className="broker-topbar">
          <div>
            <div className="broker-topbar-title">{copy.title}</div>
            <div className="broker-topbar-subtitle">{copy.subtitle}</div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  const { user, isAdmin, logout } = useAuth();

  if (isAdmin) {
    return (
      <AdminShell user={user} logout={logout}>
        {children}
      </AdminShell>
    );
  }

  return (
    <BeraterShell user={user} logout={logout}>
      {children}
    </BeraterShell>
  );
}
