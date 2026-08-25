import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useNavigate from '../hooks/useNavigate';
import { validatePassword } from '../lib/profile';

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
      setError('Bitte öffnen Sie den Link aus der E-Mail.');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
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

          <h1 className="auth-title">Neues Passwort festlegen</h1>
          <p className="auth-subtitle">
            {hasValidLink
              ? 'Wählen Sie ein neues Passwort für Ihr VANTARO-Konto.'
              : 'Öffnen Sie den Button in der E-Mail, um fortzufahren.'}
          </p>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          {!hasValidLink ? (
            <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
              <span>Keinen Link erhalten?</span>
              <Link to="/forgot-password">Erneut anfordern</Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password">Neues Passwort <span className="auth-required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
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
                <label htmlFor="confirmPassword">Passwort bestätigen <span className="auth-required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Passwort wiederholen"
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
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
                {submitting ? 'Wird gespeichert…' : 'Passwort speichern'}
              </button>
            </form>
          )}

          <div className="auth-footer">
            <span>Zurück zur</span>
            <Link to="/login">Anmeldung</Link>
          </div>
        </div>

        <div className="auth-visual-panel">
          <div className="auth-visual-wrapper">
            <div className="auth-cutout-panel">
              <div className="eyebrow light">Sicherer Zugang zu Ihrem Konto</div>
              <h2>
                Wählen Sie ein neues Passwort und{' '}
                <span>melden Sie sich wieder an.</span>
              </h2>
              <p>
                Nach dem Speichern können Sie sich mit Ihrem neuen Passwort in Ihrem Workspace anmelden.
              </p>
              <div className="auth-cutout-actions">
                <Link className="btn btn-primary" to="/">
                  Zurück zur Startseite <span className="arrow">←</span>
                </Link>
                <a
                  className="btn btn-outline-light"
                  href="mailto:rene.schirner@entriks.com?subject=VANTARO%20Support"
                >
                  Support kontaktieren <span className="arrow">↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
