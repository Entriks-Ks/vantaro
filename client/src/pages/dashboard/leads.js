import { leadPurchaseCents } from './packages';

export const PRODUCT_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'PKV', label: 'PKV' },
  { id: 'bAV', label: 'bAV' },
  { id: 'BU', label: 'BU' },
];

export const LEAD_STATUSES = [
  { id: 'neu', label: 'Neu', hint: 'Noch nicht kontaktiert' },
  { id: 'kontaktiert', label: 'Kontaktiert', hint: 'Erster Kontakt erfolgt' },
  { id: 'termin', label: 'Termin', hint: 'Gespräch geplant' },
  { id: 'wiedervorlage', label: 'Wiedervorlage', hint: 'Später erneut kontaktieren' },
  { id: 'abgeschlossen', label: 'Abgeschlossen', hint: 'Kunde gewonnen oder nicht' },
];

export const CLOSE_OUTCOMES = [
  { id: 'erfolgreich', label: 'Erfolgreich', hint: 'Aus dem Gespräch wurde ein Kunde' },
  { id: 'fehlgeschlagen', label: 'Nicht erfolgreich', hint: 'Kein Abschluss nach dem Gespräch' },
];

const CLOSE_OUTCOME_IDS = new Set(CLOSE_OUTCOMES.map((item) => item.id));

export const VIEW_MODES = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list', label: 'Liste' },
];

const STATUS_IDS = new Set(LEAD_STATUSES.map((status) => status.id));

export function formatDistance(km) {
  if (km == null || km === '') return '';
  const value = Number(km);
  if (!Number.isFinite(value)) return '';
  const rounded = value < 10 ? value.toFixed(1) : String(Math.round(value));
  return `${rounded.replace('.', ',')} km`;
}

export function statusLabel(statusId) {
  return LEAD_STATUSES.find((status) => status.id === statusId)?.label || 'Neu';
}

export function defaultPipelineStatus(apiStatus) {
  if (apiStatus === 'erledigt') return 'abgeschlossen';
  if (apiStatus === 'in_bearbeitung') return 'kontaktiert';
  return 'neu';
}

export function pipelineStatusOf(lead, statuses = {}) {
  const fromLead = lead?.contactStatus;
  if (fromLead && STATUS_IDS.has(fromLead)) return fromLead;
  const stored = statuses[String(lead?.id || '')];
  if (stored && STATUS_IDS.has(stored)) return stored;
  return defaultPipelineStatus(lead?.status);
}

export function closeOutcomeOf(lead) {
  const value = lead?.closeOutcome;
  return CLOSE_OUTCOME_IDS.has(value) ? value : null;
}

export function closeOutcomeLabel(outcomeId) {
  return CLOSE_OUTCOMES.find((item) => item.id === outcomeId)?.label || '';
}

export function contactUpdatePayload(statusId, { followUpAt = null, appointmentAt = null, closeOutcome = null } = {}) {
  return {
    contactStatus: statusId,
    followUpAt: statusId === 'wiedervorlage' ? followUpAt || null : null,
    appointmentAt: statusId === 'termin' ? appointmentAt || null : null,
    closeOutcome: statusId === 'abgeschlossen' ? closeOutcome || null : null,
  };
}

export function leadProductCode(lead) {
  const explicit = String(lead?.leadType || lead?.productType || '').trim();
  if (explicit === 'PKV' || explicit === 'bAV' || explicit === 'BU') return explicit;

  const insurance = Array.isArray(lead?.insuranceStatus) ? lead.insuranceStatus : [];
  const haystack = [
    ...(Array.isArray(lead?.mainConcerns) ? lead.mainConcerns : []),
    lead?.notes,
    lead?.currentInsurer,
    lead?.product,
  ].join(' ').toLowerCase();

  if (/\bbav\b|betriebliche alters/.test(haystack)) return 'bAV';
  if (/\bbu\b|berufsunfähig/.test(haystack)) return 'BU';
  if (insurance.includes('pkv_voll') || insurance.includes('zusatz') || insurance.includes('gkv')) {
    return 'PKV';
  }
  return 'PKV';
}

export function leadQualityLabel(lead) {
  const coverage = Array.isArray(lead?.coverageCircle) ? lead.coverageCircle : [];
  if (coverage.includes('familie')) return 'Q1';
  if (coverage.includes('kinder') || coverage.includes('partner')) return 'Q2';
  return lead?.quality || 'Q2';
}

export function leadPriceCents(lead) {
  return leadPurchaseCents(lead);
}

export function shortLeadId(id) {
  const raw = String(id || '').replace(/-/g, '');
  if (!raw) return '—';
  return raw.slice(0, 8).toUpperCase();
}
