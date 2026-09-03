export const MIN_LEAD_PACK = 10;

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
  const scope = lead?.scope === 'regional' ? 'regional' : 'deutschlandweit';
  const pkg = PACKAGES.find((item) => item.scope === scope);
  return pkg?.packCents || 11900;
}
