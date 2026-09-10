export function leadScopeOrDefault(scope) {
  return scope === 'regional' ? 'regional' : 'deutschlandweit';
}

export function poolForRequest(availableLeads, request) {
  const scope = leadScopeOrDefault(request?.scope);
  return (availableLeads || []).filter(
    (lead) => leadScopeOrDefault(lead.scope) === scope && lead.status !== 'erledigt' && !lead.refundedAt,
  );
}

export function beraterBusinessAddress(berater) {
  const business = berater?.profile?.businessAddress || {};
  const street = String(business.street || '').trim();
  const zip = String(business.zip || '').trim();
  const city = String(business.city || berater?.profile?.location || '').trim();
  if (!street && !zip && !city) return null;
  return { street, zip, city };
}

export function formatBeraterAddress(address) {
  if (!address) return '';
  const locality = [address.zip, address.city].filter(Boolean).join(' ');
  return [address.street, locality].filter(Boolean).join(', ');
}

export function leadsForRequest(requestLeads, requestId) {
  return (requestLeads || []).filter((lead) => lead.requestId === requestId && !lead.refundedAt);
}

export function beraterName(request) {
  return request?.berater?.fullName || request?.berater?.email || 'Unbekannt';
}

export function requestCode(request) {
  return request?.code || null;
}

export function packageKindLabel(scope) {
  return scope === 'regional' ? 'Regional' : 'Exklusiv';
}

export function progressPercent(request) {
  if (!request?.requestedCount) return 0;
  return Math.min(100, Math.round((request.validCount / request.requestedCount) * 100));
}

export function progressCopy(request) {
  if (request?.status === 'completed') return 'Alle Leads zugestellt';
  if (request?.status === 'cancelled') return 'Belieferung pausiert';
  if (request?.refundedCount > 0 && request?.remaining > 0) {
    return `${request.refundedCount} erstattet · Ersatz offen`;
  }
  if (request?.validCount > 0) return 'Leads werden zugestellt';
  return 'Wartet auf Zustellung';
}

export function isUnseenRequest(request) {
  return request?.status === 'active' && !request?.adminSeenAt;
}

export function requestWorkflowStep(request) {
  if (!request) return 0;
  if (request.status === 'completed') return 3;
  if (request.status === 'cancelled') return 1;
  if (request.validCount > 0) return 2;
  return 1;
}
