import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  LogOut,
  ListChecks,
  Landmark,
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
  { to: '/dashboard', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/nutzer', label: 'Nutzer', icon: Users },
  { to: '/dashboard/leads', label: 'Leads', icon: ListChecks },
  { to: '/dashboard/zahlung', label: 'Zahlung', icon: Landmark },
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

const ADMIN_SIDEBAR_KEY = 'vantaro-admin-sidebar';

function readAdminSidebarCollapsed() {
  try {
    return localStorage.getItem(ADMIN_SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function AdminShell({ user, logout, children }) {
  const [collapsed, setCollapsed] = useState(readAdminSidebarCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_SIDEBAR_KEY, collapsed ? 'collapsed' : 'open');
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed]);

  return (
    <div className={`dash${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="dash-sidebar">
        <button
          type="button"
          className="dash-brand"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-controls="dash-sidebar-nav"
          aria-label={collapsed ? 'Seitenleiste öffnen' : 'Seitenleiste schließen'}
          title={collapsed ? 'Seitenleiste öffnen' : 'Seitenleiste schließen'}
        >
          <img
            className="dash-brand-icon"
            src="/favicon.svg"
            alt=""
            width={36}
            height={36}
          />
          <img
            className="dash-brand-logo"
            src="/logo.svg"
            alt="VANTARO"
            width={148}
            height={16}
          />
        </button>
        <nav className="dash-nav" id="dash-sidebar-nav" aria-label="Workspace">
          {ADMIN_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                title={link.label}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                <Icon size={16} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="dash-sidebar-foot">
          <div className="dash-account">
            <Link
              className="dash-account-profile"
              to="/dashboard/profil"
              title="Profil"
            >
              <span className="dash-avatar">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user)}
              </span>
              <span className="dash-user-copy">
                <strong>{user.fullName || user.email}</strong>
                <small>{user.profile?.company || roleLabel(user.role)}</small>
              </span>
            </Link>
            <button
              type="button"
              className="dash-account-logout"
              onClick={() => logout()}
              title="Abmelden"
              aria-label="Abmelden"
            >
              <LogOut size={16} />
            </button>
          </div>
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
