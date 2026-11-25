import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useNavigate from '../hooks/useNavigate';
import { validatePassword } from '../lib/profile';
import { L } from '../lib/i18n';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  const token = searchParams.get('confirm') || searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const hasValidLink = Boolean(email && token);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!hasValidLink) {
      setError(L('Bitte öffnen Sie den Link aus der E-Mail.', 'Please open the link from the email.'));
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError(L('Passwörter stimmen nicht überein', 'Passwords do not match'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword({ email, password, token });
      setMessage(result.message);
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
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

          <h1 className="auth-title">{L('Neues Passwort festlegen', 'Set a new password')}</h1>
          <p className="auth-subtitle">
            {hasValidLink
              ? L('Wählen Sie ein neues Passwort für Ihr VANTARO-Konto.', 'Choose a new password for your VANTARO account.')
              : L('Öffnen Sie den Button in der E-Mail, um fortzufahren.', 'Click the button in the email to continue.')}
          </p>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          {!hasValidLink ? (
            <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
              <span>{L('Keinen Link erhalten?', 'Didn’t receive a link?')}</span>
              <Link to="/forgot-password">{L('Erneut anfordern', 'Request again')}</Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password">{L('Neues Passwort', 'New password')} <span className="auth-required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={L('Mindestens 8 Zeichen', 'At least 8 characters')}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">{L('Passwort bestätigen', 'Confirm password')} <span className="auth-required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={L('Passwort wiederholen', 'Repeat password')}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? L('Passwort verbergen', 'Hide password') : L('Passwort anzeigen', 'Show password')}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? L('Wird gespeichert…', 'Saving…') : L('Passwort speichern', 'Save password')}
              </button>
            </form>
          )}

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
                {L('Wählen Sie ein neues Passwort und', 'Choose a new password and')}{' '}
                <span>{L('melden Sie sich wieder an.', 'log in again.')}</span>
              </h2>
              <p>
                {L('Nach dem Speichern können Sie sich mit Ihrem neuen Passwort im Portal anmelden.', 'Once saved, you can log in to the portal with your new password.')}
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
