import { L, locale } from '../../lib/i18n';

export function firstName(user) {
  const direct = String(user?.firstName || '').trim();
  if (direct) return direct;
  const name = String(user?.fullName || '').trim();
  if (name) return name.split(/\s+/)[0];
  return user?.email?.split('@')[0] || L('dort', 'there');
}

export function displayName(user) {
  const first = String(user?.firstName || '').trim();
  const last = String(user?.lastName || '').trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  const full = String(user?.fullName || '').trim();
  if (full) return full;
  return firstName(user);
}

export function initials(user) {
  const first = String(user?.firstName || '').trim();
  const last = String(user?.lastName || '').trim();
  if (first || last) {
    return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'V';
  }
  const name = String(user?.fullName || '').trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }
  return String(user?.email || 'V').slice(0, 2).toUpperCase();
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return L('Guten Morgen', 'Good morning');
  if (hour < 18) return L('Guten Tag', 'Good afternoon');
  return L('Guten Abend', 'Good evening');
}

export function formatEuro(cents) {
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);
}

export function formatEuroExact(cents) {
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100);
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function filled(value) {
  return Boolean(String(value || '').trim());
}

export function isPersonalComplete(user) {
  return filled(user?.firstName) && filled(user?.lastName) && filled(user?.phone);
}

export function isFirmComplete(user) {
  const profile = user?.profile || {};
  return filled(profile.company) && filled(profile.legalForm);
}

export function isAddressComplete(user) {
  const address = user?.profile?.businessAddress || {};
  return filled(address.street) && filled(address.zip) && filled(address.city);
}

export function isCompanyComplete(user) {
  return isFirmComplete(user) && isAddressComplete(user);
}

/** True when personal + company fields required for berater onboarding are present. */
export function isAccountSetupComplete(user) {
  if (!user) return false;
  if (user.onboardingComplete) return true;
  return isPersonalComplete(user) && isCompanyComplete(user);
}

/** Incomplete onboarding parts: Profil, Firma, Geschäftsadresse. */
export function accountSetupGaps(user) {
  if (!user || isAccountSetupComplete(user)) return [];
  const gaps = [];
  if (!isPersonalComplete(user)) {
    gaps.push({
      id: 'profil',
      nav: 'profil',
      to: '/dashboard/profil#kontakt',
      label: L('Name & Telefon', 'Name & phone'),
    });
  }
  if (!isFirmComplete(user)) {
    gaps.push({
      id: 'firma',
      nav: 'unternehmen',
      to: '/dashboard/unternehmen#firma',
      label: L('Unternehmen', 'Company'),
    });
  }
  if (!isAddressComplete(user)) {
    gaps.push({
      id: 'adresse',
      nav: 'unternehmen',
      to: '/dashboard/unternehmen#adresse',
      label: L('Geschäftsadresse', 'Business address'),
    });
  }
  return gaps;
}

export function accountSetupCta(user) {
  const gaps = accountSetupGaps(user);
  if (!gaps.length) return null;
  const first = gaps[0];
  return {
    to: first.to,
    label: first.nav === 'profil' ? L('Profil einrichten', 'Set up profile') : L('Unternehmen einrichten', 'Set up company'),
    count: gaps.length,
    gaps,
  };
}

export function dashboardDocumentTitle(pathname, isAdmin = false) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/dashboard';

  if (path === '/dashboard') return L('Übersicht — VANTARO', 'Overview — VANTARO');
  if (path.startsWith('/dashboard/leads/abgelehnt')) return L('Abgelehnte Leads — VANTARO', 'Rejected leads — VANTARO');
  if (path === '/dashboard/leads/new') return L('Neuer Lead — VANTARO', 'New lead — VANTARO');
  if (path.startsWith('/dashboard/leads/') && path !== '/dashboard/leads') return 'Lead — VANTARO';
  if (path.startsWith('/dashboard/leads')) return isAdmin ? 'Leads — VANTARO' : L('Meine Leads — VANTARO', 'My leads — VANTARO');
  if (path.startsWith('/dashboard/kalender')) return L('Kalender — VANTARO', 'Calendar — VANTARO');
  if (path.startsWith('/dashboard/paket')) return L('Pakete & Guthaben — VANTARO', 'Packages & credit — VANTARO');
  if (path.startsWith('/dashboard/partner')) return 'Partner — VANTARO';
  if (path.startsWith('/dashboard/support')) return 'Support — VANTARO';
  if (path.startsWith('/dashboard/zahlung')) return L('Zahlung — VANTARO', 'Payment — VANTARO');
  if (path.startsWith('/dashboard/profil')) return L('Profil — VANTARO', 'Profile — VANTARO');
  if (path.startsWith('/dashboard/unternehmen')) return L('Unternehmen — VANTARO', 'Company — VANTARO');
  if (path.startsWith('/dashboard/sicherheit')) return L('Sicherheit — VANTARO', 'Security — VANTARO');
  if (path.startsWith('/dashboard/nutzer')) return L('Nutzer — VANTARO', 'Users — VANTARO');
  if (path.startsWith('/dashboard/berater')) return L('Berater — VANTARO', 'Advisors — VANTARO');
  if (/^\/dashboard\/anfordern\/[^/]+/.test(path) || /^\/dashboard\/anfragen\/[^/]+/.test(path)) {
    return L('Anforderung — VANTARO', 'Request — VANTARO');
  }
  if (path.startsWith('/dashboard/anfordern') || path.startsWith('/dashboard/anfragen')) {
    return L('Anforderungen — VANTARO', 'Requests — VANTARO');
  }
  if (path.startsWith('/dashboard/reklamationen')) return L('Reklamationen — VANTARO', 'Complaints — VANTARO');
  return 'Portal — VANTARO';
}

export function documentTitle(pathname, hash = '', isAdmin = false) {
  if (hash === '#impressum' || pathname === '/impressum') return L('Impressum — VANTARO', 'Legal notice — VANTARO');
  if (hash === '#datenschutz' || pathname === '/datenschutz') return L('Datenschutz — VANTARO', 'Privacy policy — VANTARO');
  if (hash === '#agb' || pathname === '/agb') return L('AGB — VANTARO', 'Terms & conditions — VANTARO');
  if (hash === '#erstattung' || pathname === '/erstattung') return L('Erstattungsrichtlinie — VANTARO', 'Refund policy — VANTARO');
  if (pathname === '/login') return L('Anmelden — VANTARO', 'Log in — VANTARO');
  if (pathname === '/auth/callback') return L('Anmeldung — VANTARO', 'Login — VANTARO');
  if (pathname === '/register') return L('Registrieren — VANTARO', 'Sign up — VANTARO');
  if (pathname === '/forgot-password') return L('Passwort zurücksetzen — VANTARO', 'Reset password — VANTARO');
  if (pathname === '/reset-password') return L('Neues Passwort — VANTARO', 'New password — VANTARO');
  if (pathname === '/einladung') return L('Einladung annehmen — VANTARO', 'Accept invitation — VANTARO');
  if (pathname === '/verify-email') return L('E-Mail bestätigen — VANTARO', 'Confirm email — VANTARO');
  if (pathname.startsWith('/dashboard')) return dashboardDocumentTitle(pathname, isAdmin);
  return L('VANTARO — Vertriebsplattform für Versicherung & Energie', 'VANTARO — Sales platform for insurance & energy');
}
