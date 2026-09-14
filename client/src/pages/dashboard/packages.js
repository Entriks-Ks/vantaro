export const MIN_LEAD_PACK = 10;
export const LEAD_PACK_STEP = 5;

export const PACKAGES = [
  {
    id: 'pkv-deutschlandweit',
    label: 'PKV / deutschlandweit',
    title: 'Exklusive PKV-Chancen',
    description:
      'Mindestabnahme 10 Leads — in 5er-Schritten erweiterbar (10, 15, 20, …). Bundesweite PKV-Chancen.',
    singleCents: 12900,
    packCents: 11900,
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
    singleCents: 15900,
    packCents: 14900,
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
  return (pkg.packCents || pkg.singleCents) * count;
}

export function leadPurchaseCents(lead) {
  if (lead?.priceCents != null && lead.priceCents !== '') {
    const explicit = Number(lead.priceCents);
    if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  }
  const scope = lead?.scope === 'regional' ? 'regional' : 'deutschlandweit';
  const pkg = PACKAGES.find((item) => item.scope === scope);
  return pkg?.packCents || 11900;
}
