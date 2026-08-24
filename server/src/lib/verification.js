import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { supabase } from './supabase.js';
import { sendVerificationCodeEmail } from './mailer.js';

export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || 'vantaro';
}

function hashValue(email, value, kind) {
  return createHash('sha256')
    .update(`${email}:${kind}:${value}:${secret()}`)
    .digest('hex');
}

function legacyCodeHash(email, code) {
  return createHash('sha256')
    .update(`${email}:${code}:${secret()}`)
    .digest('hex');
}

function hashesEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function generateVerificationToken() {
  return randomBytes(24).toString('hex');
}

export function clientOrigin() {
  return String(process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
}

export function getVerificationState(user) {
  return user?.user_metadata?.email_verification || null;
}

export function secondsUntilResend(userOrEmail) {
  const lastSent =
    typeof userOrEmail === 'string'
      ? null
      : getVerificationState(userOrEmail)?.last_sent_at;
  if (!lastSent) return 0;
  const remaining = RESEND_COOLDOWN_MS - (Date.now() - new Date(lastSent).getTime());
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export async function issueVerificationCode(user, { ignoreCooldown = false } = {}) {
  const email = user.email.toLowerCase();
  const wait = secondsUntilResend(user);
  if (!ignoreCooldown && wait > 0) {
    const error = new Error(`Bitte warten Sie ${wait} Sekunden, bevor Sie einen neuen Code anfordern.`);
    error.code = 'cooldown';
    error.retryAfter = wait;
    throw error;
  }

  const code = generateVerificationCode();
  const token = generateVerificationToken();
  const now = new Date();
  const metadata = {
    ...(user.user_metadata || {}),
    email_verified: false,
    email_verification: {
      hash: hashValue(email, code, 'code'),
      link_hash: hashValue(email, token, 'link'),
      expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      attempts: 0,
      last_sent_at: now.toISOString(),
      method: 'resend',
    },
  };

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: false,
    user_metadata: metadata,
  });
  if (error) throw error;

  const confirmUrl = `${clientOrigin()}/verify-email?email=${encodeURIComponent(email)}&confirm=${token}&code=${code}`;

  await sendVerificationCodeEmail({
    to: email,
    code,
    confirmUrl,
    fullName: metadata.full_name || '',
  });

  return data.user;
}

async function bumpAttempts(user, state) {
  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      email_verification: {
        ...state,
        attempts: (state.attempts || 0) + 1,
      },
    },
  });
}

function assertVerifiable(state) {
  if (!state?.hash && !state?.link_hash) {
    const error = new Error('Bitte fordern Sie einen neuen Bestätigungscode an.');
    error.code = 'invalid';
    throw error;
  }

  if (new Date(state.expires_at).getTime() < Date.now()) {
    const error = new Error('Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.');
    error.code = 'expired';
    throw error;
  }

  if ((state.attempts || 0) >= MAX_ATTEMPTS) {
    const error = new Error('Zu viele Fehlversuche. Bitte fordern Sie einen neuen Code an.');
    error.code = 'locked';
    throw error;
  }
}

async function confirmUser(user) {
  const metadata = { ...(user.user_metadata || {}) };
  delete metadata.email_verification;
  metadata.email_verified = true;

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  return data.user;
}

export async function verifyUserCode(user, code) {
  const email = user.email.toLowerCase();
  const state = getVerificationState(user);
  const trimmed = String(code || '').replace(/\s+/g, '');

  if (!/^\d{6}$/.test(trimmed)) {
    const error = new Error('Bitte geben Sie den 6-stelligen Code ein.');
    error.code = 'invalid';
    throw error;
  }

  assertVerifiable(state);

  if (
    !hashesEqual(state.hash || '', hashValue(email, trimmed, 'code'))
    && !hashesEqual(state.hash || '', legacyCodeHash(email, trimmed))
  ) {
    await bumpAttempts(user, state);
    const error = new Error('Der Code ist ungültig oder abgelaufen.');
    error.code = 'invalid';
    throw error;
  }

  return confirmUser(user);
}

export async function verifyUserToken(user, token) {
  const email = user.email.toLowerCase();
  const state = getVerificationState(user);
  const trimmed = String(token || '').trim();

  if (!trimmed || trimmed.length < 16) {
    const error = new Error('Der Bestätigungslink ist ungültig oder abgelaufen.');
    error.code = 'invalid';
    throw error;
  }

  assertVerifiable(state);

  if (!hashesEqual(state.link_hash || '', hashValue(email, trimmed, 'link'))) {
    await bumpAttempts(user, state);
    const error = new Error('Der Bestätigungslink ist ungültig oder abgelaufen.');
    error.code = 'invalid';
    throw error;
  }

  return confirmUser(user);
}
