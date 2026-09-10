/** ZIP / city proximity helpers for server-side auto-fill (no Maps dependency). */

export function zipProximityRank(lead, origin) {
  const cityLead = String(lead?.city || '').trim().toLowerCase();
  const cityOrigin = String(origin?.city || '').trim().toLowerCase();
  const zipLead = String(lead?.zip || '').replace(/\D/g, '');
  const zipOrigin = String(origin?.zip || '').replace(/\D/g, '');
  const sameCity = cityLead && cityOrigin && cityLead === cityOrigin ? 0 : 1;
  const samePrefix = zipLead.slice(0, 2) && zipLead.slice(0, 2) === zipOrigin.slice(0, 2) ? 0 : 1;
  const leadNum = Number(zipLead.slice(0, 5));
  const originNum = Number(zipOrigin.slice(0, 5));
  const delta = Number.isFinite(leadNum) && Number.isFinite(originNum)
    ? Math.abs(leadNum - originNum)
    : 99999;
  return sameCity * 1_000_000 + samePrefix * 100_000 + delta;
}

export function sortLeadsByZipProximity(leads, originAddress) {
  const list = Array.isArray(leads) ? [...leads] : [];
  if (!list.length || !originAddress) {
    return { leads: list, sorted: false, mode: null };
  }

  const ranked = list.map((lead) => ({
    lead,
    rank: zipProximityRank(lead, originAddress),
  }));
  ranked.sort((a, b) => a.rank - b.rank);
  return {
    leads: ranked.map((entry) => entry.lead),
    sorted: true,
    mode: 'zip',
  };
}

export function beraterBusinessAddress(berater) {
  const business = berater?.profile?.businessAddress || {};
  const street = String(business.street || '').trim();
  const zip = String(business.zip || '').trim();
  const city = String(business.city || berater?.profile?.location || '').trim();
  if (!street && !zip && !city) return null;
  return { street, zip, city };
}
