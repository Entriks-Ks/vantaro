export const BROKER_SETTINGS_KEY = 'vantaro.brokerSettings';
export const BROKER_SETTINGS_EVENT = 'vantaro:broker-settings';

export const DEFAULT_BROKER_SETTINGS = {
  toastAlerts: true,
  browserAlerts: false,
  emailReminders: true,
  googleCalendar: true,
  terminAlerts: true,
  wiedervorlageAlerts: true,
};

export function normalizeBrokerSettings(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    toastAlerts: src.toastAlerts !== false,
    browserAlerts: src.browserAlerts === true,
    emailReminders: src.emailReminders !== false,
    googleCalendar: src.googleCalendar !== false,
    terminAlerts: src.terminAlerts !== false,
    wiedervorlageAlerts: src.wiedervorlageAlerts !== false,
  };
}

export function eventAlertsEnabled(prefs, kind) {
  const settings = normalizeBrokerSettings(prefs);
  if (kind === 'termin') return settings.terminAlerts;
  if (kind === 'wiedervorlage') return settings.wiedervorlageAlerts;
  return true;
}

export function readBrokerSettings() {
  try {
    const raw = localStorage.getItem(BROKER_SETTINGS_KEY);
    return normalizeBrokerSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_BROKER_SETTINGS };
  }
}

export function writeBrokerSettings(partial) {
  const next = normalizeBrokerSettings({ ...readBrokerSettings(), ...partial });
  try {
    localStorage.setItem(BROKER_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BROKER_SETTINGS_EVENT, { detail: next }));
  }
  return next;
}

export function subscribeBrokerSettings(listener) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event) => {
    if (event.key === BROKER_SETTINGS_KEY) listener(readBrokerSettings());
  };
  const onCustom = (event) => listener(normalizeBrokerSettings(event.detail));
  window.addEventListener('storage', onStorage);
  window.addEventListener(BROKER_SETTINGS_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(BROKER_SETTINGS_EVENT, onCustom);
  };
}
