import { after, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createFakeSupabase } from './helpers/fakeSupabase.js';

process.env.NODE_ENV = 'test';
delete process.env.RENDER;
process.env.PAYMENT_PROVIDER = 'mock';
process.env.PAYMENT_ENCRYPTION_KEY = 'd'.repeat(64);
process.env.ADMIN_EMAILS = 'admin@vantaro.test';
process.env.IT_SUPPORT_EMAILS = 'support@vantaro.test';

const lib = (name) => new URL(`../src/lib/${name}`, import.meta.url).href;
const { db, client } = createFakeSupabase();

// Auth admin calls the console makes; attribute changes are applied so tests can assert them.
client.auth.admin.updateUserById = async (id, attrs) => {
  const user = db.users.get(id);
  if (!user) return { data: { user: null }, error: { message: 'not found' } };
  if (attrs.user_metadata) user.user_metadata = structuredClone(attrs.user_metadata);
  if (attrs.app_metadata) user.app_metadata = structuredClone(attrs.app_metadata);
  if (attrs.email) user.email = attrs.email;
  if (attrs.ban_duration === 'none') user.banned_until = null;
  else if (attrs.ban_duration) user.banned_until = '2999-01-01T00:00:00Z';
  return { data: { user: structuredClone(user) }, error: null };
};
client.auth.admin.listUsers = async () => ({ data: { users: [...db.users.values()].map((user) => structuredClone(user)) }, error: null });
client.auth.admin.deleteUser = async (id) => {
  db.users.delete(id);
  return { error: null };
};

mock.module(lib('supabase.js'), {
  namedExports: {
    supabase: client,
    supabaseAuth: client,
    supabaseConfig: { url: 'http://db.test', configured: true, serviceRoleKey: 'x', anonKey: 'y' },
    pingDatabase: async () => ({ ok: true }),
  },
});

const { default: express } = await import('express');
const { default: itSupportRouter } = await import('../src/routes/itSupport/index.js');
const { getUserRole } = await import('../src/lib/roles.js');

function addUser({ email, role = 'berater', metadata = {} }) {
  const user = {
    id: crypto.randomUUID(),
    email,
    app_metadata: { role },
    user_metadata: { email_verified: true, first_name: email.split('@')[0], last_name: 'Test', ...metadata },
    created_at: new Date().toISOString(),
  };
  db.users.set(user.id, user);
  const token = crypto.randomBytes(12).toString('hex');
  db.tokens.set(token, user);
  return { user, token };
}

const support = addUser({ email: 'support@vantaro.test', role: 'berater' });
const admin = addUser({ email: 'admin@vantaro.test', role: 'admin' });
const berater = addUser({ email: 'berater@vantaro.test', role: 'berater', metadata: { vertical: 'insurance', onboarding_complete: false } });

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/it-support', itSupportRouter);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, { token = support.token, body, lang = 'de' } = {}) {
  const response = await fetch(`${baseUrl}/api/it-support${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': lang,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

function lead(overrides = {}) {
  const row = {
    id: crypto.randomUUID(),
    first_name: 'Lea',
    last_name: 'Lead',
    email: 'lea@example.test',
    status: 'neu',
    contact_status: null,
    assigned_to: null,
    assigned_at: null,
    request_id: null,
    refunded_at: null,
    broker_notes: null,
    source: 'manual',
    vertical: 'insurance',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  db.tables.leads.push(row);
  return row;
}

const auditRows = () => db.tables.it_support_audit_log || [];

beforeEach(() => {
  db.tables.leads = [];
  db.tables.lead_complaints = [];
  db.tables.lead_requests = [];
  db.tables.lead_payments = [];
  db.tables.payment_audit_log = [];
  db.tables.berater_discounts = [];
  db.tables.system_events = [];
  db.tables.it_support_audit_log = [];
});

describe('role', () => {
  test('IT_SUPPORT_EMAILS grants the role; user_metadata can never grant a staff role', () => {
    assert.equal(getUserRole({ email: 'Support@Vantaro.test', app_metadata: { role: 'berater' } }), 'it_support');
    assert.equal(getUserRole({ email: 'x@vantaro.test', app_metadata: { role: 'it_support' } }), 'it_support');
    assert.equal(getUserRole({ email: 'x@vantaro.test', user_metadata: { role: 'admin' } }), 'berater');
    assert.equal(getUserRole({ email: 'x@vantaro.test', user_metadata: { role: 'it_support' } }), 'berater');
  });
});

describe('access', () => {
  test('a Berater is refused', async () => {
    const result = await call('GET', '/system/activity', { token: berater.token });
    assert.equal(result.status, 403);
  });

  test('IT Support and admins are allowed', async () => {
    assert.equal((await call('GET', '/system/activity')).status, 200);
    assert.equal((await call('GET', '/system/activity', { token: admin.token })).status, 200);
  });

  test('changes are refused while the activity log table is missing', async () => {
    delete db.tables.it_support_audit_log;
    const row = lead({ status: 'zugewiesen' });
    const result = await call('POST', `/leads/${row.id}/fix`, { body: { checkId: 'assigned_status_without_berater' } });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'audit_log_missing');
    assert.equal(db.tables.leads[0].status, 'zugewiesen');
  });
});

describe('leads', () => {
  test('unassign needs a reason, returns the lead to the pool and logs who did it', async () => {
    const row = lead({
      status: 'zugewiesen',
      assigned_to: berater.user.id,
      assigned_at: new Date().toISOString(),
      contact_status: 'termin',
      appointment_at: new Date(Date.now() + 3600e3).toISOString(),
      broker_notes: 'private note',
    });

    const missing = await call('POST', `/leads/${row.id}/unassign`, { body: {} });
    assert.equal(missing.status, 400);
    assert.equal(db.tables.leads[0].assigned_to, berater.user.id);

    const result = await call('POST', `/leads/${row.id}/unassign`, { body: { reason: 'Falscher Berater (Ticket 42)' } });
    assert.equal(result.status, 200);
    const stored = db.tables.leads[0];
    assert.equal(stored.assigned_to, null);
    assert.equal(stored.status, 'neu');
    assert.equal(stored.contact_status, null);
    assert.equal(stored.appointment_at, null);
    assert.equal(stored.broker_notes, null);

    const [entry] = auditRows();
    assert.equal(entry.action, 'lead.unassign');
    assert.equal(entry.actor_email, 'support@vantaro.test');
    assert.equal(entry.actor_role, 'it_support');
    assert.equal(entry.target_id, row.id);
    assert.equal(entry.reason, 'Falscher Berater (Ticket 42)');
    assert.equal(entry.before.assignedTo, berater.user.id);
    assert.ok(!JSON.stringify(entry).includes('private note'), 'Berater notes must not be copied into the log');
  });

  test('one-click fix corrects an inconsistent lead', async () => {
    const row = lead({ status: 'zugewiesen' });
    const result = await call('POST', `/leads/${row.id}/fix`, { body: { checkId: 'assigned_status_without_berater' } });
    assert.equal(result.status, 200);
    assert.equal(db.tables.leads[0].status, 'neu');
    assert.equal(auditRows()[0].action, 'lead.fix');
  });

  test('a delivered lead is only deleted with explicit force', async () => {
    const row = lead({ status: 'zugewiesen', assigned_to: berater.user.id });
    const refused = await call('DELETE', `/leads/${row.id}`, { body: { reason: 'Testdaten entfernen' } });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, 'delivery_locked');
    assert.equal(db.tables.leads.length, 1);

    const forced = await call('DELETE', `/leads/${row.id}`, { body: { reason: 'Testdaten entfernen', force: true } });
    assert.equal(forced.status, 200);
    assert.equal(db.tables.leads.length, 0);
    const [entry] = auditRows();
    assert.equal(entry.action, 'lead.delete');
    assert.equal(entry.before.email, 'lea@example.test');
  });

  test('a lead with an open complaint cannot be deleted', async () => {
    const row = lead();
    db.tables.lead_complaints.push({ id: crypto.randomUUID(), lead_id: row.id, status: 'pending' });
    const result = await call('DELETE', `/leads/${row.id}`, { body: { reason: 'Dublette', force: true } });
    assert.equal(result.status, 409);
    assert.equal(db.tables.leads.length, 1);
  });
});

describe('users', () => {
  test('staff accounts are protected', async () => {
    const result = await call('POST', `/users/${admin.user.id}/block`, { body: { reason: 'Versuch' } });
    assert.equal(result.status, 403);
    assert.equal(db.users.get(admin.user.id).banned_until, undefined);
  });

  test('blocking a Berater is applied and logged', async () => {
    const result = await call('POST', `/users/${berater.user.id}/block`, { body: { reason: 'Kompromittiertes Konto' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.user.blocked, true);
    assert.equal(auditRows()[0].action, 'user.block');

    const unblock = await call('POST', `/users/${berater.user.id}/unblock`, { body: {} });
    assert.equal(unblock.status, 200);
    assert.equal(unblock.body.user.blocked, false);
  });
});

describe('payments', () => {
  test('an abandoned checkout is closed without counting against the Berater', async () => {
    const id = crypto.randomUUID();
    db.tables.lead_payments.push({
      id,
      berater_id: berater.user.id,
      status: 'pending',
      invoice_number: 'RE-TEST-1',
      gross_cents: 50000,
      created_at: new Date(Date.now() - 3 * 3600e3).toISOString(),
    });
    const result = await call('POST', `/payments/${id}/mark-failed`, { body: { reason: 'Checkout abgebrochen' } });
    assert.equal(result.status, 200);
    assert.equal(db.tables.lead_payments[0].status, 'failed');
    assert.equal(db.tables.lead_payments[0].pg_status, 'support_cancelled');
    assert.equal(auditRows()[0].action, 'payment.mark_failed');
  });

  test('only pending payments can be closed', async () => {
    const id = crypto.randomUUID();
    db.tables.lead_payments.push({ id, berater_id: berater.user.id, status: 'paid', invoice_number: 'RE-TEST-2', created_at: new Date().toISOString() });
    const result = await call('POST', `/payments/${id}/mark-failed`, { body: { reason: 'Versehen' } });
    assert.equal(result.status, 400);
    assert.equal(db.tables.lead_payments[0].status, 'paid');
  });
});

describe('console language', () => {
  test('messages follow Accept-Language and the log keeps both languages', async () => {
    const row = lead({ status: 'zugewiesen', assigned_to: berater.user.id });

    const english = await call('POST', `/leads/${row.id}/unassign`, { body: {}, lang: 'en' });
    assert.equal(english.status, 400);
    assert.match(english.body.error, /^Please enter a reason/);

    const german = await call('POST', `/leads/${row.id}/unassign`, { body: {}, lang: 'de' });
    assert.match(german.body.error, /^Bitte eine Begründung angeben/);

    const done = await call('POST', `/leads/${row.id}/unassign`, { body: { reason: 'Wrong advisor' }, lang: 'en' });
    assert.equal(done.status, 200);
    const [entry] = auditRows();
    assert.match(entry.summary, /Zuweisung an .* aufgehoben/);
    assert.match(entry.summary_en, /^Unassigned from /);
  });

  test('German messages from shared platform code are translated for the English console', async () => {
    const row = lead({ status: 'zugewiesen' });
    const result = await call('PATCH', `/leads/${row.id}`, { body: { firstName: '' }, lang: 'en' });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'First name is required.');
  });

  test('data check labels come back in the requested language', async () => {
    const row = lead({ status: 'zugewiesen' });
    const english = await call('GET', `/leads/${row.id}`, { lang: 'en' });
    assert.equal(english.body.problems[0].label, 'Status "Assigned" but no advisor');
    const german = await call('GET', `/leads/${row.id}`, { lang: 'de' });
    assert.equal(german.body.problems[0].label, 'Status „Zugewiesen“, aber kein Berater');
  });
});
