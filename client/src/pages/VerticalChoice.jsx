import { useState } from 'react';
import { VERTICALS } from '../lib/vertical';
import { useAuth } from '../hooks/useAuth';
import { L } from '../lib/i18n';

export default function VerticalChoice() {
  const { setVertical } = useAuth();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (selected !== 'insurance' && selected !== 'energy') {
      setError(L('Bitte wählen Sie Versicherung oder Energie.', 'Please choose insurance or energy.'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await setVertical(selected);
    } catch (err) {
      setError(err.message || L('Der Bereich konnte nicht gespeichert werden.', 'The line of business could not be saved.'));
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
          <h1 className="auth-title">{L('Bereich wählen', 'Choose your line of business')}</h1>
          <p className="auth-subtitle">
            {L('Dieses Konto hat noch keinen Bereich. Die Auswahl gilt für das Portal und kann danach nicht gewechselt werden.', 'This account does not have a line of business yet. Your choice applies to the portal and cannot be changed afterwards.')}
          </p>
          {error ? <div className="auth-error">{error}</div> : null}
          <form className="auth-form" onSubmit={handleSubmit}>
            <fieldset className="vertical-choice">
              <legend>
                {L('Bereich', 'Line of business')} <span className="auth-required">*</span>
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
              {submitting ? L('Wird gespeichert…', 'Saving…') : L('Weiter zum Portal', 'Continue to portal')}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
