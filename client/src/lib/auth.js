const STORAGE_KEY = 'vantaro-auth';

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
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await parseAuthResponse(response);
  writeStoredSession(session);
  return session;
}

export async function registerRequest({ fullName, email, password }) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, password }),
  });
  return parseAuthResponse(response);
}

export async function verifyEmailRequest(email, code) {
  const response = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  return parseAuthResponse(response);
}

export async function verifyEmailTokenRequest(tokenHash, type = 'signup') {
  const response = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_hash: tokenHash, type }),
  });
  return parseAuthResponse(response);
}

export async function resendVerificationRequest(email) {
  const response = await fetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseAuthResponse(response);
}

export async function logoutRequest() {
  const session = readStoredSession();
  try {
    await fetch('/api/auth/logout', {
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
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseAuthResponse(response);
}

export async function restoreSession() {
  const session = readStoredSession();
  if (!session?.access_token) return null;

  const meResponse = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (meResponse.ok) {
    const payload = await meResponse.json();
    const next = { ...session, user: payload.user };
    writeStoredSession(next);
    return next;
  }

  if (session.refresh_token) {
    const refreshResponse = await fetch('/api/auth/refresh', {
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

export { readStoredSession, writeStoredSession };
