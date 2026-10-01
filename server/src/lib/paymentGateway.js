import * as procredit from './procredit.js';
import * as mock from './mockGateway.js';

/**
 * PAYMENT_PROVIDER=procredit (default) → real ProCredit bank.
 * PAYMENT_PROVIDER=mock → local fake bank page for development; refused in production.
 */
export function paymentProvider() {
  const value = String(process.env.PAYMENT_PROVIDER || 'procredit').trim().toLowerCase();
  return value === 'mock' ? 'mock' : 'procredit';
}

/** Render sets RENDER=true on every service; NODE_ENV is not set there by render.yaml. */
function isDeployed() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
}

export function isMockPayments() {
  return paymentProvider() === 'mock' && !isDeployed();
}

function gateway() {
  if (paymentProvider() !== 'mock') return procredit;
  if (isDeployed()) {
    const error = new Error('PAYMENT_PROVIDER=mock ist in Produktion nicht erlaubt.');
    error.status = 503;
    throw error;
  }
  return mock;
}

export const getProcreditConfig = () => gateway().getProcreditConfig();
export const createPurchaseOrder = (input) => gateway().createPurchaseOrder(input);
export const getOrderDetails = (orderId, password) => gateway().getOrderDetails(orderId, password);
export const classifyOrderStatus = procredit.classifyOrderStatus;
