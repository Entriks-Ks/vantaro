import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Landmark,
  UserRound,
  Inbox,
  Flag,
  Ban,
  Calendar,
  CreditCard,
  Handshake,
  GraduationCap,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../hooks/useAuth';
import { useDashboard } from '../../hooks/useDashboard';
import { roleLabel } from '../../lib/roles';
import { displayName, firstName, greeting, initials } from './helpers';
import ScheduleBell from './ScheduleBell';

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

function energyLinks(role, allowedPages) {
  const links = [
    { to: '/dashboard', match: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/dashboard/leads', match: 'leads', label: 'Meine Leads', icon: ListChecks },
    { to: '/dashboard/kalender', match: 'kalender', label: 'Kalender', icon: Calendar },
  ];
  if (role === 'main') {
    links.push(
      { divider: true },
      { to: '/dashboard/paket', match: 'paket', label: 'Meine Pakete', icon: CreditCard },
      { to: '/dashboard/team', match: 'team', label: 'Partner', icon: Handshake },
      { to: '/dashboard/academy', match: 'academy', label: 'Akademie', icon: GraduationCap },
      { to: '/dashboard/support', match: 'support', label: 'Support', icon: MessageCircle },
    );
  } else {
    links.push(
      { divider: true },
      { to: '/dashboard/paket', match: 'paket', label: 'Meine Pakete', icon: CreditCard },
      { to: '/dashboard/academy', match: 'academy', label: 'Akademie', icon: GraduationCap },
      { to: '/dashboard/support', match: 'support', label: 'Support', icon: MessageCircle },
    );
  }

  if (role === 'main' || !Array.isArray(allowedPages)) return links;

  const filtered = [];
  for (const link of links) {
    if (link.divider) {
      if (filtered.length && !filtered[filtered.length - 1].divider) filtered.push(link);
      continue;
    }
    if (allowedPages.includes(link.match)) filtered.push(link);
  }
  while (filtered.length && filtered[filtered.length - 1].divider) filtered.pop();
  return filtered.length ? filtered : links.filter((link) => link.match === 'dashboard');
}

const BERATER_LINKS = [
  { to: '/dashboard', match: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/leads', match: 'leads', label: 'Meine Leads', icon: ListChecks },
  { to: '/dashboard/kalender', match: 'kalender', label: 'Kalender', icon: Calendar },
  { divider: true },
  { to: '/dashboard/paket', match: 'paket', label: 'Mein Paket', icon: CreditCard },
  { to: '/dashboard/partner', match: 'partner', label: 'Partner', icon: Handshake },
  { to: '/dashboard/academy', match: 'academy', label: 'Akademie', icon: GraduationCap },
  { to: '/dashboard/support', match: 'support', label: 'Support', icon: MessageCircle },
];

function isBeraterNavActive(match, pathname) {
  if (match === 'home' || match === 'dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
  if (match === 'leads') return pathname.startsWith('/dashboard/leads');
  if (match === 'kalender') return pathname.startsWith('/dashboard/kalender');
  if (match === 'paket') return pathname.startsWith('/dashboard/paket');
  if (match === 'partner') return pathname.startsWith('/dashboard/partner');
  if (match === 'academy') return pathname.startsWith('/dashboard/academy');
  if (match === 'support') return pathname.startsWith('/dashboard/support');
  if (match === 'bestellung') return pathname.startsWith('/dashboard/bestellung');
  if (match === 'team') return pathname.startsWith('/dashboard/team');
  if (match === 'reklamationen') return pathname.startsWith('/dashboard/reklamationen');
  return false;
}

function NavProgress({ pathname }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 520);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className={`broker-nav-progress${active ? ' is-active' : ''}`}
      aria-hidden={!active}
    />
  );
}

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
  if (pathname.startsWith('/dashboard/nutzer')) {
    return { kicker: 'Bestand', title: 'Nutzer', subtitle: 'Konten im Portal.' };
  }
  if (pathname.startsWith('/dashboard/berater')) {
    return { kicker: 'Bestand', title: 'Berater', subtitle: 'Konten und Stammdaten der Berater.' };
  }
  if (/^\/dashboard\/anfordern\/[^/]+/.test(pathname) || /^\/dashboard\/anfragen\/[^/]+/.test(pathname)) {
    return { kicker: 'Workflow', title: 'Anforderung', subtitle: 'Fortschritt prüfen, Leads senden und den Auftrag steuern.' };
  }
  if (pathname.startsWith('/dashboard/anfordern') || pathname.startsWith('/dashboard/anfragen')) {
    return { kicker: 'Workflow', title: 'Anforderungen', subtitle: 'Anforderungen prüfen, Leads senden und den Versand steuern.' };
  }
  if (pathname.startsWith('/dashboard/reklamationen')) {
    return { kicker: 'Workflow', title: 'Reklamationen', subtitle: 'Eingaben prüfen, Infos anfordern, erstatten oder ablehnen.' };
  }
  if (pathname.startsWith('/dashboard/leads/ungueltig') || pathname.startsWith('/dashboard/leads/abgelehnt')) {
    return {
      kicker: 'Workflow',
      title: 'Ungültige Leads',
      subtitle: 'Erstattete Leads nach Reklamation — prüfen und bei Bedarf als Wieder verfügbar zurück in den Pool legen.',
    };
  }
  if (pathname.startsWith('/dashboard/leads/new')) {
    return { kicker: 'Bestand', title: 'Neuer Lead', subtitle: 'Qualifizierten Kontakt anlegen.' };
  }
  if (pathname.startsWith('/dashboard/leads/')) {
    return { kicker: 'Bestand', title: 'Lead', subtitle: 'Kontakt prüfen und Bestand pflegen.' };
  }
  if (pathname.startsWith('/dashboard/leads')) {
    return { kicker: 'Bestand', title: 'Leads', subtitle: 'Bestand filtern, importieren und pflegen.' };
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

function AdminShell({ user, children }) {
  const [collapsed, setCollapsed] = useState(readAdminSidebarCollapsed);
  const location = useLocation();
  const copy = adminPageCopy(location.pathname, user);
  const { admin } = useDashboard();
  const pendingRequests = Number(admin?.workflow?.pendingRequests) || 0;
  const pendingComplaints = Number(admin?.workflow?.unseenComplaints ?? admin?.workflow?.pendingComplaints) || 0;

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_SIDEBAR_KEY, collapsed ? 'collapsed' : 'open');
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed]);

  function navBadge(to) {
    if (to === '/dashboard/anfordern') return pendingRequests;
    if (to === '/dashboard/reklamationen') return pendingComplaints;
    return 0;
  }

  return (
    <div className={`dash${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="dash-sidebar">
        <div className="dash-sidebar-inner">
        <div className="dash-brand">
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
        </div>
        <nav className="dash-nav" id="dash-sidebar-nav" aria-label="Portal">
          {ADMIN_NAV.map((group) => (
            <div className="dash-nav-group" key={group.label}>
              <p className="dash-nav-label">{group.label}</p>
              {group.links.map((link) => {
                const Icon = link.icon;
                const badge = navBadge(link.to);
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    title={badge > 0 ? `${link.label} (${badge})` : link.label}
                    className={({ isActive }) => {
                      const active = isActive ? 'is-active' : '';
                      const hasBadge = badge > 0 ? ' has-badge' : '';
                      return `${active}${hasBadge}`.trim() || undefined;
                    }}
                  >
                    <Icon size={16} />
                    <span className="dash-nav-text">{link.label}</span>
                    {badge > 0 ? (
                      <em className="dash-nav-count" aria-label={`${badge} offen`}>
                        {badge > 99 ? '99+' : badge}
                      </em>
                    ) : null}
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
              className="dash-collapse-btn"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-controls="dash-sidebar-nav"
              aria-label={collapsed ? 'Seitenleiste öffnen' : 'Seitenleiste schließen'}
              title={collapsed ? 'Seitenleiste öffnen' : 'Seitenleiste schließen'}
            >
              {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
          </div>
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

const BERATER_SIDEBAR_KEY = 'vantaro-berater-sidebar';

function readBeraterSidebarCollapsed() {
  try {
    return localStorage.getItem(BERATER_SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function AccountMenu({ user, compact = false, collapsed = false, onToggleSidebar }) {
  return (
    <div className="broker-account">
      <NavLink
        to="/dashboard/profil"
        className={({ isActive }) => `broker-account-profile${isActive ? ' is-active' : ''}${compact ? ' is-compact' : ''}`}
        aria-label={compact ? `Profil, ${displayName(user)}` : undefined}
        title={compact ? displayName(user) : undefined}
      >
        <span className="broker-avatar broker-avatar--foot">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user)}
        </span>
        <span className="broker-account-copy">
          <strong className="broker-profile-name">{displayName(user)}</strong>
          <small className="broker-account-role">{roleLabel(user.role)}</small>
        </span>
      </NavLink>
      <button
        type="button"
        className="broker-collapse-btn"
        onClick={onToggleSidebar}
        aria-expanded={!collapsed}
        aria-controls="broker-sidebar-nav"
        aria-label={collapsed ? 'Seitenleiste öffnen' : 'Seitenleiste schließen'}
        title={collapsed ? 'Seitenleiste öffnen' : 'Seitenleiste schließen'}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
    </div>
  );
}

function BeraterShell({ user, children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readBeraterSidebarCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(BERATER_SIDEBAR_KEY, collapsed ? 'collapsed' : 'open');
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`broker${collapsed ? ' is-collapsed' : ''}`}>
      {sidebarOpen ? (
        <button
          type="button"
          className="broker-sidebar-backdrop"
          aria-label="Menü schließen"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <button
        type="button"
        className="broker-mobile-toggle"
        onClick={() => setSidebarOpen((value) => !value)}
        aria-expanded={sidebarOpen}
        aria-controls="broker-sidebar-nav"
        aria-label={sidebarOpen ? 'Menü schließen' : 'Menü öffnen'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <aside className={`broker-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="broker-sidebar-inner">
        <div className="broker-brand">
          <Brand to="/dashboard" />
        </div>
        <nav className="broker-nav" id="broker-sidebar-nav" aria-label="Portal">
          {(user?.vertical === 'energy'
            ? energyLinks(user.energyRole || 'main', user.energyPages)
            : BERATER_LINKS
          ).map((link) => {
            if (link.divider) {
              return <div className="broker-nav-divider" key="divider" />;
            }
            const Icon = link.icon;
            const active = isBeraterNavActive(link.match, location.pathname);
            return (
              <Link
                key={link.to}
                to={link.to}
                title={link.label}
                className={active ? 'is-active' : undefined}
                aria-current={active ? 'page' : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} strokeWidth={2} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="broker-sidebar-footer">
          <AccountMenu
            user={user}
            compact={collapsed}
            collapsed={collapsed}
            onToggleSidebar={() => setCollapsed((value) => !value)}
          />
        </div>
        </div>
      </aside>

      <div className="broker-content">
        <div className="broker-topbar">
          <ScheduleBell />
        </div>
        <NavProgress pathname={location.pathname} />
        {children}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  const { user, isAdmin } = useAuth();

  if (isAdmin) {
    return (
      <AdminShell user={user}>
        {children}
      </AdminShell>
    );
  }

  return (
    <BeraterShell user={user}>
      {children}
    </BeraterShell>
  );
}
