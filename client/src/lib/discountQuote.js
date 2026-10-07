export const DISCOUNT_KINDS = ['standing', 'one_time'];
export const DISCOUNT_VALUE_TYPES = ['percent', 'fixed_cents'];
export const DISCOUNT_APPLIES_TO = ['all', 'leads', 'appointments'];

export function purchaseAppliesKind(packageId, leadType) {
  const token = `${packageId || ''} ${leadType || ''}`;
  return /APPOINTMENT/i.test(token) ? 'appointments' : 'leads';
}

export function discountExpiresAt(discount) {
  return discount?.expiresAt || discount?.expires_at || null;
}

export function isDiscountExpired(discount, now = Date.now()) {
  const raw = discountExpiresAt(discount);
  if (!raw) return false;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) && time <= now;
}

export function isDiscountLive(discount, now = Date.now()) {
  if (!discount) return false;
  const status = discount.status || 'active';
  if (status !== 'active') return false;
  return !isDiscountExpired(discount, now);
}

export function discountMatchesPurchase(discount, appliesKind) {
  const scope = discount?.appliesTo || discount?.applies_to;
  if (!scope || scope === 'all') return true;
  return scope === appliesKind;
}

export function matchingOneTimes(oneTimes, packageId, leadType, now = Date.now()) {
  const appliesKind = purchaseAppliesKind(packageId, leadType);
  return (oneTimes || []).filter((entry) => (
    isDiscountLive(entry, now) && discountMatchesPurchase(entry, appliesKind)
  ));
}

export function discountCutCents(discount, baseCents, count) {
  const type = discount?.valueType || discount?.value_type;
  const value = Number(discount?.value) || 0;
  const base = Math.max(0, Math.round(Number(baseCents) || 0));
  if (type === 'percent') {
    return Math.round(base * value / 100);
  }
  return value * Math.max(0, Number(count) || 0);
}

export function quoteDiscounts({
  listCents,
  count,
  packageId,
  leadType,
  standing = null,
  oneTimes = [],
  useOneTimeId = null,
  now = Date.now(),
} = {}) {
  const list = Math.max(0, Math.round(Number(listCents) || 0));
  const units = Math.max(0, Number(count) || 0);
  const appliesKind = purchaseAppliesKind(packageId, leadType);
  const lines = [];
  let remaining = list;

  const standingOk = isDiscountLive(standing, now) && discountMatchesPurchase(standing, appliesKind);
  if (standingOk) {
    const amount = Math.min(remaining, Math.max(0, discountCutCents(standing, remaining, units)));
    if (amount > 0) {
      remaining -= amount;
      lines.push({ role: 'standing', discount: standing, amountCents: amount });
    }
  }

  const selectedId = String(useOneTimeId || '').trim();
  if (remaining > 0 && selectedId) {
    const selected = matchingOneTimes(oneTimes, packageId, leadType, now)
      .find((entry) => entry.id === selectedId);
    if (selected) {
      const amount = Math.min(remaining, Math.max(0, discountCutCents(selected, remaining, units)));
      if (amount > 0) {
        remaining -= amount;
        lines.push({ role: 'oneTime', discount: selected, amountCents: amount });
      }
    }
  }

  return {
    listCents: list,
    discountCents: list - remaining,
    netCents: remaining,
    appliesKind,
    standing: lines.find((line) => line.role === 'standing') || null,
    oneTime: lines.find((line) => line.role === 'oneTime') || null,
    lines,
  };
}

export function discountedUnitCents(quote, count) {
  const units = Math.max(1, Number(count) || 1);
  return Math.round((Number(quote?.netCents) || 0) / units);
}

export function shopPriceUnits(quote, count, catalogUnit, flatCheckout) {
  const list = Number(quote?.listCents) || 0;
  const net = Number(quote?.netCents) || 0;
  if (flatCheckout) {
    return { listUnit: list, netUnit: net };
  }
  return {
    listUnit: catalogUnit,
    netUnit: Math.round(net / Math.max(1, Number(count) || 1)),
  };
}

export function remainingTimeLabel(expiresAt, now = Date.now()) {
  if (!expiresAt) return '';
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return '';
  const diff = end - now;
  if (diff <= 0) return 'Abgelaufen';
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days >= 1) return `noch ${days} Tag${days === 1 ? '' : 'e'}${hours ? `, ${hours} Std.` : ''}`;
  if (hours >= 1) return `noch ${hours} Std. ${mins} Min.`;
  return `noch ${Math.max(1, mins)} Min.`;
}
