export const ROLES = {
  BERATER: 'berater',
  ADMIN: 'admin',
};

export const ROLE_LABELS = {
  [ROLES.BERATER]: 'Berater',
  [ROLES.ADMIN]: 'Admin',
};

export function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.BERATER;
}

export function roleLabel(value) {
  return ROLE_LABELS[normalizeRole(value)];
}
