export function firstName(user) {
  const direct = String(user?.firstName || '').trim();
  if (direct) return direct;
  const name = String(user?.fullName || '').trim();
  if (name) return name.split(/\s+/)[0];
  return user?.email?.split('@')[0] || 'dort';
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
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function formatEuro(cents) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);
}

export function formatEuroExact(cents) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100);
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE', {
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
      label: 'Name & Telefon',
    });
  }
  if (!isFirmComplete(user)) {
    gaps.push({
      id: 'firma',
      nav: 'unternehmen',
      to: '/dashboard/unternehmen#firma',
      label: 'Unternehmen',
    });
  }
  if (!isAddressComplete(user)) {
    gaps.push({
      id: 'adresse',
      nav: 'unternehmen',
      to: '/dashboard/unternehmen#adresse',
      label: 'Geschäftsadresse',
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
    label: first.nav === 'profil' ? 'Profil einrichten' : 'Unternehmen einrichten',
    count: gaps.length,
    gaps,
  };
}

export function dashboardDocumentTitle(pathname, isAdmin = false) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/dashboard';

  if (path === '/dashboard') return 'Übersicht — VANTARO';
  if (path.startsWith('/dashboard/leads/abgelehnt')) return 'Abgelehnte Leads — VANTARO';
  if (path === '/dashboard/leads/new') return 'Neuer Lead — VANTARO';
  if (path.startsWith('/dashboard/leads/') && path !== '/dashboard/leads') return 'Lead — VANTARO';
  if (path.startsWith('/dashboard/leads')) return isAdmin ? 'Leads — VANTARO' : 'Meine Leads — VANTARO';
  if (path.startsWith('/dashboard/zahlung')) return 'Zahlung — VANTARO';
  if (path.startsWith('/dashboard/profil')) return 'Profil — VANTARO';
  if (path.startsWith('/dashboard/unternehmen')) return 'Unternehmen — VANTARO';
  if (path.startsWith('/dashboard/sicherheit')) return 'Sicherheit — VANTARO';
  if (path.startsWith('/dashboard/nutzer')) return 'Nutzer — VANTARO';
  if (path.startsWith('/dashboard/berater')) return 'Berater — VANTARO';
  if (path.startsWith('/dashboard/anfordern') || path.startsWith('/dashboard/anfragen')) {
    return 'Anforderungen — VANTARO';
  }
  if (path.startsWith('/dashboard/reklamationen')) return 'Reklamationen — VANTARO';
  return 'Portal — VANTARO';
}

export function documentTitle(pathname, hash = '', isAdmin = false) {
  if (hash === '#impressum' || pathname === '/impressum') return 'Impressum — VANTARO';
  if (hash === '#datenschutz' || pathname === '/datenschutz') return 'Datenschutz — VANTARO';
  if (pathname === '/login') return 'Anmelden — VANTARO';
  if (pathname === '/auth/callback') return 'Anmeldung — VANTARO';
  if (pathname === '/register') return 'Registrieren — VANTARO';
  if (pathname === '/forgot-password') return 'Passwort zurücksetzen — VANTARO';
  if (pathname === '/reset-password') return 'Neues Passwort — VANTARO';
  if (pathname === '/verify-email') return 'E-Mail bestätigen — VANTARO';
  if (pathname.startsWith('/dashboard')) return dashboardDocumentTitle(pathname, isAdmin);
  return 'VANTARO — Qualifizierte Beratungschancen & Makler-Matching für Finanzdienstleister';
}
