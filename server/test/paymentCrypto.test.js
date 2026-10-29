import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPaymentEncryptionConfigured,
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from '../src/lib/paymentCrypto.js';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const saved = {
  key: process.env.PAYMENT_ENCRYPTION_KEY,
  nodeEnv: process.env.NODE_ENV,
  render: process.env.RENDER,
};

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('PAYMENT_ENCRYPTION_KEY', saved.key);
  restore('NODE_ENV', saved.nodeEnv);
  restore('RENDER', saved.render);
});

describe('paymentCrypto', () => {
  test('encrypts order passwords with AES-256-GCM and decrypts them again', () => {
    process.env.PAYMENT_ENCRYPTION_KEY = KEY_A;
    const stored = encryptSecret('order-pass-123');
    assert.ok(isEncryptedSecret(stored));
    assert.ok(!stored.includes('order-pass-123'));
    assert.equal(decryptSecret(stored), 'order-pass-123');
  });

  test('uses a fresh IV for every value', () => {
    process.env.PAYMENT_ENCRYPTION_KEY = KEY_A;
    assert.notEqual(encryptSecret('same'), encryptSecret('same'));
  });

  test('returns legacy plaintext values unchanged', () => {
    process.env.PAYMENT_ENCRYPTION_KEY = KEY_A;
    assert.equal(decryptSecret('legacy-plain'), 'legacy-plain');
    assert.equal(decryptSecret(null), null);
  });

  test('rejects tampered ciphertext and the wrong key without echoing the value', () => {
    process.env.PAYMENT_ENCRYPTION_KEY = KEY_A;
    const stored = encryptSecret('order-pass-123');
    const raw = Buffer.from(stored.slice('enc:v1:'.length), 'base64');
    raw[raw.length - 1] ^= 0xff;
    assert.throws(() => decryptSecret(`enc:v1:${raw.toString('base64')}`), /entschlüsselt/);

    process.env.PAYMENT_ENCRYPTION_KEY = KEY_B;
    assert.throws(() => decryptSecret(stored), (error) => !error.message.includes(stored));
  });

  test('rejects a malformed key', () => {
    process.env.PAYMENT_ENCRYPTION_KEY = 'too-short';
    assert.throws(() => encryptSecret('x'), /64 Hex-Zeichen/);
  });

  test('production refuses to start without the key', () => {
    delete process.env.PAYMENT_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    assert.throws(() => assertPaymentEncryptionConfigured(), /PAYMENT_ENCRYPTION_KEY fehlt/);
    assert.throws(() => encryptSecret('x'), /PAYMENT_ENCRYPTION_KEY fehlt/);

    process.env.NODE_ENV = 'development';
    process.env.RENDER = 'true';
    assert.throws(() => assertPaymentEncryptionConfigured(), /PAYMENT_ENCRYPTION_KEY fehlt/);
  });

  test('local development without the key keeps working in plaintext', () => {
    delete process.env.PAYMENT_ENCRYPTION_KEY;
    delete process.env.RENDER;
    process.env.NODE_ENV = 'development';
    assert.equal(assertPaymentEncryptionConfigured(), false);
    assert.equal(encryptSecret('dev-pass'), 'dev-pass');
  });
});
