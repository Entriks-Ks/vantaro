import crypto from 'node:crypto';
import { getApiOrigin } from './clientOrigin.js';

/**
 * Local stand-in for ProCredit (PAYMENT_PROVIDER=mock). Same function names as procredit.js.
 * Orders live in memory only — a server restart forgets open mock orders.
 */
const orders = new Map();

export function getProcreditConfig() {
  return {
    apiBaseUrl: getApiOrigin(),
    merchantId: 'MOCK',
    currency: 'EUR',
    language: 'de',
    testMode: true,
    hasCerts: true,
    configured: true,
    missing: [],
    provider: 'mock',
  };
}

export async function createPurchaseOrder({ amountCents, description, hppRedirectUrl }) {
  const orderId = `mock_${crypto.randomUUID()}`;
  const password = crypto.randomBytes(8).toString('hex');
  orders.set(orderId, {
    password,
    status: 'Preparing',
    amountCents: Number(amountCents) || 0,
    description: String(description || ''),
    hppRedirectUrl,
  });
  const hppUrl = `${getApiOrigin()}/api/payments/mock-hpp`;
  const redirect = new URL(hppUrl);
  redirect.searchParams.set('id', orderId);
  redirect.searchParams.set('password', password);
  return {
    orderId,
    password,
    hppUrl,
    status: 'Preparing',
    redirectUrl: redirect.toString(),
    raw: { mock: true },
  };
}

export async function getOrderDetails(orderId, password) {
  const order = orders.get(String(orderId));
  if (!order || order.password !== String(password)) return { status: 'Preparing' };
  return {
    id: orderId,
    status: order.status,
    card: order.status === 'Approved'
      ? { last4: '4242', brand: 'VISA', holder: 'Test User' }
      : {},
  };
}

export function getMockOrder(orderId, password) {
  const order = orders.get(String(orderId));
  if (!order || order.password !== String(password)) return null;
  return order;
}

/** outcome: 'paid' | 'failed' | 'cancel'. Returns the hppRedirectUrl to send the browser back to. */
export function decideMockOrder(orderId, password, outcome) {
  const order = getMockOrder(orderId, password);
  if (!order) return null;
  if (outcome === 'paid') order.status = 'Approved';
  else if (outcome === 'failed') order.status = 'Declined';
  else if (outcome === 'cancel') order.status = 'Cancelled';
  return order.hppRedirectUrl;
}
