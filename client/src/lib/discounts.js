import { apiUrl } from './api';
import { readStoredSession } from './auth';
import { quoteDiscounts } from './discountQuote';

export { quoteDiscounts, discountedUnitCents, purchaseAppliesKind, shopPriceUnits, matchingOneTimes, remainingTimeLabel, isDiscountExpired, isDiscountLive } from './discountQuote';

function authHeaders(json = false) {
  const session = readStoredSession();
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.');
  }
  return payload;
}

export async function fetchMyDiscounts() {
  const response = await fetch(apiUrl('/api/discounts/mine'), { headers: authHeaders() });
  return parseResponse(response);
}

export async function fetchBeraterDiscounts(beraterId) {
  const response = await fetch(
    apiUrl(`/api/discounts?beraterId=${encodeURIComponent(beraterId)}`),
    { headers: authHeaders() },
  );
  return parseResponse(response);
}

export async function createBeraterDiscount(payload) {
  const response = await fetch(apiUrl('/api/discounts'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function updateBeraterDiscount(discountId, payload) {
  const response = await fetch(apiUrl(`/api/discounts/${encodeURIComponent(discountId)}`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function deleteBeraterDiscount(discountId) {
  const response = await fetch(apiUrl(`/api/discounts/${encodeURIComponent(discountId)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function revokeBeraterDiscount(discountId) {
  const response = await fetch(apiUrl(`/api/discounts/${encodeURIComponent(discountId)}`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({ status: 'revoked' }),
  });
  return parseResponse(response);
}

export function appliesToLabel(value) {
  if (value === 'leads') return 'Leads';
  if (value === 'appointments') return 'Termine';
  return 'Alle Pakete';
}

export function discountKindLabel(kind) {
  return kind === 'one_time' ? 'Einmal-Rabatt' : 'Dauerkondition';
}

export function discountStatusLabel(status) {
  switch (String(status || '')) {
    case 'active':
      return 'Aktiv';
    case 'reserved':
      return 'Reserviert';
    case 'consumed':
      return 'Eingelöst';
    case 'revoked':
      return 'Entzogen';
    default:
      return status || '—';
  }
}

export function discountValueLabel(discount, formatEuro) {
  if (!discount) return '—';
  if (discount.valueType === 'percent') return `${discount.value} %`;
  const amount = formatEuro ? formatEuro(discount.value) : `${(discount.value / 100).toFixed(2)} €`;
  return `${amount} / Einheit`;
}

export function discountLineLabel(line) {
  const discount = line?.discount || line;
  if (!discount) return 'Rabatt';
  const code = discount.code ? ` ${discount.code}` : '';
  if (discount.valueType === 'percent') return `Rabatt${code} (−${discount.value} %)`;
  return `Rabatt${code}`.trim();
}

export function quoteForPackage(listCents, count, packageId, discounts, leadType, useOneTimeId) {
  return quoteDiscounts({
    listCents,
    count,
    packageId,
    leadType,
    standing: discounts?.standing || null,
    oneTimes: discounts?.oneTimes || [],
    useOneTimeId: useOneTimeId || null,
  });
}
