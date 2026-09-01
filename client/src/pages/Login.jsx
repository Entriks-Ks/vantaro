import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SocialAuthButtons from '../components/SocialAuthButtons';
import { useAuth } from '../hooks/useAuth';
import useBackForwardCacheRestore from '../hooks/useBackForwardCacheRestore';
import useNavigate from '../hooks/useNavigate';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, login, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = location.state?.from || '/dashboard';
  const info = new URLSearchParams(location.search).get('verified') === '1'
    ? 'Ihre E-Mail-Adresse ist bestätigt. Bitte melden Sie sich an.'
    : '';

  const unlockForm = useCallback(() => {
    setSubmitting(false);
  }, []);
  useBackForwardCacheRestore(unlockForm);

  useEffect(() => {
    if (!loading && user) navigate(nextPath.startsWith('/onboarding') ? '/dashboard' : nextPath, { replace: true });
  }, [loading, user, navigate, nextPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Bitte alle Felder ausfüllen');
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      navigate(nextPath.startsWith('/onboarding') ? '/dashboard' : nextPath, { replace: true });
    } catch (err) {
      if (err.requiresVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(err.email || email)}`);
        return;
      }
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle(nextPath);
    } catch (err) {
      setError(err.message || 'Google-Anmeldung ist fehlgeschlagen.');
      setSubmitting(false);
    }
  };

  const handleApple = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithApple(nextPath);
    } catch (err) {
      setError(err.message || 'Apple-Anmeldung ist fehlgeschlagen.');
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

          <h1 className="auth-title">Anmelden bei VANTARO</h1>
          <p className="auth-subtitle">Willkommen zurück.</p>

          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-success">{info}</div>}
          
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
            
            <div className="form-group">
              <label htmlFor="password">Passwort <span className="auth-required">*</span></label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort eingeben"
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
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.45 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
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
              <Link to="/forgot-password" className="forgot-password">Passwort vergessen?</Link>
            </div>
            
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Wird angemeldet…' : 'Anmelden'}
            </button>
          </form>

          <SocialAuthButtons
            onGoogle={handleGoogle}
            onApple={handleApple}
            disabled={submitting}
          />

          <div className="auth-footer">
            <span>Noch kein Konto?</span>
            <Link to="/register">Registrieren</Link>
          </div>
        </div>

        <div className="auth-visual-panel">
          <div className="auth-visual-wrapper">
            <div className="auth-cutout-panel">
              <div className="eyebrow light">Ihr Zugang zu qualifizierten Chancen</div>
              <h2>
                Melden Sie sich an, um{' '}
                <span>Ihr erfolgreiches Matching zu starten.</span>
              </h2>
              <p>
                Greifen Sie auf Ihr personalisiertes Maklerportal zu, verwalten Sie Ihre Leads und nutzen Sie unsere Matching-Infrastruktur.
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
