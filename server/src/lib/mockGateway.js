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
    createTime: bankTime(),
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

/** "YYYY-MM-DD HH:mm:ss" without zone, the way the bank sends regTime. */
function bankTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function getOrderDetails(orderId, password) {
  const order = orders.get(String(orderId));
  if (!order || order.password !== String(password)) return { status: 'Preparing' };
  const amount = order.amountCents / 100;
  const details = {
    id: orderId,
    typeRid: '1',
    status: order.status,
    amount,
    currency: 'EUR',
    createTime: order.createTime,
  };
  if (order.status !== 'FullyPaid') return details;
  // Same shape as a real ProCredit Get Order Details response for a paid Purchase.
  return {
    ...details,
    trans: [{
      approvalCode: order.approvalCode,
      orderId,
      regTime: order.paidTime,
      amount,
      currency: 'EUR',
      isReversal: false,
      phase: 'Single',
      type: 'Purchase',
    }],
    srcToken: {
      paymentMethod: 'Card',
      displayName: '410221******3572',
      owner: { name: 'Test User' },
      card: { expiration: '1229', brand: 'Visa' },
    },
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
  if (outcome === 'paid') {
    order.status = 'FullyPaid';
    order.approvalCode = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    order.paidTime = bankTime();
  } else if (outcome === 'failed') order.status = 'Declined';
  else if (outcome === 'cancel') order.status = 'Cancelled';
  return order.hppRedirectUrl;
}
