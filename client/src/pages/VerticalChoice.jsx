import { useState } from 'react';
import { VERTICALS } from '../lib/vertical';
import { useAuth } from '../hooks/useAuth';

export default function VerticalChoice() {
  const { setVertical } = useAuth();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (selected !== 'insurance' && selected !== 'energy') {
      setError('Bitte wählen Sie Versicherung oder Energie.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await setVertical(selected);
    } catch (err) {
      setError(err.message || 'Der Bereich konnte nicht gespeichert werden.');
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page" id="inhalt">
      <div className="auth-layout wrap">
        <div className="auth-form-container">
          <div className="auth-logo">
            <img className="brand-mark" src="/favicon.svg" alt="" width={48} height={48} />
          </div>
          <h1 className="auth-title">Bereich wählen</h1>
          <p className="auth-subtitle">
            Dieses Konto hat noch keinen Bereich. Die Auswahl gilt für das Portal und kann danach nicht gewechselt werden.
          </p>
          {error ? <div className="auth-error">{error}</div> : null}
          <form className="auth-form" onSubmit={handleSubmit}>
            <fieldset className="vertical-choice">
              <legend>
                Bereich <span className="auth-required">*</span>
              </legend>
              {VERTICALS.map((option) => {
                const active = selected === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={active ? 'is-active' : undefined}
                    disabled={submitting}
                    onClick={() => setSelected(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                );
              })}
            </fieldset>
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Wird gespeichert…' : 'Weiter zum Portal'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
