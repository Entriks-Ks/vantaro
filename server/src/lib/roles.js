export const ROLES = {
  BERATER: 'berater',
  ADMIN: 'admin',
};

export const DEFAULT_ROLE = ROLES.BERATER;
export const ALLOWED_ROLES = new Set(Object.values(ROLES));

export function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : DEFAULT_ROLE;
}

export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized) && adminEmails().includes(normalized);
}

export function getUserRole(user) {
  if (isAdminEmail(user?.email)) return ROLES.ADMIN;
  return normalizeRole(user?.app_metadata?.role || user?.user_metadata?.role);
}

export function isAdmin(userOrRole) {
  const role = typeof userOrRole === 'string' ? normalizeRole(userOrRole) : getUserRole(userOrRole);
  return role === ROLES.ADMIN;
}
