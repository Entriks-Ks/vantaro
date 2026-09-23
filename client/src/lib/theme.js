export const THEME_STORAGE_KEY = 'vantaro.theme';
export const THEME_EVENT = 'vantaro:theme';
export const PUBLIC_THEME_STORAGE_KEY = 'vantaro.publicTheme';
export const PUBLIC_THEME_EVENT = 'vantaro:public-theme';

export const THEME_OPTIONS = ['dark', 'light', 'device'];

export function normalizeAppearance(value) {
  return THEME_OPTIONS.includes(value) ? value : 'dark';
}

export function readThemePreference() {
  try {
    return normalizeAppearance(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'dark';
  }
}

export function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveTheme(preference) {
  const pref = normalizeAppearance(preference);
  return pref === 'device' ? systemTheme() : pref;
}

const AUTH_STORAGE_KEY = 'vantaro-auth';

let themeAudience = 'pending';

function currentPath(pathname = window.location.pathname) {
  return String(pathname || '/').replace(/\/+$/, '') || '/';
}

export function isDashboardPath(pathname = window.location.pathname) {
  const path = currentPath(pathname);
  return path === '/dashboard' || path.startsWith('/dashboard/');
}

export function readPublicTheme() {
  try {
    return localStorage.getItem(PUBLIC_THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function isStoredAdmin() {
  return storedRole() === 'admin';
}

function storedRole() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    return String(session?.user?.role || '').toLowerCase();
  } catch {
    return '';
  }
}

export function setThemeAudience(audience) {
  themeAudience = audience === 'admin' || audience === 'app' ? audience : 'pending';
}

function forceDarkTheme() {
  if (themeAudience === 'admin') return true;
  return themeAudience === 'pending' && storedRole() === 'admin';
}

export function applyTheme(preference) {
  const pref = normalizeAppearance(preference);
  const resolved = forceDarkTheme()
    ? 'dark'
    : (isDashboardPath() ? resolveTheme(pref) : readPublicTheme());
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', resolved === 'light' ? '#f4f6f1' : '#070b14');

  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute('content', resolved);

  return { preference: pref, resolved };
}

export function writePublicTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(PUBLIC_THEME_STORAGE_KEY, next);
  } catch {
    /* ignore quota / private mode */
  }
  const applied = applyTheme(readThemePreference());
  window.dispatchEvent(new CustomEvent(PUBLIC_THEME_EVENT, { detail: { theme: next, resolved: applied.resolved } }));
  return applied;
}

export function writeThemePreference(preference) {
  const pref = normalizeAppearance(preference);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore quota / private mode */
  }
  const applied = applyTheme(pref);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: applied }));
  return applied;
}

export function subscribeTheme(listener) {
  if (typeof window === 'undefined') return () => {};

  const onCustom = (event) => listener(event.detail);
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const onMedia = () => {
    if (readThemePreference() !== 'device') return;
    const applied = applyTheme('device');
    listener(applied);
  };

  window.addEventListener(THEME_EVENT, onCustom);
  media.addEventListener('change', onMedia);
  return () => {
    window.removeEventListener(THEME_EVENT, onCustom);
    media.removeEventListener('change', onMedia);
  };
}
