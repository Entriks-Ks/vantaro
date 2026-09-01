import { apiUrl } from './api';
import { readStoredSession } from './auth';

export const TEST_CARD = {
  holder: 'Max Mustermann',
  number: '4242424242424242',
  expiry: '12/30',
  cvc: '123',
};

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

export async function checkoutLeadPackage(payload) {
  const response = await fetch(apiUrl('/api/payments/checkout'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export function formatCardMask(payment) {
  if (!payment?.cardLast4) return payment?.method === 'card' ? 'Karte' : '—';
  return `${payment.cardBrand || 'Karte'} •••• ${payment.cardLast4}`;
}

export function formatCardExpiry(payment) {
  if (!payment?.cardExpMonth || !payment?.cardExpYear) return '—';
  return `${String(payment.cardExpMonth).padStart(2, '0')}/${String(payment.cardExpYear).slice(-2)}`;
}

export function formatCardNumberInput(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim();
}

export function formatExpiryInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
