export const PRODUCT_FILTERS = [
  { id: 'all', label: 'Alle Produkte' },
  { id: 'PKV', label: 'Private Krankenversicherung' },
  { id: 'bAV', label: 'Betriebliche Altersvorsorge' },
  { id: 'BU', label: 'Berufsunfähigkeit' },
];

export const LEAD_STATUSES = [
  { id: 'neu', label: 'Neu', hint: 'Noch nicht kontaktiert' },
  { id: 'kontaktiert', label: 'Kontaktiert', hint: 'Erster Kontakt erfolgt' },
  { id: 'termin', label: 'Termin', hint: 'Gespräch geplant' },
  { id: 'wiedervorlage', label: 'Wiedervorlage', hint: 'Später erneut kontaktieren' },
  { id: 'abgeschlossen', label: 'Abgeschlossen', hint: 'Vorgang beendet' },
];

export const VIEW_MODES = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list', label: 'Liste' },
];

const STATUS_IDS = new Set(LEAD_STATUSES.map((status) => status.id));

export function formatDistance(km) {
  if (km == null || km === '') return '';
  return `${String(km).replace('.', ',')} km`;
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
  const stored = statuses[String(lead?.id || '')];
  if (stored && STATUS_IDS.has(stored)) return stored;
  return defaultPipelineStatus(lead?.status);
}

export function leadProductCode(lead) {
  const insurance = Array.isArray(lead?.insuranceStatus) ? lead.insuranceStatus : [];
  const haystack = [
    ...(Array.isArray(lead?.mainConcerns) ? lead.mainConcerns : []),
    lead?.notes,
    lead?.currentInsurer,
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
  if (lead?.priceCents != null && lead.priceCents !== '') return Number(lead.priceCents) || 0;
  if (lead?.monthlyPremium == null || lead.monthlyPremium === '') return 0;
  return Math.round(Number(lead.monthlyPremium) * 100) || 0;
}
