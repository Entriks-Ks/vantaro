export const MIN_LEAD_PACK = 10;
export const LEAD_PACK_STEP = 5;

/**
 * TEMP — ProCredit integration testing.
 * Set to null to restore production pricing (packCents × lead count).
 * Production: deutschlandweit single 12900 / pack 11900, regional single 15900 / pack 14900.
 */
export const TEST_PACKAGE_PRICE_CENTS = 100; // 1,00 €

export const PACKAGES = [
  {
    id: 'pkv-deutschlandweit',
    label: 'PKV / deutschlandweit',
    title: 'Exklusive PKV-Chancen',
    description:
      'Mindestabnahme 10 Leads — in 5er-Schritten erweiterbar (10, 15, 20, …). Bundesweite PKV-Chancen.',
    // Production: singleCents 12900, packCents 11900
    singleCents: TEST_PACKAGE_PRICE_CENTS ?? 12900,
    packCents: TEST_PACKAGE_PRICE_CENTS ?? 11900,
    minLeads: MIN_LEAD_PACK,
    scope: 'deutschlandweit',
    featured: true,
  },
  {
    id: 'pkv-regional',
    label: 'PKV / regional',
    title: 'Regionale PKV-Chancen',
    description:
      'Mindestabnahme 10 Leads — in 5er-Schritten erweiterbar (10, 15, 20, …). Regionaler Fokus mit Nähe vor Ort.',
    // Production: singleCents 15900, packCents 14900
    singleCents: TEST_PACKAGE_PRICE_CENTS ?? 15900,
    packCents: TEST_PACKAGE_PRICE_CENTS ?? 14900,
    minLeads: MIN_LEAD_PACK,
    scope: 'regional',
    featured: false,
  },
];

export function packageById(id) {
  return PACKAGES.find((pkg) => pkg.id === id) || null;
}

export function packTotalCents(pkg, count = MIN_LEAD_PACK) {
  if (!pkg) return 0;
  // Flat 1 € checkout while ProCredit is in test; restore: (pkg.packCents || pkg.singleCents) * count
  if (TEST_PACKAGE_PRICE_CENTS != null) return TEST_PACKAGE_PRICE_CENTS;
  return (pkg.packCents || pkg.singleCents) * count;
}

export function leadPurchaseCents(lead) {
  if (lead?.priceCents != null && lead.priceCents !== '') {
    const explicit = Number(lead.priceCents);
    if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  }
  const scope = lead?.scope === 'regional' ? 'regional' : 'deutschlandweit';
  const pkg = PACKAGES.find((item) => item.scope === scope);
  return pkg?.packCents || TEST_PACKAGE_PRICE_CENTS || 11900;
}
