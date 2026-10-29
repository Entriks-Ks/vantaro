import { after, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createFakeSupabase } from './helpers/fakeSupabase.js';

// Mock gateway only — these tests never call the real bank.
process.env.PAYMENT_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';
delete process.env.RENDER;
process.env.PAYMENT_ENCRYPTION_KEY = 'c'.repeat(64);
process.env.ADMIN_EMAILS = 'admin@vantaro.test';
process.env.API_PUBLIC_URL = 'http://api.vantaro.test';
process.env.FRONTEND_URL = 'http://app.vantaro.test';

const lib = (name) => new URL(`../src/lib/${name}`, import.meta.url).href;
const { db, client } = createFakeSupabase();

const sentAlerts = [];
mock.module(lib('supabase.js'), {
  namedExports: {
    supabase: client,
    supabaseAuth: client,
    supabaseConfig: { url: 'http://db.test', configured: true },
    pingDatabase: async () => ({ ok: true }),
  },
});
mock.module(lib('users.js'), {
  namedExports: {
    ensureUserRole: async (user) => user,
    isEmailVerified: () => true,
    listDirectoryUsers: async () => ({ users: [] }),
    toDirectoryUser: (user) => user,
  },
});
mock.module(lib('mailer.js'), {
  namedExports: {
    hasCustomMailer: () => true,
    hasLeadsMailer: () => true,
    sendAdminLeadRequestEmail: async () => 'mock',
    sendPaymentConfirmationEmail: async () => 'mock',
    sendPaymentSecurityAlertEmail: async (payload) => {
      sentAlerts.push(payload);
      return 'mock';
    },
  },
});
mock.module(lib('leadRequests.js'), {
  namedExports: {
    createLeadRequest: async () => ({ id: crypto.randomUUID(), status: 'pending' }),
  },
});
mock.module(lib('discounts.js'), {
  namedExports: {
    quoteCheckoutDiscounts: async ({ listCents }) => ({
      listCents,
      discountCents: 0,
      netCents: listCents,
      snapshot: null,
      oneTime: null,
    }),
    reserveOneTimeForPayment: async () => true,
    consumeReservedForPayment: async () => {},
    releaseReservedForPayment: async () => {},
  },
});

const { default: express } = await import('express');
const { default: paymentsRouter } = await import('../src/routes/payments.js');
const { decideMockOrder } = await import('../src/lib/mockGateway.js');
const { failureLockUntil, resetPaymentSecurityState } = await import('../src/lib/paymentSecurity.js');
const { sanitizeAuditMetadata } = await import('../src/lib/paymentAudit.js');

function addUser(token, { email, role = 'berater' }) {
  const user = {
    id: crypto.randomUUID(),
    email,
    user_metadata: { email_verified: true, first_name: token, last_name: 'Test' },
    app_metadata: { role },
  };
  db.users.set(user.id, user);
  db.tokens.set(token, user);
  return user;
}

const userA = addUser('token-a', { email: 'a@vantaro.test' });
const userB = addUser('token-b', { email: 'b@vantaro.test' });
const userC = addUser('token-c', { email: 'c@vantaro.test' });
addUser('token-admin', { email: 'admin@vantaro.test', role: 'admin' });

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => resetPaymentSecurityState());

async function api(method, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}/api/payments${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('json') ? await response.json() : null;
  return { status: response.status, headers: response.headers, data };
}

async function checkout(token) {
  const result = await api('POST', '/checkout', {
    token,
    body: { packageId: 'pkv-deutschlandweit', requestedCount: 10 },
  });
  if (result.status !== 201) return result;
  const redirect = new URL(result.data.redirectUrl);
  return {
    ...result,
    orderId: redirect.searchParams.get('id'),
    password: redirect.searchParams.get('password'),
  };
}

function returnTokenFor(paymentId) {
  return db.tables.lead_payments.find((row) => row.id === paymentId).return_token;
}

/** Simulate the customer finishing the mock HPP and the bank redirecting back. */
async function finishPayment(order, outcome) {
  decideMockOrder(order.orderId, order.password, outcome);
  return api('GET', `/return?token=${returnTokenFor(order.data.paymentId)}`);
}

function auditEvents(event, filter = () => true) {
  return db.tables.payment_audit_log.filter((row) => row.event === event && filter(row));
}

function assertNoSecrets(value, password) {
  const text = JSON.stringify(value);
  assert.ok(!text.includes(password), 'order password leaked');
  assert.ok(!/pg_order_password|pgOrderPassword|"password"/i.test(text), 'password field leaked');
}

describe('checkout, return and audit log', () => {
  test('checkout stores the order password encrypted and logs checkout_created', async () => {
    const order = await checkout('token-a');
    assert.equal(order.status, 201);

    const row = db.tables.lead_payments.find((entry) => entry.id === order.data.paymentId);
    assert.match(row.pg_order_password, /^enc:v1:/);
    assert.ok(!row.pg_order_password.includes(order.password));

    // The HPP URL must carry the password (bank flow); the payment object must not.
    assertNoSecrets(order.data.payment, order.password);

    const [entry] = auditEvents('checkout_created', (e) => e.payment_id === row.id);
    assert.ok(entry);
    assert.equal(entry.user_id, userA.id);
    assert.ok(entry.ip);
    assertNoSecrets(entry, order.password);
  });

  test('a paid return logs payment_paid and redirects to success', async () => {
    const order = await checkout('token-a');
    const result = await finishPayment(order, 'paid');
    assert.equal(result.status, 303);
    assert.match(result.headers.get('location'), /payment=success/);
    const [entry] = auditEvents('payment_paid', (e) => e.payment_id === order.data.paymentId);
    assert.equal(entry.user_id, userA.id);
  });

  test('a declined return logs payment_failed', async () => {
    const order = await checkout('token-a');
    const result = await finishPayment(order, 'failed');
    assert.match(result.headers.get('location'), /payment=failed/);
    assert.equal(auditEvents('payment_failed', (e) => e.payment_id === order.data.paymentId).length, 1);
  });

  test('an unknown return token logs return_invalid_token without the token', async () => {
    const fake = 'f'.repeat(48);
    const result = await api('GET', `/return?token=${fake}`);
    assert.equal(result.status, 303);
    assert.match(result.headers.get('location'), /payment=failed/);
    const entry = auditEvents('return_invalid_token').at(-1);
    assert.ok(entry);
    assert.ok(!JSON.stringify(entry).includes(fake));
    assert.equal(entry.metadata.wellFormed, true);
  });

  test('the return route no longer accepts a bare payment id', async () => {
    const order = await checkout('token-a');
    decideMockOrder(order.orderId, order.password, 'paid');
    const result = await api('GET', `/return?paymentId=${order.data.paymentId}`);
    assert.match(result.headers.get('location'), /payment=failed/);
    const row = db.tables.lead_payments.find((entry) => entry.id === order.data.paymentId);
    assert.equal(row.status, 'pending');
  });

  test('legacy plaintext order passwords still work for sync', async () => {
    const order = await checkout('token-a');
    decideMockOrder(order.orderId, order.password, 'paid');
    const row = db.tables.lead_payments.find((entry) => entry.id === order.data.paymentId);
    row.pg_order_password = order.password;

    const result = await api('POST', `/${row.id}/sync`, { token: 'token-a' });
    assert.equal(result.status, 200);
    assert.equal(result.data.outcome, 'paid');
    assertNoSecrets(result.data, order.password);
    assert.equal(auditEvents('payment_synced', (e) => e.payment_id === row.id).length, 1);
  });

  test('audit metadata drops secrets and masks card-number-like strings', () => {
    const clean = sanitizeAuditMetadata({
      password: 'x',
      pgOrderPassword: 'x',
      returnToken: 'x',
      certPem: 'x',
      cvc: '123',
      note: 'card 4111111111111111 used',
      company: 'kept',
      nested: { privateKey: 'x', ok: 1 },
    });
    assert.deepEqual(clean, {
      note: 'card [redacted] used',
      company: 'kept',
      nested: { ok: 1 },
    });
  });
});

describe('access control', () => {
  let paymentOfA;

  before(async () => {
    const order = await checkout('token-a');
    paymentOfA = order.data.paymentId;
  });

  test('GET / is admin-only', async () => {
    assert.equal((await api('GET', '/', { token: 'token-a' })).status, 403);
    assert.equal((await api('GET', '/', { token: 'token-admin' })).status, 200);
    assert.equal((await api('GET', '/')).status, 401);
  });

  test('GET /mine returns only the caller\'s own payments', async () => {
    const mineA = await api('GET', '/mine', { token: 'token-a' });
    assert.ok(mineA.data.payments.some((p) => p.id === paymentOfA));
    assert.ok(mineA.data.payments.every((p) => p.beraterId === userA.id));

    const mineB = await api('GET', '/mine', { token: 'token-b' });
    assert.equal(mineB.status, 200);
    assert.ok(mineB.data.payments.every((p) => p.beraterId === userB.id));
    assert.ok(!mineB.data.payments.some((p) => p.id === paymentOfA));
  });

  test('invoice: owner and admin yes, other users get 404', async () => {
    assert.equal((await api('GET', `/${paymentOfA}/invoice`, { token: 'token-a' })).status, 200);
    assert.equal((await api('GET', `/${paymentOfA}/invoice`, { token: 'token-admin' })).status, 200);
    assert.equal((await api('GET', `/${paymentOfA}/invoice`, { token: 'token-b' })).status, 404);
    assert.equal((await api('GET', `/${paymentOfA}/invoice`)).status, 401);
  });

  test('sync: only the owner can trigger it', async () => {
    assert.equal((await api('POST', `/${paymentOfA}/sync`, { token: 'token-b' })).status, 404);
    assert.equal((await api('POST', `/${paymentOfA}/sync`, { token: 'token-admin' })).status, 403);
    assert.equal((await api('POST', `/${paymentOfA}/sync`)).status, 401);
    assert.equal((await api('POST', `/${paymentOfA}/sync`, { token: 'token-a' })).status, 200);
  });
});

describe('abuse protection', () => {
  test('failureLockUntil locks only after more than 5 failures within an hour', () => {
    const HOUR = 3600 * 1000;
    const t0 = 1_000_000_000;
    const five = [0, 1, 2, 3, 4].map((m) => t0 + m * 60_000);
    assert.equal(failureLockUntil(five), 0);
    const six = [...five, t0 + 30 * 60_000];
    assert.equal(failureLockUntil(six), t0 + 30 * 60_000 + HOUR);
    const spread = [0, 15, 30, 45, 60, 75].map((m) => t0 + m * 60_000);
    assert.equal(failureLockUntil(spread), 0, 'six failures over 75 minutes do not lock');
  });

  test('more than 5 failed payments → suspicious_activity, admin email, 429 for an hour', async () => {
    const alertsBefore = sentAlerts.length;
    for (let i = 0; i < 6; i += 1) {
      const order = await checkout('token-c');
      assert.equal(order.status, 201, `checkout ${i + 1} should still be allowed`);
      await finishPayment(order, 'failed');
    }

    const suspicious = auditEvents('suspicious_activity', (e) => e.user_id === userC.id);
    assert.equal(suspicious.length, 1);
    assert.equal(suspicious[0].metadata.reason, 'failed_payments');

    assert.equal(sentAlerts.length, alertsBefore + 1);
    assert.deepEqual(sentAlerts.at(-1).to, ['admin@vantaro.test']);

    const blocked = await checkout('token-c');
    assert.equal(blocked.status, 429);
    const retryAfter = Number(blocked.headers.get('retry-after'));
    assert.ok(retryAfter > 3500 && retryAfter <= 3600, `Retry-After ${retryAfter}`);

    const anyPayment = db.tables.lead_payments.find((row) => row.berater_id === userC.id);
    assert.equal((await api('POST', `/${anyPayment.id}/sync`, { token: 'token-c' })).status, 429);

    // One alert per lock, even when the user keeps trying.
    await checkout('token-c');
    assert.equal(sentAlerts.length, alertsBefore + 1);
    assert.equal(auditEvents('suspicious_activity', (e) => e.user_id === userC.id).length, 1);

    // Other users are not affected.
    assert.equal((await checkout('token-b')).status, 201);
  });

  test('rate limit on GET /return logs suspicious_activity and returns 429', async () => {
    for (let i = 0; i < 30; i += 1) {
      assert.equal((await api('GET', '/return?token=bad')).status, 303);
    }
    const limited = await api('GET', '/return?token=bad');
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    const entry = auditEvents('suspicious_activity', (e) => e.metadata.route === 'return');
    assert.equal(entry.length, 1);
    assert.equal(entry[0].metadata.reason, 'rate_limit');
  });

  test('rate limit on POST /checkout is per user', async () => {
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await checkout('token-b')).status, 201);
    }
    assert.equal((await checkout('token-b')).status, 429);
    assert.equal((await checkout('token-a')).status, 201);
  });

  test('rate limit on POST /:id/sync', async () => {
    const order = await checkout('token-a');
    for (let i = 0; i < 30; i += 1) {
      await api('POST', `/${order.data.paymentId}/sync`, { token: 'token-a' });
    }
    assert.equal((await api('POST', `/${order.data.paymentId}/sync`, { token: 'token-a' })).status, 429);
  });
});
