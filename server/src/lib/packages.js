import { energyLeadTypeOf, verticalOrInsurance } from './vertical.js';

export const MIN_LEAD_PACK = 10;
export const LEAD_PACK_STEP = 5;

/** Net price per energy lead or appointment (Photovoltaik and Wärmepumpe). */
export const ENERGY_UNIT_CENTS = 11900;

export const PACKAGES = [
  {
    id: 'pkv-deutschlandweit',
    label: 'PKV / deutschlandweit',
    title: 'Exklusive PKV-Chancen',
    packCents: 11900,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'PKV',
  },
  {
    id: 'pkv-regional',
    label: 'PKV / regional',
    title: 'Regionale PKV-Chancen',
    packCents: 14900,
    minLeads: MIN_LEAD_PACK,
    scope: 'regional',
    leadType: 'PKV',
  },
  {
    id: 'PV_LEAD',
    label: 'Photovoltaik-Lead',
    title: 'Photovoltaik-Paket',
    packCents: ENERGY_UNIT_CENTS,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'PV_LEAD',
    vertical: 'energy',
  },
  {
    id: 'PV_APPOINTMENT',
    label: 'Photovoltaik-Termin',
    title: 'Photovoltaik-Paket',
    packCents: ENERGY_UNIT_CENTS,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'PV_APPOINTMENT',
    vertical: 'energy',
  },
  {
    id: 'HP_LEAD',
    label: 'Wärmepumpen-Lead',
    title: 'Wärmepumpen-Paket',
    packCents: ENERGY_UNIT_CENTS,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'HP_LEAD',
    vertical: 'energy',
  },
  {
    id: 'HP_APPOINTMENT',
    label: 'Wärmepumpen-Termin',
    title: 'Wärmepumpen-Paket',
    packCents: ENERGY_UNIT_CENTS,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'HP_APPOINTMENT',
    vertical: 'energy',
  },
];

export function packageById(id) {
  return PACKAGES.find((pkg) => pkg.id === id) || null;
}

export function packTotalCents(pkg, count = MIN_LEAD_PACK) {
  if (!pkg) return 0;
  return (pkg.packCents || 0) * count;
}

export function leadPurchaseCents(lead) {
  if (lead?.priceCents != null && lead.priceCents !== '') {
    const explicit = Number(lead.priceCents);
    if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  }
  if (verticalOrInsurance(lead?.vertical) === 'energy') {
    const energyPkg = packageById(energyLeadTypeOf(lead));
    if (energyPkg) return energyPkg.packCents || ENERGY_UNIT_CENTS;
  }
  const scope = lead?.scope === 'regional' ? 'regional' : 'deutschlandweit';
  const pkg = PACKAGES.find((item) => item.scope === scope && !item.vertical);
  return pkg?.packCents || 11900;
}
