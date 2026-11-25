import { apiUrl } from './api';
import { readStoredSession, restoreSession, writeStoredSession } from './auth';
import { L } from './i18n';

/**
 * IT Support "sign in as user". The browser keeps one session (vantaro-auth), so the support
 * session is parked here while the customer's session is active, and put back when it ends.
 */
const KEY = 'vantaro-impersonation';

export function readImpersonation() {
  try {
    const raw = localStorage.getItem(KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value?.supportSession?.access_token && value?.target?.id ? value : null;
  } catch {
    return null;
  }
}

export function startImpersonation({ session, target }) {
  const supportSession = readStoredSession();
  if (!supportSession?.access_token || !session?.access_token) {
    throw new Error(L('Keine gültige Sitzung.', 'No valid session.'));
  }
  localStorage.setItem(KEY, JSON.stringify({
    supportSession,
    target,
    startedAt: new Date().toISOString(),
  }));
  writeStoredSession(session);
  // Full reload: AuthProvider and every cached view start fresh as the customer.
  window.location.assign('/dashboard');
}

export async function endImpersonation() {
  const state = readImpersonation();
  const current = readStoredSession();

  // Revoke only this support session; the customer's own sessions stay signed in.
  if (current?.access_token && current.access_token !== state?.supportSession?.access_token) {
    await fetch(apiUrl('/api/auth/logout?scope=local'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${current.access_token}` },
    }).catch(() => {});
  }

  localStorage.removeItem(KEY);
  if (!state) {
    window.location.assign('/login');
    return;
  }

  writeStoredSession(state.supportSession);
  // The parked support token may be older than an hour: refresh it before logging the end.
  const support = await restoreSession().catch(() => null);
  if (support?.access_token) {
    await fetch(apiUrl(`/api/it-support/users/${encodeURIComponent(state.target.id)}/impersonate/end`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${support.access_token}`,
      },
      body: '{}',
    }).catch(() => {});
  }
  window.location.assign(support ? `/it-support/users?id=${encodeURIComponent(state.target.id)}` : '/login');
}
