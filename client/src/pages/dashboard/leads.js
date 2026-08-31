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
  { id: 'abgeschlossen', label: 'Abgeschlossen', hint: 'Vorgang beendet' },
  { id: 'wiedervorlage', label: 'Wiedervorlage', hint: 'Rückruf geplant' },
];

export const LEAD_REPORT_REASONS = [
  {
    id: 'invalid-phone',
    label: 'Telefonnummer ungültig',
    description: 'Die Nummer ist falsch, unvollständig oder dauerhaft nicht erreichbar.',
  },
  {
    id: 'wrong-person',
    label: 'Falsche Person / Kontaktdaten',
    description: 'Name, Adresse oder Kontakt gehören zu einer anderen Person.',
  },
  {
    id: 'duplicate',
    label: 'Doppelte Übermittlung',
    description: 'Derselbe Lead wurde bereits zuvor an Sie oder einen anderen Berater übermittelt.',
  },
  {
    id: 'wrong-details',
    label: 'Falsche Angaben',
    description: 'Berufliche Situation oder Versicherungsstatus weichen wesentlich von den Agentendaten ab.',
  },
  {
    id: 'missing-fields',
    label: 'Pflichtangaben fehlen',
    description: 'Wesentliche Informationen fehlen, sodass eine sinnvolle Beratung nicht möglich ist.',
  },
  {
    id: 'exclusivity',
    label: 'Exklusivität / Sperrliste',
    description: 'Kontakt verstößt gegen Exklusivitätsregeln oder steht auf einer Sperrliste.',
  },
  {
    id: 'technical',
    label: 'Technischer Fehler',
    description: 'Daten wurden durch einen Übertragungs- oder Systemfehler beschädigt.',
  },
];

/** @deprecated use LEAD_REPORT_REASONS */
export const CANCELLATION_REASONS = LEAD_REPORT_REASONS;

/** Days after handover during which a lead can be reported. */
export const LEAD_REPORT_WINDOW_DAYS = 14;

/** Minimum characters required in the free-text justification. */
export const LEAD_REPORT_DETAIL_MIN = 30;

export const LEAD_REPORT_STATUSES = [
  { id: 'in_pruefung', label: 'In Prüfung', hint: 'Vantaro prüft Ihren Fall.' },
  { id: 'gutgeschrieben', label: 'Gutgeschrieben', hint: 'Vollständige Gutschrift auf Ihr Guthaben.' },
  { id: 'teilweise', label: 'Teilweise gutgeschrieben', hint: 'Teilgutschrift wurde verbucht.' },
  { id: 'abgelehnt', label: 'Abgelehnt', hint: 'Der Fall erfüllt die Richtlinien nicht.' },
  { id: 'infos_noetig', label: 'Weitere Infos nötig', hint: 'Bitte Nachweise nachreichen.' },
];

export const VIEW_MODES = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list', label: 'Liste' },
];

export const OCCUPATION_SITUATIONS = [
  { id: 'selbststaendig', label: 'Hauptberuflich selbstständig' },
  { id: 'angestellt', label: 'Zusätzlich angestellt' },
  { id: 'sonstiges', label: 'Sonstiges' },
];

export const INSURANCE_STATUSES = [
  { id: 'gkv', label: 'GKV' },
  { id: 'pkv', label: 'PKV-Vollversicherung' },
  { id: 'zusatz', label: 'Zusatzversicherung' },
  { id: 'unbekannt', label: 'Unbekannt' },
];

export const PERSON_GROUPS = [
  { id: 'allein', label: 'Allein versichert' },
  { id: 'partner', label: 'Partner' },
  { id: 'kinder', label: 'Kinder' },
  { id: 'familie', label: 'Familie' },
];

export const MAIN_CONCERNS = [
  { id: 'beitrag', label: 'Beitrag' },
  { id: 'leistungen', label: 'Leistungen' },
  { id: 'krankentagegeld', label: 'Krankentagegeld' },
  { id: 'check', label: 'Allgemeiner Check' },
];

export const LEADS = [
  {
    id: 1,
    name: 'Sophie Müller',
    dateOfBirth: '1988-07-22',
    address: 'Invalidenstraße 12, 10115 Berlin',
    zip: '10115',
    city: 'Berlin',
    product: 'PKV',
    type: 'Private Krankenversicherung',
    packageId: 'pkv-deutschlandweit',
    quality: 'Q2',
    phone: '+49 170 1234567',
    email: 'sophie.mueller@example.com',
    distanceKm: 1.8,
    priceCents: 12900,
    note: 'Hat diese Woche ein Gespräch angefragt.',
    occupation: 'Selbstständig',
    occupationSituation: 'selbststaendig',
    occupationOther: '',
    insuranceStatus: 'gkv',
    insuranceCompany: 'Techniker Krankenkasse',
    monthlyPremiumEuro: 420,
    personGroup: 'allein',
    mainConcern: 'beitrag',
    pin: { x: 320, y: 255 },
  },
  {
    id: 2,
    name: 'Daniel Weber',
    dateOfBirth: '1975-11-03',
    address: 'Kopernikusstraße 44, 10245 Berlin',
    zip: '10245',
    city: 'Berlin',
    product: 'bAV',
    type: 'Betriebliche Altersvorsorge',
    packageId: 'pkv-regional',
    quality: 'Q2',
    phone: '+49 171 2345678',
    email: 'daniel.weber@example.com',
    distanceKm: 3.2,
    priceCents: 14900,
    note: 'Interessiert an Arbeitgeber-Rente.',
    occupation: 'HR / Arbeitgeberkontakt',
    occupationSituation: 'sonstiges',
    occupationOther: 'HR / Arbeitgeberkontakt',
    insuranceStatus: 'gkv',
    insuranceCompany: 'Barmer',
    monthlyPremiumEuro: 380,
    personGroup: 'familie',
    mainConcern: 'leistungen',
    pin: { x: 445, y: 240 },
  },
  {
    id: 3,
    name: 'Laura Schmidt',
    dateOfBirth: '1992-04-18',
    address: 'Warschauer Straße 8, 10243 Berlin',
    zip: '10243',
    city: 'Berlin',
    product: 'PKV',
    type: 'Private Krankenversicherung',
    packageId: 'pkv-deutschlandweit',
    quality: 'Q1',
    phone: '+49 172 3456789',
    email: 'laura.schmidt@example.com',
    distanceKm: 4.5,
    priceCents: 12900,
    note: 'Möchte ein Erstgespräch.',
    occupation: 'Angestellte',
    occupationSituation: 'angestellt',
    occupationOther: '',
    insuranceStatus: 'pkv',
    insuranceCompany: 'Debeka',
    monthlyPremiumEuro: 520,
    personGroup: 'partner',
    mainConcern: 'check',
    pin: { x: 492, y: 345 },
  },
  {
    id: 4,
    name: 'Markus Klein',
    dateOfBirth: '1980-09-30',
    address: 'Sonnenallee 91, 12045 Berlin',
    zip: '12045',
    city: 'Berlin',
    product: 'BU',
    type: 'Berufsunfähigkeitsversicherung',
    packageId: 'pkv-regional',
    quality: 'Q2',
    phone: '+49 173 4567890',
    email: 'markus.klein@example.com',
    distanceKm: 6.1,
    priceCents: 11900,
    note: 'Rückruf nach 17:00 gewünscht.',
    occupation: 'Selbstständig',
    occupationSituation: 'selbststaendig',
    occupationOther: '',
    insuranceStatus: 'gkv',
    insuranceCompany: 'AOK Berlin',
    monthlyPremiumEuro: 395,
    personGroup: 'kinder',
    mainConcern: 'krankentagegeld',
    pin: { x: 270, y: 370 },
  },
  {
    id: 5,
    name: 'Julia Fischer',
    dateOfBirth: '1995-01-12',
    address: 'Prenzlauer Allee 35, 10405 Berlin',
    zip: '10405',
    city: 'Berlin',
    product: 'PKV',
    type: 'Private Krankenversicherung',
    packageId: 'pkv-deutschlandweit',
    quality: 'Q2',
    phone: '+49 174 5678901',
    email: 'julia.fischer@example.com',
    distanceKm: 7.4,
    priceCents: 12900,
    note: 'Kontakt und Gespräch bestätigt.',
    occupation: 'Angestellte',
    occupationSituation: 'angestellt',
    occupationOther: '',
    insuranceStatus: 'zusatz',
    insuranceCompany: 'Signal Iduna',
    monthlyPremiumEuro: 85,
    personGroup: 'allein',
    mainConcern: 'leistungen',
    pin: { x: 397, y: 183 },
  },
  {
    id: 6,
    name: 'Thomas Becker',
    dateOfBirth: '1978-06-25',
    address: 'Bergmannstraße 20, 10961 Berlin',
    zip: '10961',
    city: 'Berlin',
    product: 'bAV',
    type: 'Betriebliche Altersvorsorge',
    packageId: 'pkv-regional',
    quality: 'Q3',
    phone: '+49 175 6789012',
    email: 'thomas.becker@example.com',
    distanceKm: 8.2,
    priceCents: 14900,
    note: 'Arbeitgeberkontakt vorhanden.',
    occupation: 'Geschäftsführer',
    occupationSituation: 'selbststaendig',
    occupationOther: '',
    insuranceStatus: 'pkv',
    insuranceCompany: 'Allianz Private Krankenversicherung',
    monthlyPremiumEuro: 610,
    personGroup: 'familie',
    mainConcern: 'beitrag',
    pin: { x: 348, y: 430 },
  },
  {
    id: 7,
    name: 'Anna Hoffmann',
    dateOfBirth: '1990-12-08',
    address: 'Hauptstraße 17, 10827 Berlin',
    zip: '10827',
    city: 'Berlin',
    product: 'PKV',
    type: 'Private Krankenversicherung',
    packageId: 'pkv-deutschlandweit',
    quality: 'Q1',
    phone: '+49 176 7890123',
    email: 'anna.hoffmann@example.com',
    distanceKm: 9.0,
    priceCents: 12900,
    note: 'Möchte Optionen vergleichen.',
    occupation: 'Selbstständig',
    occupationSituation: 'selbststaendig',
    occupationOther: '',
    insuranceStatus: 'unbekannt',
    insuranceCompany: '',
    monthlyPremiumEuro: null,
    personGroup: 'partner',
    mainConcern: 'check',
    pin: { x: 250, y: 210 },
  },
  {
    id: 8,
    name: 'Peter Wagner',
    dateOfBirth: '1983-02-14',
    address: 'Kantstraße 68, 10627 Berlin',
    zip: '10627',
    city: 'Berlin',
    product: 'BU',
    type: 'Berufsunfähigkeitsversicherung',
    packageId: 'pkv-regional',
    quality: 'Q2',
    phone: '+49 177 8901234',
    email: 'peter.wagner@example.com',
    distanceKm: 9.7,
    priceCents: 11900,
    note: 'Information telefonisch angefragt.',
    occupation: 'Angestellter',
    occupationSituation: 'angestellt',
    occupationOther: '',
    insuranceStatus: 'gkv',
    insuranceCompany: 'DAK-Gesundheit',
    monthlyPremiumEuro: 365,
    personGroup: 'allein',
    mainConcern: 'krankentagegeld',
    pin: { x: 210, y: 300 },
  },
];

export function formatDistance(km) {
  return `${String(km).replace('.', ',')} km`;
}

export function leadById(id) {
  const numeric = Number(id);
  return LEADS.find((lead) => lead.id === numeric) || null;
}

export function statusLabel(statusId) {
  return LEAD_STATUSES.find((status) => status.id === statusId)?.label || 'Neu';
}

function optionLabel(options, id) {
  return options.find((option) => option.id === id)?.label || '—';
}

export function occupationSituationLabel(id) {
  return optionLabel(OCCUPATION_SITUATIONS, id);
}

export function insuranceStatusLabel(id) {
  return optionLabel(INSURANCE_STATUSES, id);
}

export function personGroupLabel(id) {
  return optionLabel(PERSON_GROUPS, id);
}

export function mainConcernLabel(id) {
  return optionLabel(MAIN_CONCERNS, id);
}

export function reportReasonLabel(id) {
  return optionLabel(LEAD_REPORT_REASONS, id);
}

export function reportReasonDescription(id) {
  return LEAD_REPORT_REASONS.find((reason) => reason.id === id)?.description || '';
}

export function reportStatusMeta(statusId) {
  return LEAD_REPORT_STATUSES.find((status) => status.id === statusId)
    || LEAD_REPORT_STATUSES[0];
}

export function reportStatusLabel(statusId) {
  return reportStatusMeta(statusId).label;
}

/** Demo/fallback: treat “now − daysOffset” as handover if lead has no deliveredAt. */
export function leadDeliveredAt(lead, daysOffset = 2) {
  if (lead?.deliveredAt) return lead.deliveredAt;
  const at = new Date();
  at.setHours(10, 0, 0, 0);
  at.setDate(at.getDate() - daysOffset);
  return at.toISOString();
}

export function getReportWindow(deliveredAt) {
  const start = new Date(deliveredAt || Date.now());
  if (Number.isNaN(start.getTime())) {
    return { open: false, daysLeft: 0, deadline: null, deliveredAt: null };
  }
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + LEAD_REPORT_WINDOW_DAYS);
  deadline.setHours(23, 59, 59, 999);
  const msLeft = deadline.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  return {
    open: msLeft > 0,
    daysLeft,
    deadline: deadline.toISOString(),
    deliveredAt: start.toISOString(),
  };
}

/** Demo decision heuristic — real API would replace this. */
export function decideReportOutcome(reasonId) {
  if (reasonId === 'duplicate' || reasonId === 'invalid-phone' || reasonId === 'technical') {
    return 'gutgeschrieben';
  }
  if (reasonId === 'exclusivity' || reasonId === 'wrong-person') {
    return 'teilweise';
  }
  if (reasonId === 'missing-fields') {
    return 'infos_noetig';
  }
  return 'in_pruefung';
}

export function formatFollowUpDateTime(date, time) {
  if (!date || !time) return '—';
  const formatted = new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T${time}:00`));
  return `${formatted} · ${time} Uhr`;
}

export function cancellationReasonLabel(id) {
  return reportReasonLabel(id);
}

export function formatOccupationSituation(lead) {
  const label = occupationSituationLabel(lead.occupationSituation);
  if (lead.occupationSituation === 'sonstiges' && lead.occupationOther) {
    return `${label}: ${lead.occupationOther}`;
  }
  return label;
}

export function formatMonthlyPremium(euro) {
  if (euro == null || Number.isNaN(Number(euro))) return '—';
  return `${new Intl.NumberFormat('de-DE').format(Number(euro))} € pro Monat`;
}

export function leadStreet(lead) {
  if (lead?.street) return lead.street;
  if (!lead?.address) return '—';
  if (lead.zip) {
    const suffix = `, ${lead.zip}`;
    const index = lead.address.indexOf(suffix);
    if (index > 0) return lead.address.slice(0, index);
  }
  return lead.address.replace(/,\s*\d{5}\s+.+$/, '') || lead.address;
}
