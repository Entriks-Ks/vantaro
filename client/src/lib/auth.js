import { apiUrl } from './api';
import { supabase } from './supabase';

const STORAGE_KEY = 'vantaro-auth';
const OAUTH_NEXT_KEY = 'vantaro-oauth-next';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

async function parseAuthResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.');
    error.requiresVerification = Boolean(payload.requiresVerification);
    error.email = payload.email;
    error.retryAfter = payload.retryAfter;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function loginRequest(email, password) {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await parseAuthResponse(response);
  writeStoredSession(session);
  return session;
}

export function rememberOAuthNext(path) {
  const next = String(path || '').trim();
  if (!next || next.startsWith('/onboarding') || next === '/login' || next === '/register') {
    sessionStorage.removeItem(OAUTH_NEXT_KEY);
    return;
  }
  sessionStorage.setItem(OAUTH_NEXT_KEY, next);
}

export function consumeOAuthNext() {
  const next = sessionStorage.getItem(OAUTH_NEXT_KEY);
  sessionStorage.removeItem(OAUTH_NEXT_KEY);
  if (!next || next.startsWith('/onboarding')) return '/dashboard';
  return next;
}

const OAUTH_PROVIDERS = {
  google: 'Google',
  apple: 'Apple',
};

function oauthLabel(provider) {
  return OAUTH_PROVIDERS[provider] || 'Social';
}

export async function startOAuthLogin(provider, nextPath) {
  const label = oauthLabel(provider);
  if (!OAUTH_PROVIDERS[provider]) {
    const error = new Error(`${label}-Anmeldung ist nicht verfügbar.`);
    error.status = 400;
    throw error;
  }
  if (!supabase) {
    const error = new Error(`${label}-Anmeldung ist nicht konfiguriert.`);
    error.status = 503;
    throw error;
  }

  rememberOAuthNext(nextPath);
  const options = {
    redirectTo: `${window.location.origin}/auth/callback`,
  };
  if (provider === 'google') {
    options.queryParams = { prompt: 'select_account' };
  }

  const { error } = await supabase.auth.signInWithOAuth({ provider, options });

  if (error) {
    const next = new Error(mapOAuthError(error.message, provider));
    next.status = 400;
    throw next;
  }
}

export async function startGoogleLogin(nextPath) {
  return startOAuthLogin('google', nextPath);
}

export async function startAppleLogin(nextPath) {
  return startOAuthLogin('apple', nextPath);
}

export async function completeOAuthRequest({ access_token, refresh_token, expires_at }) {
  const response = await fetch(apiUrl('/api/auth/oauth'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({ access_token, refresh_token, expires_at }),
  });
  const session = await parseAuthResponse(response);
  writeStoredSession(session);
  return session;
}

const oauthCallbackByCode = new Map();

export async function exchangeOAuthCallback() {
  if (!supabase) {
    const error = new Error('Social-Anmeldung ist nicht konfiguriert.');
    error.status = 503;
    throw error;
  }

  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get('error_description') || params.get('error');
  if (oauthError) {
    const error = new Error(mapOAuthError(oauthError));
    error.status = 400;
    throw error;
  }

  const code = params.get('code');
  if (!code) {
    const error = new Error('Die Anmeldung wurde abgebrochen.');
    error.status = 400;
    throw error;
  }

  const existing = oauthCallbackByCode.get(code);
  if (existing) return existing;

  const pending = (async () => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session?.access_token) {
      console.error('OAuth callback exchange failed:', error?.message || error);
      const next = new Error(mapOAuthError(error?.message || 'Anmeldung ist fehlgeschlagen.'));
      next.status = 400;
      throw next;
    }

    const session = await completeOAuthRequest({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });

    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return session;
  })();

  oauthCallbackByCode.set(code, pending);
  try {
    return await pending;
  } catch (error) {
    oauthCallbackByCode.delete(code);
    throw error;
  }
}

export async function exchangeGoogleCallback() {
  return exchangeOAuthCallback();
}

function mapOAuthError(message, provider) {
  const label = oauthLabel(provider);
  const text = String(message || '');
  if (/already registered|already exists|identity/i.test(text)) {
    return 'Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich mit Passwort an.';
  }
  if (/access denied|cancelled|canceled/i.test(text)) {
    return `Die ${label}-Anmeldung wurde abgebrochen.`;
  }
  if (/provider is not enabled/i.test(text)) {
    return `${label}-Anmeldung ist in Supabase noch nicht aktiviert.`;
  }
  if (/code verifier|pkce/i.test(text)) {
    return `Die ${label}-Anmeldung konnte nicht abgeschlossen werden. Bitte starten Sie die Anmeldung erneut.`;
  }
  return `${label}-Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.`;
}

export async function registerRequest(payload) {
  const response = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseAuthResponse(response);
}

export async function verifyEmailRequest(email, code) {
  const response = await fetch(apiUrl('/api/auth/verify-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const payload = await parseAuthResponse(response);
  if (payload.access_token) writeStoredSession(payload);
  return payload;
}

export async function verifyEmailTokenRequest(email, token) {
  const response = await fetch(apiUrl('/api/auth/verify-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token }),
  });
  const payload = await parseAuthResponse(response);
  if (payload.access_token) writeStoredSession(payload);
  return payload;
}

export async function resendVerificationRequest(email) {
  const response = await fetch(apiUrl('/api/auth/resend-verification'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseAuthResponse(response);
}

export async function logoutRequest() {
  const session = readStoredSession();
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    });
  } finally {
    writeStoredSession(null);
  }
}

export async function forgotPasswordRequest(email) {
  const response = await fetch(apiUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseAuthResponse(response);
}

export async function resetPasswordRequest({ email, password, token }) {
  const response = await fetch(apiUrl('/api/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, token }),
  });
  return parseAuthResponse(response);
}

export async function resendPasswordResetRequest(email) {
  const response = await fetch(apiUrl('/api/auth/resend-password-reset'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseAuthResponse(response);
}

export async function updateProfileRequest(payload) {
  const session = readStoredSession();
  const response = await fetch(apiUrl('/api/auth/profile'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const next = await parseAuthResponse(response);
  if (next.user && session) {
    writeStoredSession({ ...session, user: next.user });
  }
  return next;
}

export async function changePasswordRequest({ currentPassword, password }) {
  const session = readStoredSession();
  const response = await fetch(apiUrl('/api/auth/change-password'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ currentPassword, password }),
  });
  return parseAuthResponse(response);
}

export async function restoreSession() {
  const session = readStoredSession();
  if (!session?.access_token) return null;

  const meResponse = await fetch(apiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (meResponse.ok) {
    const payload = await meResponse.json();
    const next = { ...session, user: payload.user };
    writeStoredSession(next);
    return next;
  }

  if (session.refresh_token) {
    const refreshResponse = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (refreshResponse.ok) {
      const next = await refreshResponse.json();
      writeStoredSession(next);
      return next;
    }
  }

  writeStoredSession(null);
  return null;
}

export async function fetchDashboard() {
  const session = readStoredSession();
  const response = await fetch(apiUrl('/api/dashboard'), {
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
  });
  return parseAuthResponse(response);
}

export { readStoredSession, writeStoredSession };
