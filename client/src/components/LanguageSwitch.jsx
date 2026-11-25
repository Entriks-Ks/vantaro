import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { L, LANGS, setLang, useLang } from '../lib/i18n';

const LABELS = { de: 'DE', en: 'EN' };
const NAMES = { de: 'Deutsch', en: 'English' };

/** DE | EN toggle. Logged-in users also get the choice saved to their account (used for e-mails and invoices). */
export default function LanguageSwitch({ className = '' }) {
  const lang = useLang();
  const { user, updateProfile } = useAuth();

  const [busy, setBusy] = useState(false);

  async function choose(next) {
    if (next === lang || busy) return;
    setBusy(true);
    if (user && updateProfile) {
      // Save before the page reloads; never block the switch for more than a moment.
      await Promise.race([
        updateProfile({ settings: { language: next } }).catch(() => {}),
        new Promise((resolve) => { window.setTimeout(resolve, 2500); }),
      ]);
    }
    setLang(next);
  }

  return (
    <div
      className={`lang-switch${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={L('Sprache', 'Language')}
    >
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={lang === code}
          lang={code}
          title={NAMES[code]}
          disabled={busy}
          className={`lang-switch__option${lang === code ? ' is-active' : ''}`}
          onClick={() => choose(code)}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
