import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Bitte E-Mail-Adresse eingeben');
      return;
    }

    setSubmitting(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page" id="inhalt">
      <div className="auth-layout wrap">
        <div className="auth-form-container">
          <div className="auth-logo">
            <img
              className="brand-mark"
              src="/favicon.svg"
              alt=""
              width={48}
              height={48}
            />
          </div>

          <h1 className="auth-title">Passwort zurücksetzen</h1>
          <p className="auth-subtitle">Wir senden Ihnen einen Link per E-Mail.</p>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">E-Mail-Adresse <span className="auth-required">*</span></label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail-Adresse"
                required
                disabled={submitting}
              />
            </div>

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Wird gesendet…' : 'Link senden'}
            </button>
          </form>

          <div className="auth-footer">
            <span>Zurück zur</span>
            <Link to="/login">Anmeldung</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
