import { apiUrl } from './api';
import { readStoredSession } from './auth';
import { quoteDiscounts } from './discountQuote';
import { L } from './i18n';

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
    throw new Error(payload.error || L('Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.', 'Something went wrong. Please try again.'));
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
  if (value === 'leads') return L('Leads', 'Leads');
  if (value === 'appointments') return L('Termine', 'Appointments');
  return L('Alle Pakete', 'All packages');
}

export function discountKindLabel(kind) {
  return kind === 'one_time' ? L('Einmal-Rabatt', 'One-time discount') : L('Dauerkondition', 'Standing discount');
}

export function discountStatusLabel(status) {
  switch (String(status || '')) {
    case 'active':
      return L('Aktiv', 'Active');
    case 'reserved':
      return L('Reserviert', 'Reserved');
    case 'consumed':
      return L('Eingelöst', 'Redeemed');
    case 'revoked':
      return L('Entzogen', 'Revoked');
    default:
      return status || '—';
  }
}

export function discountValueLabel(discount, formatEuro) {
  if (!discount) return '—';
  if (discount.valueType === 'percent') return `${discount.value} %`;
  const amount = formatEuro ? formatEuro(discount.value) : `${(discount.value / 100).toFixed(2)} €`;
  return L(`${amount} / Einheit`, `${amount} / unit`);
}

export function discountLineLabel(line) {
  const discount = line?.discount || line;
  if (!discount) return L('Rabatt', 'Discount');
  const code = discount.code ? ` ${discount.code}` : '';
  if (discount.valueType === 'percent') return L(`Rabatt${code} (−${discount.value} %)`, `Discount${code} (−${discount.value}%)`);
  return L(`Rabatt${code}`, `Discount${code}`).trim();
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
