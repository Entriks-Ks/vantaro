/**
 * Language of the IT Support console only (English by default, German optional).
 * The rest of VANTARO stays German and never reads this.
 *
 * Usage: L('Deutsch', 'English'). Changing the language remounts the console, so every text —
 * including module-level label maps resolved at render time — switches at once.
 */

const STORAGE_KEY = 'vantaro.itSupport.lang';
export const LANGS = ['en', 'de'];

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(value) ? value : 'en';
  } catch {
    return 'en';
  }
}

let current = readStored();

export function getLang() {
  return current;
}

export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : 'en';
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    /* private mode: language still applies for this visit */
  }
  return current;
}

export function L(de, en) {
  return current === 'en' ? en : de;
}

/** Resolve a [German, English] pair (or return plain strings unchanged). */
export function pick(value) {
  return Array.isArray(value) ? L(value[0], value[1]) : value;
}

export function locale() {
  return current === 'en' ? 'en-GB' : 'de-DE';
}
