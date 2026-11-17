export const ROLES = {
  BERATER: 'berater',
  ADMIN: 'admin',
  IT_SUPPORT: 'it_support',
};

export const PARTNER_ROLE_IDS = ['dispatcher', 'sub_partner', 'field_rep'];

export const DEFAULT_ROLE = ROLES.BERATER;
export const ALLOWED_ROLES = new Set(Object.values(ROLES));

/** Platform staff: never treated as Berater (no customer number, no leads, no packages). */
export const STAFF_ROLES = new Set([ROLES.ADMIN, ROLES.IT_SUPPORT]);

export function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : DEFAULT_ROLE;
}

function emailList(value) {
  return String(value || '')
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function adminEmails() {
  return emailList(process.env.ADMIN_EMAILS);
}

/** IT_SUPPORT_EMAILS works like ADMIN_EMAILS: listed accounts get the IT Support role on their next request. */
export function itSupportEmails() {
  return emailList(process.env.IT_SUPPORT_EMAILS);
}

export function isAdminEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized) && adminEmails().includes(normalized);
}

export function isItSupportEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized) && itSupportEmails().includes(normalized);
}

export function getUserRole(user) {
  if (isAdminEmail(user?.email)) return ROLES.ADMIN;
  if (isItSupportEmail(user?.email)) return ROLES.IT_SUPPORT;
  if (user?.app_metadata?.role) return normalizeRole(user.app_metadata.role);
  // user_metadata can be written by the user themself, so it never grants a staff role.
  const selfRole = normalizeRole(user?.user_metadata?.role);
  return STAFF_ROLES.has(selfRole) ? DEFAULT_ROLE : selfRole;
}

export function isAdmin(userOrRole) {
  const role = typeof userOrRole === 'string' ? normalizeRole(userOrRole) : getUserRole(userOrRole);
  return role === ROLES.ADMIN;
}

export function isItSupport(userOrRole) {
  const role = typeof userOrRole === 'string' ? normalizeRole(userOrRole) : getUserRole(userOrRole);
  return role === ROLES.IT_SUPPORT;
}

export function isStaff(userOrRole) {
  const role = typeof userOrRole === 'string' ? normalizeRole(userOrRole) : getUserRole(userOrRole);
  return STAFF_ROLES.has(role);
}
