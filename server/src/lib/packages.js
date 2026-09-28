import { energyLeadTypeOf, verticalOrInsurance } from './vertical.js';

export const MIN_LEAD_PACK = 10;
export const LEAD_PACK_STEP = 5;

/**
 * TEMP — ProCredit integration testing.
 * Set to null to restore production pricing (packCents × lead count).
 * Production packCents: deutschlandweit 11900, regional 14900.
 */
export const TEST_PACKAGE_PRICE_CENTS = 100; // 1,00 €

export const PACKAGES = [
  {
    id: 'pkv-deutschlandweit',
    label: 'PKV / deutschlandweit',
    title: 'Exklusive PKV-Chancen',
    // Production: 11900
    packCents: TEST_PACKAGE_PRICE_CENTS ?? 11900,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'PKV',
  },
  {
    id: 'pkv-regional',
    label: 'PKV / regional',
    title: 'Regionale PKV-Chancen',
    // Production: 14900
    packCents: TEST_PACKAGE_PRICE_CENTS ?? 14900,
    minLeads: MIN_LEAD_PACK,
    scope: 'regional',
    leadType: 'PKV',
  },
  {
    id: 'PV_LEAD',
    label: 'Photovoltaik-Lead',
    title: 'Photovoltaik-Paket',
    packCents: TEST_PACKAGE_PRICE_CENTS ?? 11900,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'PV_LEAD',
    vertical: 'energy',
  },
  {
    id: 'PV_APPOINTMENT',
    label: 'Photovoltaik-Termin',
    title: 'Photovoltaik-Paket',
    packCents: TEST_PACKAGE_PRICE_CENTS ?? 11900,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'PV_APPOINTMENT',
    vertical: 'energy',
  },
  {
    id: 'HP_LEAD',
    label: 'Wärmepumpen-Lead',
    title: 'Wärmepumpen-Paket',
    packCents: TEST_PACKAGE_PRICE_CENTS ?? 11900,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    leadType: 'HP_LEAD',
    vertical: 'energy',
  },
  {
    id: 'HP_APPOINTMENT',
    label: 'Wärmepumpen-Termin',
    title: 'Wärmepumpen-Paket',
    packCents: TEST_PACKAGE_PRICE_CENTS ?? 11900,
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
  // Flat 1 € checkout while ProCredit is in test; restore: (pkg.packCents || 0) * count
  if (TEST_PACKAGE_PRICE_CENTS != null) return TEST_PACKAGE_PRICE_CENTS;
  return (pkg.packCents || 0) * count;
}

export function leadPurchaseCents(lead) {
  if (lead?.priceCents != null && lead.priceCents !== '') {
    const explicit = Number(lead.priceCents);
    if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  }
  if (verticalOrInsurance(lead?.vertical) === 'energy') {
    const energyPkg = packageById(energyLeadTypeOf(lead));
    if (energyPkg) return energyPkg.packCents || TEST_PACKAGE_PRICE_CENTS || 11900;
  }
  const scope = lead?.scope === 'regional' ? 'regional' : 'deutschlandweit';
  const pkg = PACKAGES.find((item) => item.scope === scope && !item.vertical);
  return pkg?.packCents || TEST_PACKAGE_PRICE_CENTS || 11900;
}
