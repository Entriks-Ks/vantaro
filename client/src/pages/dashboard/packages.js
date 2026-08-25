export const MIN_LEAD_PACK = 10;

export const PACKAGES = [
  {
    id: 'pkv-deutschlandweit',
    label: 'PKV / deutschlandweit',
    title: 'Exklusive PKV-Chancen',
    description:
      'Mindestabnahme 10 Chancen. Passende Beratungsgespräche bundesweit — nicht möglichst viele Datensätze.',
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
      'Mindestabnahme 10 Chancen. Regionaler Fokus mit höherer Nähe und planbarer Kapazität vor Ort.',
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
