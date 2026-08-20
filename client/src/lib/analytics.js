export const GA_ID = 'G-Q63XEK9EGN';
export const CONSENT_STORAGE_KEY = 'vantaro-cookie-consent';

/** EEA + UK — Consent Mode v2 region scope (ISO 3166-2) */
export const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'IS', 'LI', 'NO', 'GB',
];

export const DEFAULT_PREFS = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export function readStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw), necessary: true } : null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(prefs = readStoredConsent()) {
  return Boolean(prefs?.analytics);
}

function getPagePath() {
  const hash = window.location.hash || '#top';
  return `${window.location.pathname}${hash}`;
}

/** Consent Mode v2 — maps banner prefs to gtag consent types */
export function consentStateFromPrefs(prefs = DEFAULT_PREFS) {
  const analytics = Boolean(prefs.analytics);
  const marketing = Boolean(prefs.marketing);

  return {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  };
}

export function trackPageView(pagePath = getPagePath()) {
  if (!hasAnalyticsConsent() || typeof window.gtag !== 'function') return;

  window.gtag('config', GA_ID, {
    page_path: pagePath,
    page_title: document.title,
  });
}

/** Call immediately when the user confirms — before any navigation or reload */
export function applyConsent(prefs = DEFAULT_PREFS) {
  if (typeof window.gtag !== 'function') return;

  window.gtag('consent', 'update', consentStateFromPrefs(prefs));

  if (prefs.analytics) {
    trackPageView();
  }
}

export function grantAllConsent() {
  applyConsent({ ...DEFAULT_PREFS, analytics: true, marketing: true });
}

export function denyOptionalConsent() {
  applyConsent(DEFAULT_PREFS);
}
