/**
 * Language of the VANTARO website and customer portal: German (default market) or English.
 *
 * Usage: L('Deutsch', 'English'). Changing the language reloads the page, so L() may be used
 * anywhere, including module-level constants evaluated at import time.
 *
 * The IT Support console has its own, separate setting (pages/itSupport/i18n.js).
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'vantaro.lang';
export const LANGS = ['de', 'en'];

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function detectBrowser() {
  try {
    const list = navigator.languages?.length ? navigator.languages : [navigator.language];
    const first = String(list?.[0] || '').toLowerCase();
    if (!first) return 'de';
    return first.startsWith('de') ? 'de' : 'en';
  } catch {
    return 'de';
  }
}

let current = readStored() || detectBrowser();
const listeners = new Set();

function applyDocumentLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}
applyDocumentLang();

export function getLang() {
  return current;
}

/** True once the visitor picked a language themselves in this browser. */
export function hasStoredLang() {
  return readStored() !== null;
}

export function setLang(lang, { persist = true, reload = true } = {}) {
  const next = LANGS.includes(lang) ? lang : 'de';
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode: language still applies for this visit */
    }
  }
  if (next === current) return current;
  if (reload && typeof window !== 'undefined') {
    window.location.reload();
    return next;
  }
  current = next;
  applyDocumentLang();
  listeners.forEach((fn) => fn(current));
  return current;
}

export function subscribeLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLang() {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}

export function L(de, en) {
  return current === 'en' ? en : de;
}

/** Resolve a [German, English] pair (or return plain strings unchanged). */
export function pick(value) {
  return Array.isArray(value) ? L(value[0], value[1]) : value;
}

/** Locale for Intl / toLocaleString: 'de-DE' or 'en-GB' (EUR, day-month-year order). */
export function locale() {
  return current === 'en' ? 'en-GB' : 'de-DE';
}
