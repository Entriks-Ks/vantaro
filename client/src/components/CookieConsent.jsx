import { useEffect, useState } from 'react';
import { Cookie, Moon, Sun, X } from 'lucide-react';
import { applyConsent, CONSENT_STORAGE_KEY, DEFAULT_PREFS } from '../lib/analytics';
import {
  PUBLIC_THEME_EVENT,
  readPublicTheme,
  writePublicTheme,
} from '../lib/theme';
import { L } from '../lib/i18n';

function readConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConsent(prefs) {
  const payload = {
    ...prefs,
    necessary: true,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  applyConsent(payload);
  window.dispatchEvent(new CustomEvent('vantaro:consent', { detail: payload }));
  return payload;
}

function PublicThemeToggle() {
  const [theme, setTheme] = useState(readPublicTheme);

  useEffect(() => {
    const onChange = (event) => {
      const next = event.detail?.theme;
      if (next === 'light' || next === 'dark') setTheme(next);
    };
    window.addEventListener(PUBLIC_THEME_EVENT, onChange);
    return () => window.removeEventListener(PUBLIC_THEME_EVENT, onChange);
  }, []);

  const isLight = theme === 'light';
  const Icon = isLight ? Sun : Moon;

  return (
    <button
      type="button"
      className={`theme-launcher${isLight ? ' is-light' : ''}`}
      aria-pressed={isLight}
      aria-label={isLight ? L('Hellmodus aktiv. Auf Dunkel umschalten.', 'Light mode active. Switch to dark.') : L('Dunkelmodus aktiv. Auf Hell umschalten.', 'Dark mode active. Switch to light.')}
      onClick={() => {
        const next = isLight ? 'dark' : 'light';
        writePublicTheme(next);
        setTheme(next);
      }}
    >
      <Icon size={16} strokeWidth={2.2} />
      <span>{isLight ? L('Hell', 'Light') : L('Dunkel', 'Dark')}</span>
    </button>
  );
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [hasChoice, setHasChoice] = useState(true);

  useEffect(() => {
    const applySaved = () => {
      const saved = readConsent();
      if (!saved) {
        setHasChoice(false);
        setOpen(true);
        return;
      }
      setHasChoice(true);
      setPrefs({
        necessary: true,
        analytics: Boolean(saved.analytics),
        marketing: Boolean(saved.marketing),
      });
    };

    const onOpen = () => {
      const current = readConsent();
      if (current) {
        setPrefs({
          necessary: true,
          analytics: Boolean(current.analytics),
          marketing: Boolean(current.marketing),
        });
      }
      setOpen(true);
    };

    const waiting =
      document.documentElement.classList.contains('is-preloading') &&
      document.getElementById('preloader')?.dataset.settled !== 'true';

    if (waiting) {
      window.addEventListener('vantaro:app-ready', applySaved, { once: true });
    } else {
      applySaved();
    }

    window.addEventListener('vantaro:cookies', onOpen);
    return () => {
      window.removeEventListener('vantaro:app-ready', applySaved);
      window.removeEventListener('vantaro:cookies', onOpen);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('cookie-open', open);
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape' && hasChoice) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('cookie-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [open, hasChoice]);

  const close = (nextPrefs) => {
    saveConsent(nextPrefs);
    setPrefs(nextPrefs);
    setHasChoice(true);
    setOpen(false);
  };

  const dismiss = () => {
    if (!hasChoice) return;
    setOpen(false);
  };

  const togglePanel = () => {
    if (open) {
      dismiss();
      return;
    }
    const current = readConsent();
    if (current) {
      setPrefs({
        necessary: true,
        analytics: Boolean(current.analytics),
        marketing: Boolean(current.marketing),
      });
    }
    setOpen(true);
  };

  return (
    <>
      <div className="edge-tools">
        <button
          type="button"
          className={`cookie-launcher${open ? ' is-open' : ''}${!hasChoice ? ' is-pending' : ''}`}
          aria-expanded={open}
          aria-controls="cookie-consent-panel"
          onClick={togglePanel}
        >
          <Cookie size={16} strokeWidth={2.2} />
          <span>Cookies</span>
        </button>
        <PublicThemeToggle />
      </div>

      {open && (
        <div className="cookie-overlay" onClick={dismiss}>
          <div
            id="cookie-consent-panel"
            className="cookie-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-consent-title"
            aria-describedby="cookie-consent-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cookie-modal-head">
              <div className="cookie-modal-mark" aria-hidden="true">
                <Cookie size={20} strokeWidth={2.2} />
              </div>
              <div>
                <p className="cookie-modal-kicker">{L('Datenschutz', 'Privacy')}</p>
                <strong id="cookie-consent-title">{L('Cookie-Einstellungen', 'Cookie settings')}</strong>
              </div>
              {hasChoice && (
                <button
                  type="button"
                  className="cookie-modal-close"
                  onClick={dismiss}
                  aria-label={L('Schließen', 'Close')}
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              )}
            </div>

            <p id="cookie-consent-text" className="cookie-modal-text">
              {L('Notwendige Cookies halten die Seite funktionsfähig. Statistik und Marketing setzen wir nur mit Ihrer Einwilligung.', 'Necessary cookies keep the site working. We only use statistics and marketing cookies with your consent.')}{' '}
              <a href="#datenschutz">{L('Datenschutzhinweise', 'Privacy policy')}</a>
            </p>

            <div className="cookie-prefs">
              <div className="cookie-pref is-locked">
                <span>
                  <b>{L('Notwendig', 'Necessary')}</b>
                  <small>{L('Technisch erforderlich, z. B. für Ihre Auswahl.', 'Technically required, e.g. for your choice.')}</small>
                </span>
                <span className="cookie-pref-state">{L('Immer aktiv', 'Always active')}</span>
              </div>
              <label className="cookie-pref">
                <span>
                  <b>{L('Statistik', 'Statistics')}</b>
                  <small>{L('Google Analytics — nur mit Einwilligung, Messung der Seitennutzung.', 'Google Analytics — only with consent, measures site usage.')}</small>
                </span>
                <span className="cookie-switch">
                  <input
                    type="checkbox"
                    checked={prefs.analytics}
                    onChange={(e) => setPrefs((prev) => ({ ...prev, analytics: e.target.checked }))}
                  />
                  <i />
                </span>
              </label>
              <label className="cookie-pref">
                <span>
                  <b>Marketing</b>
                  <small>{L('Für relevantere Inhalte und Angebote.', 'For more relevant content and offers.')}</small>
                </span>
                <span className="cookie-switch">
                  <input
                    type="checkbox"
                    checked={prefs.marketing}
                    onChange={(e) => setPrefs((prev) => ({ ...prev, marketing: e.target.checked }))}
                  />
                  <i />
                </span>
              </label>
            </div>

            <div className="cookie-modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => close({ ...DEFAULT_PREFS, analytics: true, marketing: true })}
              >
                {L('Alle akzeptieren', 'Accept all')}
              </button>
              <button type="button" className="btn btn-outline-light" onClick={() => close(DEFAULT_PREFS)}>
                {L('Nur notwendige', 'Necessary only')}
              </button>
              <button type="button" className="cookie-save" onClick={() => close(prefs)}>
                {L('Auswahl speichern', 'Save selection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
