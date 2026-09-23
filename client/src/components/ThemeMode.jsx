import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { readThemePreference, subscribeTheme, writeThemePreference } from '../lib/theme';

const OPTIONS = [
  {
    id: 'dark',
    label: 'Dunkel',
    hint: 'Der aktuelle Look der Plattform.',
    icon: Moon,
  },
  {
    id: 'light',
    label: 'Hell',
    hint: 'Helles Papier mit derselben Farbwelt.',
    icon: Sun,
  },
  {
    id: 'device',
    label: 'Gerät',
    hint: 'Folgt der Einstellung von Browser oder Gerät.',
    icon: Monitor,
  },
];

export default function ThemeMode({ variant = 'broker' }) {
  const { updateProfile } = useAuth();
  const [preference, setPreference] = useState(readThemePreference);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeTheme((detail) => {
    if (detail?.preference) setPreference(detail.preference);
  }), []);

  async function choose(next) {
    if (next === preference || saving) return;
    writeThemePreference(next);
    setPreference(next);
    setError('');
    setSaving(true);
    try {
      await updateProfile({ settings: { appearance: next } });
    } catch (err) {
      setError(err.message || 'Der Modus konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  const options = (
    <div className="theme-mode-options" role="radiogroup" aria-label="Modus">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = preference === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={`theme-mode-option${active ? ' is-active' : ''}`}
            role="radio"
            aria-checked={active}
            disabled={saving}
            onClick={() => choose(option.id)}
          >
            <span className="theme-mode-option__label">
              <Icon size={16} strokeWidth={2.2} aria-hidden="true" />
              <strong>{option.label}</strong>
            </span>
            <small>{option.hint}</small>
          </button>
        );
      })}
    </div>
  );

  if (variant === 'nav') {
    return (
      <div className="broker-profile-nav__theme">
        <span className="broker-profile-nav__theme-label">Darstellung</span>
        <div className="broker-profile-nav__modes" role="radiogroup" aria-label="Darstellung">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = preference === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={active ? 'is-active' : undefined}
                role="radio"
                aria-checked={active}
                disabled={saving}
                title={option.hint}
                onClick={() => choose(option.id)}
              >
                <Icon size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        {error ? <p className="broker-profile-nav__theme-error">{error}</p> : null}
      </div>
    );
  }

  if (variant === 'dash') {
    return (
      <section className="dash-profile-section theme-mode">
        <header>
          <h3>
            <span className="dash-profile-section__icon" aria-hidden="true">
              <Sun size={16} strokeWidth={2.2} />
            </span>
            Darstellung
          </h3>
          <p>Dunkel, Hell oder die Einstellung Ihres Geräts. Der Wechsel gilt sofort für die ganze Plattform.</p>
        </header>
        {error ? <div className="dash-alert">{error}</div> : null}
        {options}
      </section>
    );
  }

  return (
    <section className="broker-settings-section theme-mode" id="darstellung">
      <header>
        <h3>
          <span className="broker-settings-section__icon" aria-hidden="true">
            <Sun size={16} strokeWidth={2.2} />
          </span>
          Darstellung
        </h3>
        <p>Dunkel, Hell oder die Einstellung Ihres Geräts. Der Wechsel gilt sofort für die ganze Plattform.</p>
      </header>
      {error ? <div className="broker-alert">{error}</div> : null}
      {options}
    </section>
  );
}
