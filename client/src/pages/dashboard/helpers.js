export function firstName(user) {
  const name = String(user?.fullName || '').trim();
  if (name) return name.split(/\s+/)[0];
  return user?.email?.split('@')[0] || 'dort';
}

export function initials(user) {
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
