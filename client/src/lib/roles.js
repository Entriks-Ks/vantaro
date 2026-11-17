export const ROLES = {
  BERATER: 'berater',
  ADMIN: 'admin',
  IT_SUPPORT: 'it_support',
};

export const ROLE_LABELS = {
  [ROLES.BERATER]: 'Berater',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.IT_SUPPORT]: 'IT-Support',
};

export function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return Object.values(ROLES).includes(role) ? role : ROLES.BERATER;
}

export function roleLabel(value) {
  return ROLE_LABELS[normalizeRole(value)];
}

/** Where a freshly signed-in user lands. IT Support has its own console instead of the portal. */
export function homePathFor(role) {
  return normalizeRole(role) === ROLES.IT_SUPPORT ? '/it-support' : '/dashboard';
}
