import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  LogOut,
  ListChecks,
  Landmark,
  UserRound,
  Inbox,
  Flag,
  Ban,
  User,
  Building2,
  Settings,
} from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../hooks/useAuth';
import { roleLabel } from '../../lib/roles';
import { accountSetupCta, firstName, greeting, initials } from './helpers';

export function DashSeg({ value, onChange, options }) {
  return (
    <div className="dash-seg" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={value === option.id ? 'is-active' : undefined}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.count != null ? <em>{option.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

const BERATER_LINKS = [
  { to: '/dashboard', end: true, label: 'Übersicht', icon: LayoutDashboard },
  { to: '/dashboard/leads', label: 'Meine Leads', icon: ListChecks },
  { to: '/dashboard/zahlung', label: 'Zahlung', icon: Landmark },
];

const ADMIN_NAV = [
  {
    label: 'Übersicht',
    links: [{ to: '/dashboard', end: true, label: 'Übersicht', icon: LayoutDashboard }],
  },
  {
    label: 'Workflow',
    links: [
      { to: '/dashboard/anfordern', label: 'Anforderungen', icon: Inbox },
      { to: '/dashboard/reklamationen', label: 'Reklamationen', icon: Flag },
      { to: '/dashboard/leads/ungueltig', label: 'Ungültige Leads', icon: Ban },
    ],
  },
  {
    label: 'Bestand',
    links: [
      { to: '/dashboard/leads', end: true, label: 'Leads', icon: ListChecks },
      { to: '/dashboard/berater', label: 'Berater', icon: UserRound },
      { to: '/dashboard/nutzer', label: 'Nutzer', icon: Users },
    ],
  },
  {
    label: 'Konto',
    links: [
      { to: '/dashboard/zahlung', label: 'Zahlung', icon: Landmark },
    ],
  },
];

function adminPageCopy(pathname, user) {
  if (pathname.startsWith('/dashboard/zahlung')) {
    return { kicker: 'Konto', title: 'Zahlung', subtitle: 'Testzahlungen der Berater — Rechnung und Kartendaten.' };
  }
  if (pathname.startsWith('/dashboard/profil')) {
    return { kicker: 'Admin', title: 'Profil', subtitle: 'Name, E-Mail und Passwort.' };
  }
  if (pathname.startsWith('/dashboard/nutzer')) {
    return { kicker: 'Bestand', title: 'Nutzer', subtitle: 'Konten im Portal.' };
  }
  if (pathname.startsWith('/dashboard/berater')) {
    return { kicker: 'Bestand', title: 'Berater', subtitle: 'Konten und Stammdaten der Berater.' };
  }
  if (pathname.startsWith('/dashboard/anfordern') || pathname.startsWith('/dashboard/anfragen')) {
    return { kicker: 'Workflow', title: 'Anforderungen', subtitle: 'Anforderungen prüfen, Leads senden und den Versand steuern.' };
  }
  if (pathname.startsWith('/dashboard/reklamationen')) {
    return { kicker: 'Workflow', title: 'Reklamationen', subtitle: 'Erstattung genehmigen oder ablehnen.' };
  }
  if (pathname.startsWith('/dashboard/leads/ungueltig') || pathname.startsWith('/dashboard/leads/abgelehnt')) {
    return {
      kicker: 'Workflow',
      title: 'Ungültige Leads',
      subtitle: 'Erstattete Leads mit Ersatz — Reklamationsgrund und Details nachprüfen.',
    };
  }
  if (pathname.startsWith('/dashboard/leads/new')) {
    return { kicker: 'Bestand', title: 'Neuer Lead', subtitle: 'Qualifizierten Kontakt anlegen.' };
  }
  if (pathname.startsWith('/dashboard/leads/')) {
    return { kicker: 'Bestand', title: 'Lead', subtitle: 'Kontakt prüfen und zuweisen.' };
  }
  if (pathname.startsWith('/dashboard/leads')) {
    return { kicker: 'Bestand', title: 'Leads', subtitle: 'Bestand filtern, importieren und zuweisen.' };
  }
  return {
    kicker: greeting(),
    title: firstName(user),
    subtitle: 'Prüfen Sie aktive Anforderungen und Reklamationen, dann den Lead-Bestand.',
  };
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
  const location = useLocation();
  const copy = adminPageCopy(location.pathname, user);

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
        <nav className="dash-nav" id="dash-sidebar-nav" aria-label="Portal">
          {ADMIN_NAV.map((group) => (
            <div className="dash-nav-group" key={group.label}>
              <p className="dash-nav-label">{group.label}</p>
              {group.links.map((link) => {
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
            </div>
          ))}
        </nav>
        <div className="dash-sidebar-foot">
          <div className="dash-account">
            <NavLink
              className={({ isActive }) => `dash-account-profile${isActive ? ' is-active' : ''}`}
              to="/dashboard/profil"
              title="Profil öffnen"
              aria-label="Profil öffnen"
            >
              <span className="dash-avatar">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user)}
              </span>
              <span className="dash-user-copy">
                <strong>{user.fullName || user.email}</strong>
                <small>{roleLabel(user.role)}</small>
              </span>
            </NavLink>
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
            <p className="dash-kicker">{copy.kicker}</p>
            <h1>{copy.title}</h1>
            {copy.subtitle ? <p className="dash-top-sub">{copy.subtitle}</p> : null}
          </div>
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
            <Settings size={16} />
            Einstellungen
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut size={16} />
            Abmelden
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BeraterShell({ user, logout, children }) {
  const location = useLocation();
  const setupCta = accountSetupCta(user);
  const showSetupCta = Boolean(setupCta && !location.pathname.startsWith(setupCta.to));

  return (
    <div className="broker">
      <aside className="broker-nav">
        <Brand to="/dashboard" />
        <div className="broker-nav-end">
          <nav aria-label="Portal">
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
          {showSetupCta ? (
            <Link className="broker-setup-cta" to={setupCta.to}>
              {setupCta.to.includes('unternehmen') ? <Building2 size={15} /> : <User size={15} />}
              {setupCta.label}
            </Link>
          ) : null}
          <AccountMenu user={user} logout={logout} />
        </div>
      </aside>

      <div className="broker-content">
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
