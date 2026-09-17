import { apiUrl } from './api';
import { readStoredSession } from './auth';

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

export async function fetchMyPayments() {
  const response = await fetch(apiUrl('/api/payments/mine'), { headers: authHeaders() });
  return parseResponse(response);
}

export async function fetchAllPayments() {
  const response = await fetch(apiUrl('/api/payments'), { headers: authHeaders() });
  return parseResponse(response);
}

/** Start ProCredit HPP checkout. Returns { redirectUrl, paymentId, payment }. */
export async function checkoutLeadPackage(payload) {
  const response = await fetch(apiUrl('/api/payments/checkout'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/** Re-check a pending payment with the gateway (e.g. after closing the bank tab). */
export async function syncMyPayment(paymentId) {
  const response = await fetch(apiUrl(`/api/payments/${encodeURIComponent(paymentId)}/sync`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export function paymentStatusLabel(status) {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return 'Bezahlt';
    case 'pending':
      return 'Offen';
    case 'failed':
      return 'Fehlgeschlagen';
    case 'refunded':
      return 'Erstattet';
    default:
      return status || '—';
  }
}

export function formatCardMask(payment) {
  if (payment?.cardLast4) {
    return `${payment.cardBrand || 'Karte'} •••• ${payment.cardLast4}`;
  }
  if (payment?.method === 'card') return 'ProCredit Bank';
  return '—';
}

export function formatCardExpiry(payment) {
  if (!payment?.cardExpMonth || !payment?.cardExpYear) return '—';
  return `${String(payment.cardExpMonth).padStart(2, '0')}/${String(payment.cardExpYear).slice(-2)}`;
}

/** Browser metadata for ProCredit 3DS consumerDevice. */
export function collectBrowserPaymentMeta() {
  if (typeof window === 'undefined') return {};
  return {
    javaEnabled: false,
    jsEnabled: true,
    colorDepth: String(window.screen?.colorDepth || 24),
    screenW: String(window.screen?.width || 1920),
    screenH: String(window.screen?.height || 1080),
    tzOffset: String(new Date().getTimezoneOffset()),
    language: navigator.language || 'de-DE',
    userAgent: navigator.userAgent || '',
    acceptHeader: 'application/json,text/html;q=0.9,*/*;q=0.8',
  };
}
