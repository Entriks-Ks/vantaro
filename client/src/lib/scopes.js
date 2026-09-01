export const LEAD_SCOPE_OPTIONS = [
  { id: 'deutschlandweit', label: 'Deutschlandweit' },
  { id: 'regional', label: 'Regional' },
];

export const DEFAULT_LEAD_SCOPE = 'deutschlandweit';

export function leadScopeLabel(id) {
  return LEAD_SCOPE_OPTIONS.find((option) => option.id === id)?.label || 'Deutschlandweit';
}
