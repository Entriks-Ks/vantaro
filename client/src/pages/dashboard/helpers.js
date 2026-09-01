export function firstName(user) {
  const direct = String(user?.firstName || '').trim();
  if (direct) return direct;
  const name = String(user?.fullName || '').trim();
  if (name) return name.split(/\s+/)[0];
  return user?.email?.split('@')[0] || 'dort';
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
  }).format(new Date(value));
}

function filled(value) {
  return Boolean(String(value || '').trim());
}

export function isPersonalComplete(user) {
  return filled(user?.firstName) && filled(user?.lastName) && filled(user?.phone);
}

export function isCompanyComplete(user) {
  const profile = user?.profile || {};
  const address = profile.businessAddress || {};
  return (
    filled(profile.company)
    && filled(profile.legalForm)
    && filled(address.street)
    && filled(address.zip)
    && filled(address.city)
  );
}

/** True when personal + company fields required for berater onboarding are present. */
export function isAccountSetupComplete(user) {
  if (!user) return false;
  if (user.onboardingComplete) return true;
  return isPersonalComplete(user) && isCompanyComplete(user);
}

export function accountSetupCta(user) {
  if (!user || isAccountSetupComplete(user)) return null;
  if (!isPersonalComplete(user)) {
    return { to: '/dashboard/profil', label: 'Profil einrichten' };
  }
  return { to: '/dashboard/unternehmen', label: 'Unternehmen einrichten' };
}
