import { L } from './i18n';

export const LEAD_SCOPE_OPTIONS = [
  { id: 'deutschlandweit', label: L('Deutschlandweit', 'Nationwide') },
  { id: 'regional', label: L('Regional', 'Regional') },
];

export const DEFAULT_LEAD_SCOPE = 'deutschlandweit';

export function leadScopeLabel(id) {
  return LEAD_SCOPE_OPTIONS.find((option) => option.id === id)?.label || L('Deutschlandweit', 'Nationwide');
}
