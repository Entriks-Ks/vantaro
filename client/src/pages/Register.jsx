import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SocialAuthButtons from '../components/SocialAuthButtons';
import { useAuth } from '../hooks/useAuth';
import useBackForwardCacheRestore from '../hooks/useBackForwardCacheRestore';
import useNavigate from '../hooks/useNavigate';

function EyeIcon({ off }) {
  if (off) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function passwordError(password) {
  if (password.length < 8) return 'Passwort muss mindestens 8 Zeichen lang sein';
  if (!/[A-Za-zÄÖÜäöüß]/.test(password)) return 'Passwort muss mindestens einen Buchstaben enthalten';
  if (!/\d/.test(password)) return 'Passwort muss mindestens eine Zahl enthalten';
  return '';
}

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, register, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();

  const unlockForm = useCallback(() => {
    setSubmitting(false);
  }, []);
  useBackForwardCacheRestore(unlockForm);

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [loading, user, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()
      || !formData.password || !formData.confirmPassword) {
      setError('Bitte alle Felder ausfüllen');
      return;
    }
    if (formData.firstName.trim().length < 2 || formData.lastName.trim().length < 2) {
      setError('Vor- und Nachname müssen mindestens 2 Zeichen haben');
      return;
    }
    const pwdError = passwordError(formData.password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });
      navigate(`/verify-email?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`);
    } catch (err) {
      if (err.requiresVerification && err.email) {
        navigate(`/verify-email?email=${encodeURIComponent(err.email)}`);
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
      await loginWithGoogle('/dashboard');
    } catch (err) {
      setError(err.message || 'Google-Anmeldung ist fehlgeschlagen.');
      setSubmitting(false);
    }
  };

  const handleApple = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithApple('/dashboard');
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
            <img className="brand-mark" src="/favicon.svg" alt="" width={48} height={48} />
          </div>

          <h1 className="auth-title">Konto erstellen</h1>
          <p className="auth-subtitle">Nur die wichtigsten Kontodaten — den Rest ergänzen Sie nach dem ersten Login.</p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">
                  Vorname <span className="auth-required">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Max"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">
                  Nachname <span className="auth-required">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Mustermann"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">
                Geschäftliche E-Mail-Adresse <span className="auth-required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="name@makler.de"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Passwort <span className="auth-required">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Min. 8 Zeichen, Buchstabe + Zahl"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              <p className="auth-hint">Mindestens 8 Zeichen, inkl. Buchstabe und Zahl.</p>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                Passwort bestätigen <span className="auth-required">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Passwort wiederholen"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  <EyeIcon off={showConfirmPassword} />
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Konto wird erstellt…' : 'Konto erstellen'}
            </button>
          </form>

          <SocialAuthButtons
            onGoogle={handleGoogle}
            onApple={handleApple}
            disabled={submitting}
          />

          <div className="auth-footer">
            <span>Bereits ein Konto?</span>
            <Link to="/login">Anmelden</Link>
          </div>
        </div>

        <div className="auth-visual-panel">
          <div className="auth-visual-wrapper">
            <div className="auth-cutout-panel">
              <div className="eyebrow light">Schnell starten</div>
              <h2>
                Konto anlegen, E-Mail bestätigen,{' '}
                <span>einloggen.</span>
              </h2>
              <p>
                Beim ersten Login ergänzen Sie Telefon und Unternehmensdaten in einem kurzen Dialog.
              </p>
              <div className="auth-cutout-actions">
                <Link className="btn btn-primary" to="/">
                  Zurück zur Startseite <span className="arrow">←</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
