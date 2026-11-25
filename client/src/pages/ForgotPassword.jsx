import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { L } from '../lib/i18n';

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
      setError(L('Bitte E-Mail-Adresse eingeben', 'Please enter your email address'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message || L('Bitte öffnen Sie den Link in der E-Mail.', 'Please open the link in the email.'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page" id="inhalt">
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <clipPath id="auth-shape-clip" clipPathUnits="objectBoundingBox">
            <path d="M 0.40,0 
                     C 0.43,0 0.92,0 0.94,0 
                     C 0.98,0 1,0.02 1,0.06 
                     L 1,0.94 
                     C 1,0.98 0.98,1 0.94,1 
                     L 0.06,1 
                     C 0.02,1 0,0.98 0,0.94 
                     L 0,0.18 
                     C 0,0.14 0.02,0.12 0.06,0.12 
                     L 0.28,0.12 
                     C 0.33,0.12 0.35,0.08 0.36,0.04 
                     C 0.37,0.01 0.38,0 0.42,0 Z" />
          </clipPath>
        </defs>
      </svg>

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

          <h1 className="auth-title">{L('Passwort zurücksetzen', 'Reset password')}</h1>
          <p className="auth-subtitle">{L('Wir senden Ihnen einen Link per E-Mail.', 'We will send you a link by email.')}</p>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">{L('E-Mail-Adresse', 'Email address')} <span className="auth-required">*</span></label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={L('E-Mail-Adresse', 'Email address')}
                required
                disabled={submitting}
              />
            </div>

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? L('Wird gesendet…', 'Sending…') : L('Link senden', 'Send link')}
            </button>
          </form>

          <div className="auth-footer">
            <span>{L('Zurück zur', 'Back to')}</span>
            <Link to="/login">{L('Anmeldung', 'login')}</Link>
          </div>
        </div>

        <div className="auth-visual-panel">
          <div className="auth-visual-wrapper">
            <div className="auth-cutout-panel">
              <div className="eyebrow light">{L('Sicherer Zugang zu Ihrem Konto', 'Secure access to your account')}</div>
              <h2>
                {L('Setzen Sie Ihr Passwort zurück und', 'Reset your password and')}{' '}
                <span>{L('kehren Sie in Ihr Portal zurück.', 'return to your portal.')}</span>
              </h2>
              <p>
                {L('Wir senden Ihnen einen sicheren Link per E-Mail. Mit einem Klick legen Sie Ihr neues Passwort fest.', 'We will send you a secure link by email. With one click you set your new password.')}
              </p>
              <div className="auth-cutout-actions">
                <Link className="btn btn-primary" to="/">
                  {L('Zurück zur Startseite', 'Back to home page')} <span className="arrow">←</span>
                </Link>
                <a
                  className="btn btn-outline-light"
                  href="mailto:info@vantaro.io?subject=VANTARO%20Support"
                >
                  {L('Support kontaktieren', 'Contact support')} <span className="arrow">↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
