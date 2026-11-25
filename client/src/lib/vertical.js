import { leadState, territoryState } from './germanRegions';
import { L } from './i18n';

export { territoryState } from './germanRegions';

export const VERTICALS = [
  {
    id: 'insurance',
    label: L('Versicherung', 'Insurance'),
    description: L('PKV, bAV und BU', 'Private health (PKV), occupational pension (bAV) and disability (BU)'),
  },
  {
    id: 'energy',
    label: L('Energie', 'Energy'),
    description: L('Photovoltaik und Wärmepumpe', 'Solar PV and heat pump'),
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
    description: L('Qualifizierter Kontakt. Termin vereinbaren Sie selbst.', 'Qualified contact. You arrange the appointment yourself.'),
  },
  {
    id: 'appointment',
    label: L('Termin', 'Appointment'),
    description: L('Fester Termin mit Datum und Uhrzeit.', 'Fixed appointment with date and time.'),
  },
];

/** Two buyable products on Meine Pakete (Lead oder Termin wählbar). */
export const ENERGY_PRODUCTS = [
  {
    id: 'photovoltaic',
    label: L('Photovoltaik', 'Solar PV'),
    title: L('Photovoltaik-Paket', 'Solar PV package'),
    description: L('Ab 10 Stück, in 5er-Schritten. Lead oder Termin für Ihr Gebiet.', 'From 10 units, in steps of 5. Lead or appointment for your area.'),
    featured: true,
  },
  {
    id: 'heat_pump',
    label: L('Wärmepumpe', 'Heat pump'),
    title: L('Wärmepumpen-Paket', 'Heat pump package'),
    description: L('Ab 10 Stück, in 5er-Schritten. Lead oder Termin für Ihr Gebiet.', 'From 10 units, in steps of 5. Lead or appointment for your area.'),
    featured: false,
  },
];

export const ENERGY_PACKAGES = [
  {
    id: 'PV_LEAD',
    product: 'photovoltaic',
    deliveryType: 'lead',
    label: L('Photovoltaik-Lead', 'Solar PV lead'),
    description: L('Qualifizierter Kontakt. Die Firma vereinbart den nächsten Termin selbst.', 'Qualified contact. The company arranges the next appointment itself.'),
  },
  {
    id: 'PV_APPOINTMENT',
    product: 'photovoltaic',
    deliveryType: 'appointment',
    label: L('Photovoltaik-Termin', 'Solar PV appointment'),
    description: L('Fester Termin. Datum und Uhrzeit sind bereits vereinbart.', 'Fixed appointment. Date and time are already arranged.'),
  },
  {
    id: 'HP_LEAD',
    product: 'heat_pump',
    deliveryType: 'lead',
    label: L('Wärmepumpen-Lead', 'Heat pump lead'),
    description: L('Qualifizierter Kontakt zu einer Wärmepumpe.', 'Qualified contact interested in a heat pump.'),
  },
  {
    id: 'HP_APPOINTMENT',
    product: 'heat_pump',
    deliveryType: 'appointment',
    label: L('Wärmepumpen-Termin', 'Heat pump appointment'),
    description: L('Termin für Beratung oder Vor-Ort-Besuch.', 'Appointment for a consultation or on-site visit.'),
  },
];

export const EXISTING_PV_OPTIONS = [
  { id: 'yes', label: L('Ja', 'Yes') },
  { id: 'no', label: L('Nein', 'No') },
  { id: 'unknown', label: L('Unbekannt', 'Unknown') },
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
  return VERTICALS.find((item) => item.id === id)?.label || L('Versicherung', 'Insurance');
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
  if (delivery === 'appointment') return L('TERMIN', 'APPOINTMENT');
  if (delivery === 'lead') return 'LEAD';
  const type = energyLeadTypeOf(lead);
  if (type.endsWith('_APPOINTMENT')) return L('TERMIN', 'APPOINTMENT');
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
  if (request?.status === 'cancelled') return L('Storniert', 'Cancelled');
  if (request?.status === 'rejected') return L('Abgelehnt', 'Rejected');
  if (request?.status === 'completed') return L('Vollständig geliefert', 'Fully delivered');
  const delivered = Number(request?.validCount) || 0;
  const requested = Number(request?.requestedCount) || 0;
  if (delivered > 0 && delivered < requested) return L('Teilweise geliefert', 'Partially delivered');
  return L('Offen', 'Open');
}
