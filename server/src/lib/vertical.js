export const VERTICALS = ['insurance', 'energy'];
export const DEFAULT_VERTICAL = 'insurance';

export const INSURANCE_LEAD_TYPES = ['PKV', 'bAV', 'BU'];
export const ENERGY_LEAD_TYPES = ['PV_LEAD', 'PV_APPOINTMENT', 'HP_LEAD', 'HP_APPOINTMENT'];

export const ENERGY_PRODUCTS = ['photovoltaic', 'heat_pump'];
export const ENERGY_DELIVERY_TYPES = ['lead', 'appointment'];
export const EXISTING_PV = ['yes', 'no', 'unknown'];

export const ENERGY_STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
];

const VERTICAL_ALIASES = {
  insurance: 'insurance',
  versicherung: 'insurance',
  energy: 'energy',
  energie: 'energy',
};

export function normalizeVertical(value) {
  const key = String(value || '').trim().toLowerCase();
  return VERTICAL_ALIASES[key] || '';
}

export function verticalOrInsurance(value) {
  return normalizeVertical(value) || DEFAULT_VERTICAL;
}

export function leadTypesFor(vertical) {
  return verticalOrInsurance(vertical) === 'energy' ? ENERGY_LEAD_TYPES : INSURANCE_LEAD_TYPES;
}

export function energyLeadTypeOf(lead) {
  const product = lead?.energy_product || lead?.energyProduct || '';
  const delivery = lead?.delivery_type || lead?.deliveryType || '';
  if (product === 'photovoltaic' && delivery === 'lead') return 'PV_LEAD';
  if (product === 'photovoltaic' && delivery === 'appointment') return 'PV_APPOINTMENT';
  if (product === 'heat_pump' && delivery === 'lead') return 'HP_LEAD';
  if (product === 'heat_pump' && delivery === 'appointment') return 'HP_APPOINTMENT';
  return '';
}

export function territoryMatches(territory, lead) {
  const raw = String(territory || '').trim();
  if (!raw) return true;
  const zip = String(lead?.zip || '').trim();
  const city = String(lead?.city || '').trim();
  const state = String(lead?.state || '').trim();
  const compact = raw.replace(/\s+/g, '');
  if (/^\d{2,5}$/.test(compact)) return zip.startsWith(compact);
  const needle = raw.toLowerCase();
  return [zip, city, state].some((value) => value.toLowerCase().includes(needle));
}

export function verticalColumnMissing(error) {
  const message = String(error?.message || error?.code || '');
  return /vertical/i.test(message)
    && (/column/i.test(message) || /schema cache/i.test(message) || error?.code === 'PGRST204' || error?.code === '42703');
}

export function energySchemaMissing(error) {
  const message = String(error?.message || error?.code || '');
  return /energy_product|delivery_type|house_number|desired_timeframe|territory|evidence_source|owner_status|existing_pv|heating_system|lead_type_check|lead_requests_lead_type/i.test(message)
    && (/column|check|schema cache|constraint/i.test(message) || error?.code === 'PGRST204' || error?.code === '42703' || error?.code === '23514');
}
