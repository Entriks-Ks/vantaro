export const PRODUCT_FILTERS = [
  { id: 'all', label: 'Alle Produkte' },
  { id: 'PKV', label: 'Private Krankenversicherung' },
  { id: 'bAV', label: 'Betriebliche Altersvorsorge' },
  { id: 'BU', label: 'Berufsunfähigkeit' },
];

export const LEADS = [
  { id: 1, name: 'Sophie Müller', address: 'Invalidenstraße 12, 10115 Berlin', product: 'PKV', type: 'Private Krankenversicherung', distanceKm: 1.8, priceCents: 12900, note: 'Hat diese Woche ein Gespräch angefragt.', pin: { x: 320, y: 255 } },
  { id: 2, name: 'Daniel Weber', address: 'Kopernikusstraße 44, 10245 Berlin', product: 'bAV', type: 'Betriebliche Altersvorsorge', distanceKm: 3.2, priceCents: 14900, note: 'Interessiert an Arbeitgeber-Rente.', pin: { x: 445, y: 240 } },
  { id: 3, name: 'Laura Schmidt', address: 'Warschauer Straße 8, 10243 Berlin', product: 'PKV', type: 'Private Krankenversicherung', distanceKm: 4.5, priceCents: 12900, note: 'Möchte ein Erstgespräch.', pin: { x: 492, y: 345 } },
  { id: 4, name: 'Markus Klein', address: 'Sonnenallee 91, 12045 Berlin', product: 'BU', type: 'Berufsunfähigkeitsversicherung', distanceKm: 6.1, priceCents: 11900, note: 'Rückruf nach 17:00 gewünscht.', pin: { x: 270, y: 370 } },
  { id: 5, name: 'Julia Fischer', address: 'Prenzlauer Allee 35, 10405 Berlin', product: 'PKV', type: 'Private Krankenversicherung', distanceKm: 7.4, priceCents: 12900, note: 'Kontakt und Gespräch bestätigt.', pin: { x: 397, y: 183 } },
  { id: 6, name: 'Thomas Becker', address: 'Bergmannstraße 20, 10961 Berlin', product: 'bAV', type: 'Betriebliche Altersvorsorge', distanceKm: 8.2, priceCents: 14900, note: 'Arbeitgeberkontakt vorhanden.', pin: { x: 348, y: 430 } },
  { id: 7, name: 'Anna Hoffmann', address: 'Hauptstraße 17, 10827 Berlin', product: 'PKV', type: 'Private Krankenversicherung', distanceKm: 9.0, priceCents: 12900, note: 'Möchte Optionen vergleichen.', pin: { x: 250, y: 210 } },
  { id: 8, name: 'Peter Wagner', address: 'Kantstraße 68, 10627 Berlin', product: 'BU', type: 'Berufsunfähigkeitsversicherung', distanceKm: 9.7, priceCents: 11900, note: 'Information telefonisch angefragt.', pin: { x: 210, y: 300 } },
];

export function formatDistance(km) {
  return `${String(km).replace('.', ',')} km`;
}

export function leadById(id) {
  return LEADS.find((lead) => lead.id === id) || null;
}
