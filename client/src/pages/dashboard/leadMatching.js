import { formatDistance } from './leads';

const DAY_MS = 24 * 60 * 60 * 1000;

export const MATCH_TIERS = [
  { id: 'green', label: 'Beste Wahl' },
  { id: 'orange', label: 'Passend' },
  { id: 'red', label: 'Nicht ideal' },
];

export function matchTierLabel(tier) {
  return MATCH_TIERS.find((entry) => entry.id === tier)?.label || '';
}

export function isAppointmentRequest(request) {
  return String(request?.leadType || '').includes('APPOINTMENT');
}

function filled(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value != null && String(value).trim() !== '';
}

function daysLabel(days) {
  if (days <= 0) return 'heute';
  return days === 1 ? '1 Tag' : `${days} Tagen`;
}

function scoreDistance(lead) {
  const km = Number(lead?.distanceKm);
  if (lead?.distanceKm == null || lead?.distanceKm === '' || !Number.isFinite(km)) {
    return { points: 18, reason: 'Entfernung unbekannt' };
  }
  const reason = `${formatDistance(km)} entfernt`;
  if (km < 10) return { points: 45, reason };
  if (km < 25) return { points: 32, reason };
  if (km < 50) return { points: 18, reason };
  return { points: 6, reason };
}

function scoreFreshness(lead, now) {
  const created = lead?.createdAt ? new Date(lead.createdAt).getTime() : NaN;
  if (!Number.isFinite(created)) return { points: 8, reason: '' };
  const days = Math.max(0, Math.floor((now - created) / DAY_MS));
  const reason = days === 0 ? 'Heute eingegangen' : `Vor ${daysLabel(days)} eingegangen`;
  if (days < 3) return { points: 20, reason };
  if (days < 14) return { points: 14, reason };
  if (days < 30) return { points: 8, reason };
  return { points: 3, reason };
}

function scoreCompleteness(lead) {
  const base = [lead?.phone, lead?.email, lead?.zip || lead?.city];
  const extra = lead?.vertical === 'energy'
    ? [lead.ownerStatus, lead.annualConsumption, lead.timeframe, lead.callSummary]
    : [lead?.dateOfBirth, lead?.employmentStatus, lead?.insuranceStatus];
  const fields = [...base, ...extra];
  const count = fields.filter(filled).length;
  const points = Math.round((count / fields.length) * 20);
  const reason = count === fields.length
    ? 'Daten vollständig'
    : `${fields.length - count} Angabe${fields.length - count === 1 ? '' : 'n'} fehlt`;
  return { points, reason };
}

function scoreTiming(lead, request, now) {
  if (isAppointmentRequest(request)) {
    const at = lead?.appointmentAt ? new Date(lead.appointmentAt).getTime() : NaN;
    if (!Number.isFinite(at)) return { points: 4, reason: 'Kein Termin hinterlegt' };
    const diff = at - now;
    if (diff < 0) return { points: 0, reason: 'Termin liegt in der Vergangenheit', forceRed: true };
    if (diff < DAY_MS) return { points: 5, reason: 'Termin in weniger als 24 Std.' };
    return { points: 15, reason: `Termin in ${daysLabel(Math.floor(diff / DAY_MS))}` };
  }
  if (!lead?.status || lead.status === 'neu') return { points: 15, reason: 'Neu' };
  if (lead.status === 'wiedervorlage') return { points: 8, reason: 'Wiedervorlage' };
  return { points: 5, reason: 'Bereits bearbeitet' };
}

function tierForScore(score) {
  if (score >= 75) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

export function scoreLeadForRequest(lead, request, now = Date.now()) {
  const parts = [
    scoreDistance(lead),
    scoreFreshness(lead, now),
    scoreCompleteness(lead),
    scoreTiming(lead, request, now),
  ];
  const score = Math.min(100, parts.reduce((sum, part) => sum + part.points, 0));
  const tier = parts.some((part) => part.forceRed) ? 'red' : tierForScore(score);
  return {
    score,
    tier,
    reasons: parts.map((part) => part.reason).filter(Boolean),
  };
}

export function pickBestLeads(pool, request, now = Date.now()) {
  const needed = Math.max(0, Number(request?.remaining) || 0);
  const available = (pool || []).length;
  if (!needed || available < needed) {
    return { ok: false, available, needed };
  }
  const tierRank = { green: 0, orange: 1, red: 2 };
  const picks = pool
    .map((lead) => ({ lead, ...scoreLeadForRequest(lead, request, now) }))
    .sort((a, b) => (tierRank[a.tier] - tierRank[b.tier]) || (b.score - a.score))
    .slice(0, needed);
  return { ok: true, available, needed, picks };
}
