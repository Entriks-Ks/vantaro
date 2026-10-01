/** Bundesland lookup for territory matching. Keep in sync with server/src/lib/germanRegions.js. */

const BW = 'Baden-Württemberg';
const BY = 'Bayern';
const BE = 'Berlin';
const BB = 'Brandenburg';
const HB = 'Bremen';
const HH = 'Hamburg';
const HE = 'Hessen';
const MV = 'Mecklenburg-Vorpommern';
const NI = 'Niedersachsen';
const NW = 'Nordrhein-Westfalen';
const RP = 'Rheinland-Pfalz';
const SL = 'Saarland';
const SN = 'Sachsen';
const ST = 'Sachsen-Anhalt';
const SH = 'Schleswig-Holstein';
const TH = 'Thüringen';

export const GERMAN_STATES = [BW, BY, BE, BB, HB, HH, HE, MV, NI, NW, RP, SL, SN, ST, SH, TH];

/** Dominant Bundesland per two-digit PLZ region. */
const ZIP_REGION_STATES = {
  '01': SN, '02': SN, '03': BB, '04': SN, '06': ST, '07': TH, '08': SN, '09': SN,
  10: BE, 12: BE, 13: BE, 14: BB, 15: BB, 16: BB, 17: MV, 18: MV, 19: MV,
  20: HH, 21: NI, 22: HH, 23: SH, 24: SH, 25: SH, 26: NI, 27: NI, 28: HB, 29: NI,
  30: NI, 31: NI, 32: NW, 33: NW, 34: HE, 35: HE, 36: HE, 37: NI, 38: NI, 39: ST,
  40: NW, 41: NW, 42: NW, 44: NW, 45: NW, 46: NW, 47: NW, 48: NW, 49: NI,
  50: NW, 51: NW, 52: NW, 53: NW, 54: RP, 55: RP, 56: RP, 57: NW, 58: NW, 59: NW,
  60: HE, 61: HE, 63: HE, 64: HE, 65: HE, 66: SL, 67: RP, 68: BW, 69: BW,
  70: BW, 71: BW, 72: BW, 73: BW, 74: BW, 75: BW, 76: BW, 77: BW, 78: BW, 79: BW,
  80: BY, 81: BY, 82: BY, 83: BY, 84: BY, 85: BY, 86: BY, 87: BY, 88: BW, 89: BW,
  90: BY, 91: BY, 92: BY, 93: BY, 94: BY, 95: BY, 96: BY, 97: BY, 98: TH, 99: TH,
};

const CITY_STATES = {
  berlin: BE,
  hamburg: HH,
  bremen: HB, bremerhaven: HB,
  münchen: BY, nürnberg: BY, augsburg: BY, regensburg: BY, ingolstadt: BY, würzburg: BY, fürth: BY,
  erlangen: BY, bamberg: BY, bayreuth: BY, landshut: BY, passau: BY, rosenheim: BY, kempten: BY,
  aschaffenburg: BY, schweinfurt: BY,
  stuttgart: BW, karlsruhe: BW, mannheim: BW, freiburg: BW, 'freiburg im breisgau': BW, heidelberg: BW,
  ulm: BW, heilbronn: BW, pforzheim: BW, reutlingen: BW, esslingen: BW, tübingen: BW, konstanz: BW,
  ludwigsburg: BW, 'baden-baden': BW,
  köln: NW, düsseldorf: NW, dortmund: NW, essen: NW, duisburg: NW, bochum: NW, wuppertal: NW,
  bielefeld: NW, bonn: NW, münster: NW, mönchengladbach: NW, gelsenkirchen: NW, aachen: NW, krefeld: NW,
  oberhausen: NW, hagen: NW, hamm: NW, 'mülheim an der ruhr': NW, leverkusen: NW, solingen: NW,
  herne: NW, neuss: NW, paderborn: NW, bottrop: NW, recklinghausen: NW, remscheid: NW, siegen: NW,
  gütersloh: NW, moers: NW, 'bergisch gladbach': NW,
  'frankfurt am main': HE, frankfurt: HE, wiesbaden: HE, kassel: HE, darmstadt: HE, offenbach: HE,
  'offenbach am main': HE, gießen: HE, marburg: HE, fulda: HE, hanau: HE,
  hannover: NI, braunschweig: NI, oldenburg: NI, osnabrück: NI, wolfsburg: NI, göttingen: NI,
  salzgitter: NI, hildesheim: NI, lüneburg: NI, celle: NI, wilhelmshaven: NI,
  leipzig: SN, dresden: SN, chemnitz: SN, zwickau: SN, plauen: SN, görlitz: SN,
  magdeburg: ST, halle: ST, 'halle (saale)': ST, dessau: ST, 'dessau-roßlau': ST,
  erfurt: TH, jena: TH, gera: TH, weimar: TH,
  potsdam: BB, cottbus: BB, 'brandenburg an der havel': BB, 'frankfurt (oder)': BB,
  rostock: MV, schwerin: MV, neubrandenburg: MV, stralsund: MV, greifswald: MV, wismar: MV,
  kiel: SH, lübeck: SH, flensburg: SH, neumünster: SH,
  mainz: RP, ludwigshafen: RP, 'ludwigshafen am rhein': RP, koblenz: RP, trier: RP,
  kaiserslautern: RP, worms: RP,
  saarbrücken: SL, neunkirchen: SL, homburg: SL,
};

const CITY_NAMES = Object.keys(CITY_STATES).sort((left, right) => right.length - left.length);

function containsWord(text, word) {
  if (!word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\d])${escaped}($|[^\\p{L}\\d])`, 'u').test(text);
}

export function normalizeState(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (text === 'nrw') return NW;
  return GERMAN_STATES.find((state) => state.toLowerCase() === text) || '';
}

export function stateForZip(zip) {
  const digits = String(zip || '').replace(/\D/g, '');
  return digits.length >= 2 ? ZIP_REGION_STATES[digits.slice(0, 2)] || '' : '';
}

export function stateForCity(city) {
  return CITY_STATES[String(city || '').trim().toLowerCase()] || '';
}

/** Bundesland named or implied by a territory text such as "Kaiserstraße 110, 10785 Köln". */
export function territoryState(territory) {
  const text = String(territory || '').trim().toLowerCase();
  if (!text) return '';
  const named = GERMAN_STATES.find((state) => containsWord(text, state.toLowerCase()));
  if (named) return named;
  if (containsWord(text, 'nrw')) return NW;
  const afterZip = text.match(/(?<!\d)\d{5}(?!\d)\s+([^,]+)/);
  const cityAfterZip = afterZip ? stateForCity(afterZip[1]) : '';
  if (cityAfterZip) return cityAfterZip;
  const city = CITY_NAMES.find((name) => containsWord(text, name));
  if (city) return CITY_STATES[city];
  const zip = text.match(/(?<!\d)\d{5}(?!\d)/);
  return zip ? stateForZip(zip[0]) : '';
}

export function leadState(lead) {
  return normalizeState(lead?.state) || stateForCity(lead?.city) || stateForZip(lead?.zip);
}
