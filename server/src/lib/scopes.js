export const LEAD_SCOPES = ['deutschlandweit', 'regional'];
export const DEFAULT_LEAD_SCOPE = 'deutschlandweit';

const SCOPE_ALIASES = {
  deutschlandweit: 'deutschlandweit',
  bundesweit: 'deutschlandweit',
  nationwide: 'deutschlandweit',
  national: 'deutschlandweit',
  pkvdeutschlandweit: 'deutschlandweit',
  regional: 'regional',
  region: 'regional',
  pkvregional: 'regional',
};

export function normalizeLeadScope(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[^a-z]/g, '');
  return SCOPE_ALIASES[key] || '';
}

export function leadScopeOrDefault(value) {
  return normalizeLeadScope(value) || DEFAULT_LEAD_SCOPE;
}
