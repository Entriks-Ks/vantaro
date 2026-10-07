import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getClientOrigin } from './clientOrigin.js';
import { hasCustomMailer, sendPartnerInviteEmail } from './mailer.js';
import { supabase } from './supabase.js';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || 'vantaro';
}

function hashValue(email, value) {
  return createHash('sha256')
    .update(`${email}:partner_invite:link:${value}:${secret()}`)
    .digest('hex');
}

function hashesEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function generateToken() {
  return randomBytes(24).toString('hex');
}

export function getPartnerInviteState(user) {
  return user?.user_metadata?.partner_invite || null;
}

export function secondsUntilPartnerInviteResend(user) {
  const lastSent = getPartnerInviteState(user)?.last_sent_at;
  if (!lastSent) return 0;
  const remaining = RESEND_COOLDOWN_MS - (Date.now() - new Date(lastSent).getTime());
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export async function issuePartnerInvite(user, { ignoreCooldown = false, inviterName = '' } = {}) {
  if (!hasCustomMailer()) {
    throw new Error('E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY / EMAIL_FROM).');
  }

  const email = user.email.toLowerCase();
  const wait = secondsUntilPartnerInviteResend(user);
  if (!ignoreCooldown && wait > 0) {
    const error = new Error(`Bitte warten Sie ${wait} Sekunden, bevor Sie die Einladung erneut senden.`);
    error.code = 'cooldown';
    error.retryAfter = wait;
    throw error;
  }

  const token = generateToken();
  const now = new Date();
  const metadata = {
    ...(user.user_metadata || {}),
    energy_invite_accepted: false,
    partner_invite: {
      link_hash: hashValue(email, token),
      expires_at: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
      attempts: 0,
      last_sent_at: now.toISOString(),
    },
  };

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: metadata,
  });
  if (error) throw error;

  const inviteUrl = `${getClientOrigin()}/einladung?email=${encodeURIComponent(email)}&confirm=${token}`;

  await sendPartnerInviteEmail({
    to: email,
    inviteUrl,
    fullName: metadata.full_name || '',
    inviterName,
  });

  return data.user;
}

async function bumpAttempts(user, state) {
  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      partner_invite: {
        ...state,
        attempts: (state.attempts || 0) + 1,
      },
    },
  });
}

function assertInvitable(state) {
  if (!state?.link_hash) {
    const error = new Error('Bitte fordern Sie eine neue Einladung an.');
    error.code = 'invalid';
    throw error;
  }

  if (new Date(state.expires_at).getTime() < Date.now()) {
    const error = new Error('Die Einladung ist abgelaufen. Bitte fordern Sie eine neue an.');
    error.code = 'expired';
    throw error;
  }

  if ((state.attempts || 0) >= MAX_ATTEMPTS) {
    const error = new Error('Zu viele Fehlversuche. Bitte fordern Sie eine neue Einladung an.');
    error.code = 'locked';
    throw error;
  }
}

export async function acceptPartnerInvite(user, token, password) {
  const email = user.email.toLowerCase();
  const state = getPartnerInviteState(user);
  const trimmed = String(token || '').trim();

  if (!trimmed || trimmed.length < 16) {
    const error = new Error('Der Einladungslink ist ungültig oder abgelaufen.');
    error.code = 'invalid';
    throw error;
  }

  assertInvitable(state);

  if (!hashesEqual(state.link_hash || '', hashValue(email, trimmed))) {
    await bumpAttempts(user, state);
    const error = new Error('Der Einladungslink ist ungültig oder abgelaufen.');
    error.code = 'invalid';
    throw error;
  }

  const metadata = { ...(user.user_metadata || {}) };
  delete metadata.partner_invite;
  delete metadata.password_reset;
  metadata.energy_invite_accepted = true;

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: metadata,
  });
  if (error) throw error;
  return data.user;
}
