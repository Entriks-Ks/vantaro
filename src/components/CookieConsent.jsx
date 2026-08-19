import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { applyConsent, CONSENT_STORAGE_KEY, DEFAULT_PREFS } from '../lib/analytics';

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

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [hasChoice, setHasChoice] = useState(true);

  useEffect(() => {
    const saved = readConsent();
    if (!saved) {
      setHasChoice(false);
      setOpen(true);
    } else {
      setHasChoice(true);
      setPrefs({
        necessary: true,
        analytics: Boolean(saved.analytics),
        marketing: Boolean(saved.marketing),
      });
    }

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

    window.addEventListener('vantaro:cookies', onOpen);
    return () => window.removeEventListener('vantaro:cookies', onOpen);
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
                <p className="cookie-modal-kicker">Datenschutz</p>
                <strong id="cookie-consent-title">Cookie-Einstellungen</strong>
              </div>
              {hasChoice && (
                <button
                  type="button"
                  className="cookie-modal-close"
                  onClick={dismiss}
                  aria-label="Schließen"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              )}
            </div>

            <p id="cookie-consent-text" className="cookie-modal-text">
              Notwendige Cookies halten die Seite funktionsfähig. Statistik und Marketing
              setzen wir nur mit Ihrer Einwilligung.{' '}
              <a href="#datenschutz">Datenschutzhinweise</a>
            </p>

            <div className="cookie-prefs">
              <div className="cookie-pref is-locked">
                <span>
                  <b>Notwendig</b>
                  <small>Technisch erforderlich, z.&nbsp;B. für Ihre Auswahl.</small>
                </span>
                <span className="cookie-pref-state">Immer aktiv</span>
              </div>
              <label className="cookie-pref">
                <span>
                  <b>Statistik</b>
                  <small>Google Analytics — nur mit Einwilligung, Messung der Seitennutzung.</small>
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
                  <small>Für relevantere Inhalte und Angebote.</small>
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
                Alle akzeptieren
              </button>
              <button type="button" className="btn btn-outline-light" onClick={() => close(DEFAULT_PREFS)}>
                Nur notwendige
              </button>
              <button type="button" className="cookie-save" onClick={() => close(prefs)}>
                Auswahl speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
