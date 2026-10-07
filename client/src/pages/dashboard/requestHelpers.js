import { energyLeadTypeOf, isAppointmentExpired, territoryMatches } from '../../lib/vertical';
import { scoreLeadForRequest } from './leadMatching';

export function leadScopeOrDefault(scope) {
  return scope === 'regional' ? 'regional' : 'deutschlandweit';
}

export function poolForRequest(availableLeads, request) {
  const scope = leadScopeOrDefault(request?.scope);
  const requestVertical = request?.vertical === 'energy' ? 'energy' : 'insurance';
  return (availableLeads || []).filter((lead) => {
    if ((lead?.vertical === 'energy' ? 'energy' : 'insurance') !== requestVertical) return false;
    if (lead.status === 'erledigt' || lead.refundedAt) return false;
    if (lead.assignedTo) return false;
    if (requestVertical === 'energy') {
      return energyLeadTypeOf(lead) === request.leadType
        && territoryMatches(request.territory, lead);
    }
    return leadScopeOrDefault(lead.scope) === scope;
  });
}

function fallbackReplacementPool(availableLeads, complaint) {
  const rejected = complaint?.lead;
  const vertical = rejected?.vertical === 'energy' || complaint?.request?.vertical === 'energy'
    ? 'energy'
    : 'insurance';
  const energyType = vertical === 'energy' ? energyLeadTypeOf(rejected) : '';
  const scope = leadScopeOrDefault(rejected?.scope || complaint?.request?.scope);
  return (availableLeads || []).filter((lead) => {
    if ((lead?.vertical === 'energy' ? 'energy' : 'insurance') !== vertical) return false;
    if (lead.status === 'erledigt' || lead.refundedAt || lead.assignedTo) return false;
    if (vertical === 'energy') {
      return !energyType || energyLeadTypeOf(lead) === energyType;
    }
    return leadScopeOrDefault(lead.scope) === scope;
  });
}

export function replacementMatchPasses(lead, request) {
  if (isAppointmentExpired(lead)) return false;
  if (!request) return true;
  return scoreLeadForRequest(lead, request).tier !== 'red';
}

/** Free pool entries that match the original Auftrag and are a viable Ersatz. */
export function poolForComplaintReplacement(availableLeads, complaint) {
  const request = complaint?.request;
  const matched = request
    ? poolForRequest(availableLeads, request)
    : fallbackReplacementPool(availableLeads, complaint);
  return matched.filter((lead) => replacementMatchPasses(lead, request));
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

export function requestAreaLabel(request) {
  if (request?.vertical === 'energy') return request.territory || 'Gebiet';
  return packageKindLabel(request?.scope);
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
