import crypto from 'node:crypto';

/**
 * AES-256-GCM for gateway secrets at rest (ProCredit order passwords).
 * Stored format: enc:v1:<base64 iv(12) | tag(16) | ciphertext>.
 * Values without the prefix are legacy plaintext and are returned unchanged.
 */
const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function fail(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Same rule as paymentGateway.js: Render sets RENDER=true, NODE_ENV may be unset there. */
function isDeployed() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
}

function readKey() {
  const hex = String(process.env.PAYMENT_ENCRYPTION_KEY || '').trim();
  if (!hex) return null;
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw fail('PAYMENT_ENCRYPTION_KEY muss 64 Hex-Zeichen haben (openssl rand -hex 32).');
  }
  return Buffer.from(hex, 'hex');
}

/** Called on startup: in production the API must not run without the key. */
export function assertPaymentEncryptionConfigured() {
  const key = readKey();
  if (!key && isDeployed()) {
    throw fail('PAYMENT_ENCRYPTION_KEY fehlt. In Produktion ist er Pflicht (openssl rand -hex 32).');
  }
  return Boolean(key);
}

export function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

let warnedPlaintext = false;

export function encryptSecret(plain) {
  if (plain == null || plain === '') return plain;
  const key = readKey();
  if (!key) {
    if (isDeployed()) throw fail('PAYMENT_ENCRYPTION_KEY fehlt.');
    if (!warnedPlaintext) {
      warnedPlaintext = true;
      console.warn('PAYMENT_ENCRYPTION_KEY fehlt — Gateway-Secrets werden lokal unverschlüsselt gespeichert.');
    }
    return String(plain);
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
}

export function decryptSecret(value) {
  if (!isEncryptedSecret(value)) return value;
  const key = readKey();
  if (!key) throw fail('PAYMENT_ENCRYPTION_KEY fehlt — Gateway-Secret kann nicht entschlüsselt werden.');
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (raw.length <= IV_BYTES + TAG_BYTES) throw fail('Verschlüsseltes Gateway-Secret ist beschädigt.');
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key or tampered value; never echo the value itself.
    throw fail('Gateway-Secret konnte nicht entschlüsselt werden (falscher PAYMENT_ENCRYPTION_KEY?).');
  }
}
