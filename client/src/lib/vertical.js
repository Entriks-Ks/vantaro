import { leadState, territoryState } from './germanRegions';

export { territoryState } from './germanRegions';

export const VERTICALS = [
  {
    id: 'insurance',
    label: 'Versicherung',
    description: 'PKV, bAV und BU',
  },
  {
    id: 'energy',
    label: 'Energie',
    description: 'Photovoltaik und Wärmepumpe',
  },
];

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

export const ENERGY_DELIVERY_TYPES = [
  {
    id: 'lead',
    label: 'Lead',
    description: 'Qualifizierter Kontakt. Termin vereinbaren Sie selbst.',
  },
  {
    id: 'appointment',
    label: 'Termin',
    description: 'Fester Termin mit Datum und Uhrzeit.',
  },
];

/** Two buyable products on Meine Pakete (Lead oder Termin wählbar). */
export const ENERGY_PRODUCTS = [
  {
    id: 'photovoltaic',
    label: 'Photovoltaik',
    title: 'Photovoltaik-Paket',
    description: 'Ab 10 Stück, in 5er-Schritten. Lead oder Termin für Ihr Gebiet.',
    featured: true,
  },
  {
    id: 'heat_pump',
    label: 'Wärmepumpe',
    title: 'Wärmepumpen-Paket',
    description: 'Ab 10 Stück, in 5er-Schritten. Lead oder Termin für Ihr Gebiet.',
    featured: false,
  },
];

export const ENERGY_PACKAGES = [
  {
    id: 'PV_LEAD',
    product: 'photovoltaic',
    deliveryType: 'lead',
    label: 'Photovoltaik-Lead',
    description: 'Qualifizierter Kontakt. Die Firma vereinbart den nächsten Termin selbst.',
  },
  {
    id: 'PV_APPOINTMENT',
    product: 'photovoltaic',
    deliveryType: 'appointment',
    label: 'Photovoltaik-Termin',
    description: 'Fester Termin. Datum und Uhrzeit sind bereits vereinbart.',
  },
  {
    id: 'HP_LEAD',
    product: 'heat_pump',
    deliveryType: 'lead',
    label: 'Wärmepumpen-Lead',
    description: 'Qualifizierter Kontakt zu einer Wärmepumpe.',
  },
  {
    id: 'HP_APPOINTMENT',
    product: 'heat_pump',
    deliveryType: 'appointment',
    label: 'Wärmepumpen-Termin',
    description: 'Termin für Beratung oder Vor-Ort-Besuch.',
  },
];

export const EXISTING_PV_OPTIONS = [
  { id: 'yes', label: 'Ja' },
  { id: 'no', label: 'Nein' },
  { id: 'unknown', label: 'Unbekannt' },
];

const VERTICAL_ALIASES = {
  insurance: 'insurance',
  versicherung: 'insurance',
  energy: 'energy',
  energie: 'energy',
};

export function isVertical(id) {
  return VERTICALS.some((item) => item.id === id);
}

export function normalizeVertical(value) {
  const key = String(value || '').trim().toLowerCase();
  const id = VERTICAL_ALIASES[key] || '';
  return isVertical(id) ? id : '';
}

export function verticalOrInsurance(value) {
  return normalizeVertical(value) || 'insurance';
}

export function verticalLabel(value) {
  const id = verticalOrInsurance(value);
  return VERTICALS.find((item) => item.id === id)?.label || 'Versicherung';
}

export function energyProductById(id) {
  return ENERGY_PRODUCTS.find((item) => item.id === id) || null;
}

export function energyPackageById(id) {
  return ENERGY_PACKAGES.find((item) => item.id === id) || null;
}

export function energyPackageFor(productId, deliveryType = 'lead') {
  return ENERGY_PACKAGES.find(
    (item) => item.product === productId && item.deliveryType === deliveryType,
  ) || null;
}

/** Default Gebiet from Geschäftsadresse (PLZ + Ort). */
export function territoryFromBusinessAddress(address) {
  if (!address) return '';
  const zip = String(address.zip || '').trim();
  const city = String(address.city || '').trim();
  return [zip, city].filter(Boolean).join(' ');
}

export function energyLeadTypeOf(lead) {
  const product = lead?.energyProduct || lead?.energy_product || '';
  const delivery = lead?.deliveryType || lead?.delivery_type || '';
  if (product === 'photovoltaic' && delivery === 'lead') return 'PV_LEAD';
  if (product === 'photovoltaic' && delivery === 'appointment') return 'PV_APPOINTMENT';
  if (product === 'heat_pump' && delivery === 'lead') return 'HP_LEAD';
  if (product === 'heat_pump' && delivery === 'appointment') return 'HP_APPOINTMENT';
  return '';
}

export function isAppointmentExpired(lead, now = Date.now()) {
  const delivery = lead?.deliveryType || lead?.delivery_type || '';
  if (delivery !== 'appointment') return false;
  const at = new Date(lead?.appointmentAt || lead?.appointment_at || '').getTime();
  return Number.isFinite(at) && at < now;
}

export function energyTypeLabel(id) {
  return energyPackageById(id)?.label || id || '—';
}

export function deliveryBadge(lead) {
  const delivery = lead?.deliveryType || lead?.delivery_type;
  if (delivery === 'appointment') return 'TERMIN';
  if (delivery === 'lead') return 'LEAD';
  const type = energyLeadTypeOf(lead);
  if (type.endsWith('_APPOINTMENT')) return 'TERMIN';
  if (type.endsWith('_LEAD')) return 'LEAD';
  return '';
}

function containsWord(text, word) {
  if (!word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\d])${escaped}($|[^\\p{L}\\d])`, 'u').test(text);
}

/**
 * Territory may be a PLZ prefix ("10", strict), a place ("Berlin", "Bayern")
 * or a full address ("Kaiserstraße 110, 10785 Berlin"); places and addresses cover their whole Bundesland.
 * Keep in sync with server/src/lib/vertical.js.
 */
export function territoryMatches(territory, lead) {
  const raw = String(territory || '').trim();
  if (!raw) return true;
  const zip = String(lead?.zip || '').trim();
  const city = String(lead?.city || '').trim().toLowerCase();
  const state = String(lead?.state || '').trim().toLowerCase();
  const compact = raw.replace(/\s+/g, '');
  if (/^\d{2,5}$/.test(compact)) return zip.startsWith(compact);
  const text = raw.toLowerCase();
  const zips = text.match(/(?<!\d)\d{5}(?!\d)/g) || [];
  if (zip && zips.includes(zip)) return true;
  if (containsWord(text, city) || containsWord(text, state)) return true;
  const areaState = territoryState(raw);
  if (areaState && areaState === leadState(lead)) return true;
  return [zip.toLowerCase(), city, state].some((value) => value && value.includes(text));
}

export function energyOrderStatus(request) {
  if (request?.status === 'cancelled') return 'Storniert';
  if (request?.status === 'rejected') return 'Abgelehnt';
  if (request?.status === 'completed') return 'Vollständig geliefert';
  const delivered = Number(request?.validCount) || 0;
  const requested = Number(request?.requestedCount) || 0;
  if (delivered > 0 && delivered < requested) return 'Teilweise geliefert';
  return 'Offen';
}
