import { leadPurchaseCents } from './packages';
import { L } from '../../lib/i18n';

export const PRODUCT_FILTERS = [
  { id: 'all', label: L('Alle', 'All') },
  { id: 'PKV', label: 'PKV' },
  { id: 'bAV', label: 'bAV' },
  { id: 'BU', label: 'BU' },
];

export const LEAD_STATUSES = [
  { id: 'neu', label: L('Neu', 'New'), hint: L('Noch nicht kontaktiert', 'Not contacted yet') },
  { id: 'kontaktiert', label: L('Kontaktiert', 'Contacted'), hint: L('Erster Kontakt erfolgt', 'First contact made') },
  { id: 'termin', label: L('Termin', 'Appointment'), hint: L('Gespräch geplant', 'Meeting scheduled') },
  { id: 'wiedervorlage', label: L('Wiedervorlage', 'Follow-up'), hint: L('Später erneut kontaktieren', 'Contact again later') },
  { id: 'abgeschlossen', label: L('Abgeschlossen', 'Closed'), hint: L('Kunde gewonnen oder nicht', 'Customer won or not') },
];

export const CLOSE_OUTCOMES = [
  { id: 'erfolgreich', label: L('Erfolgreich', 'Successful'), hint: L('Aus dem Gespräch wurde ein Kunde', 'The meeting turned into a customer') },
  { id: 'fehlgeschlagen', label: L('Nicht erfolgreich', 'Not successful'), hint: L('Kein Abschluss nach dem Gespräch', 'No deal after the meeting') },
];

const CLOSE_OUTCOME_IDS = new Set(CLOSE_OUTCOMES.map((item) => item.id));

export const VIEW_MODES = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list', label: L('Liste', 'List') },
];

const STATUS_IDS = new Set(LEAD_STATUSES.map((status) => status.id));

export function formatDistance(km) {
  if (km == null || km === '') return '';
  const value = Number(km);
  if (!Number.isFinite(value)) return '';
  const rounded = value < 10 ? value.toFixed(1) : String(Math.round(value));
  return `${L(rounded.replace('.', ','), rounded)} km`;
}

export function statusLabel(statusId) {
  return LEAD_STATUSES.find((status) => status.id === statusId)?.label || L('Neu', 'New');
}

export function defaultPipelineStatus(apiStatus) {
  if (apiStatus === 'erledigt') return 'abgeschlossen';
  if (apiStatus === 'in_bearbeitung') return 'kontaktiert';
  return 'neu';
}

function isEnergyAppointment(lead) {
  const delivery = lead?.deliveryType || lead?.delivery_type || '';
  if (delivery === 'appointment') return true;
  const type = String(lead?.leadType || lead?.packageId || energyLeadTypeHint(lead) || '');
  return type.endsWith('_APPOINTMENT');
}

function energyLeadTypeHint(lead) {
  const product = lead?.energyProduct || lead?.energy_product || '';
  const delivery = lead?.deliveryType || lead?.delivery_type || '';
  if (product === 'photovoltaic' && delivery === 'appointment') return 'PV_APPOINTMENT';
  if (product === 'heat_pump' && delivery === 'appointment') return 'HP_APPOINTMENT';
  if (product === 'photovoltaic' && delivery === 'lead') return 'PV_LEAD';
  if (product === 'heat_pump' && delivery === 'lead') return 'HP_LEAD';
  return '';
}

export function pipelineStatusOf(lead, statuses = {}) {
  const fromLead = lead?.contactStatus;
  if (fromLead && STATUS_IDS.has(fromLead)) return fromLead;
  const stored = statuses[String(lead?.id || '')];
  if (stored && STATUS_IDS.has(stored)) return stored;
  // Bought/zugewiesene Termine landen direkt in der Termin-Spalte
  if (isEnergyAppointment(lead)) return 'termin';
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
  const energyType = energyLeadTypeHint(lead);
  if (energyType) return energyType;

  const explicit = String(lead?.leadType || lead?.productType || '').trim();
  if (explicit === 'PKV' || explicit === 'bAV' || explicit === 'BU') return explicit;
  if (['PV_LEAD', 'PV_APPOINTMENT', 'HP_LEAD', 'HP_APPOINTMENT'].includes(explicit)) return explicit;

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
