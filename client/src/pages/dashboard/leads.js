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
];

export const VIEW_MODES = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list', label: 'Liste' },
];

export const LEADS = [
  {
    id: 1,
    name: 'Sophie Müller',
    address: 'Invalidenstraße 12, 10115 Berlin',
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
    pin: { x: 320, y: 255 },
  },
  {
    id: 2,
    name: 'Daniel Weber',
    address: 'Kopernikusstraße 44, 10245 Berlin',
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
    pin: { x: 445, y: 240 },
  },
  {
    id: 3,
    name: 'Laura Schmidt',
    address: 'Warschauer Straße 8, 10243 Berlin',
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
    pin: { x: 492, y: 345 },
  },
  {
    id: 4,
    name: 'Markus Klein',
    address: 'Sonnenallee 91, 12045 Berlin',
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
    pin: { x: 270, y: 370 },
  },
  {
    id: 5,
    name: 'Julia Fischer',
    address: 'Prenzlauer Allee 35, 10405 Berlin',
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
    pin: { x: 397, y: 183 },
  },
  {
    id: 6,
    name: 'Thomas Becker',
    address: 'Bergmannstraße 20, 10961 Berlin',
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
    pin: { x: 348, y: 430 },
  },
  {
    id: 7,
    name: 'Anna Hoffmann',
    address: 'Hauptstraße 17, 10827 Berlin',
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
    pin: { x: 250, y: 210 },
  },
  {
    id: 8,
    name: 'Peter Wagner',
    address: 'Kantstraße 68, 10627 Berlin',
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
