import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';

const lib = (name) => new URL(`../src/lib/${name}`, import.meta.url).href;

// In-memory stand-in for the Supabase auth admin API used by the auth routes.
const users = new Map();
const clone = (value) => structuredClone(value);
const client = {
  auth: {
    async getUser() {
      return { data: { user: null }, error: { message: 'invalid' } };
    },
    admin: {
      async createUser({ email, password, user_metadata, app_metadata }) {
        const user = {
          id: crypto.randomUUID(),
          email,
          password: password ?? null,
          user_metadata: clone(user_metadata || {}),
          app_metadata: clone(app_metadata || {}),
          created_at: new Date().toISOString(),
        };
        users.set(user.id, user);
        return { data: { user: clone(user) }, error: null };
      },
      async updateUserById(id, attrs) {
        const user = users.get(id);
        if (!user) return { data: { user: null }, error: { message: 'not found' } };
        if (attrs.password !== undefined) user.password = attrs.password;
        if (attrs.user_metadata) user.user_metadata = clone(attrs.user_metadata);
        if (attrs.app_metadata) user.app_metadata = clone(attrs.app_metadata);
        return { data: { user: clone(user) }, error: null };
      },
      async deleteUser(id) {
        users.delete(id);
        return { error: null };
      },
    },
  },
};

const sentVerificationEmails = [];

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
    allocateCustomerNumber: async () => '',
    createUserSession: async () => null,
    ensureUserRole: async (user) => user,
    finalizeOAuthUser: async (user) => user,
    findUserByEmail: async (email) => {
      const match = [...users.values()].find((user) => user.email === String(email).toLowerCase());
      return match ? clone(match) : null;
    },
    isEmailVerified: (user) => user?.user_metadata?.email_verified === true,
    isSupportedOAuthUser: () => false,
    revokeSession: async () => {},
  },
});
mock.module(lib('mailer.js'), {
  namedExports: {
    hasCustomMailer: () => true,
    sendVerificationCodeEmail: async (payload) => {
      sentVerificationEmails.push(payload);
      return 'mock';
    },
    sendPasswordResetEmail: async () => 'mock',
    sendPartnerInviteEmail: async () => 'mock',
  },
});

const { default: express } = await import('express');
const { default: authRouter } = await import('../src/routes/auth.js');
const { setManualVerificationCode } = await import('../src/lib/verification.js');

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function post(path, body) {
  const response = await fetch(`${baseUrl}/api/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function userByEmail(email) {
  return [...users.values()].find((user) => user.email === email);
}

const registration = (email) => ({
  email,
  password: 'Geheim123!',
  firstName: 'Erika',
  lastName: 'Muster',
  vertical: 'insurance',
});

describe('manually issued verification code', () => {
  const email = 'manual@vantaro.test';
  const code = '482913';

  before(async () => {
    // What scripts/manual-verification-code.js does: placeholder user + code, no email.
    const { data } = await client.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { email_verified: false, onboarding_complete: false },
      app_metadata: { role: 'berater' },
    });
    await setManualVerificationCode(data.user, { code, ttlMs: 7 * 24 * 60 * 60 * 1000 });
  });

  test('registering saves the person\'s own password and details and sends no email', async () => {
    const before = sentVerificationEmails.length;
    const result = await post('/register', registration(email));

    assert.equal(result.status, 201);
    assert.equal(result.body.requiresVerification, true);
    assert.equal(sentVerificationEmails.length, before);

    const user = userByEmail(email);
    assert.equal(user.password, 'Geheim123!');
    assert.equal(user.user_metadata.first_name, 'Erika');
    assert.equal(user.user_metadata.vertical, 'insurance');
    assert.equal(user.user_metadata.email_verified, false);
    assert.equal(user.user_metadata.email_verification.method, 'manual');
  });

  test('"send code again" keeps the manual code and sends no email', async () => {
    const hashBefore = userByEmail(email).user_metadata.email_verification.hash;
    const before = sentVerificationEmails.length;
    const result = await post('/resend-verification', { email });

    assert.equal(result.status, 200);
    assert.equal(sentVerificationEmails.length, before);
    assert.equal(userByEmail(email).user_metadata.email_verification.hash, hashBefore);
  });

  test('a wrong code is rejected and the manual code verifies the account', async () => {
    const wrong = await post('/verify-email', { email, code: '000000' });
    assert.equal(wrong.status, 400);

    const right = await post('/verify-email', { email, code });
    assert.equal(right.status, 200);
    assert.equal(right.body.verified, true);
    assert.equal(userByEmail(email).user_metadata.email_verified, true);
  });

  test('registering again after verification is refused', async () => {
    const result = await post('/register', registration(email));
    assert.equal(result.status, 409);
  });
});

describe('normal registration is unchanged', () => {
  test('a new address still gets its code by email', async () => {
    const before = sentVerificationEmails.length;
    const result = await post('/register', registration('normal@vantaro.test'));

    assert.equal(result.status, 201);
    assert.equal(sentVerificationEmails.length, before + 1);
    assert.equal(sentVerificationEmails.at(-1).to, 'normal@vantaro.test');
    assert.equal(userByEmail('normal@vantaro.test').user_metadata.email_verification.method, 'resend');
  });
});
