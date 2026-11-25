import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SocialAuthButtons from '../components/SocialAuthButtons';
import { useAuth } from '../hooks/useAuth';
import useBackForwardCacheRestore from '../hooks/useBackForwardCacheRestore';
import useNavigate from '../hooks/useNavigate';
import { validatePassword } from '../lib/profile';
import { L } from '../lib/i18n';
import { rememberOAuthVertical } from '../lib/auth';
import {
  clearSignupCategory,
  initialSignupCategory,
  saveSignupCategory,
} from '../lib/signupCategory';
import { VERTICALS, isVertical, normalizeVertical } from '../lib/vertical';

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
  return validatePassword(password);
}

export default function Register() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState(() => ({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    vertical: initialSignupCategory(searchParams),
  }));
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

  useEffect(() => {
    if (formData.vertical) saveSignupCategory(formData.vertical);
    else clearSignupCategory();
  }, [formData.vertical]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const selectVertical = (id) => {
    setFormData((prev) => ({ ...prev, vertical: id }));
    if (searchParams.has('category') && normalizeVertical(searchParams.get('category')) !== id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('category', id);
        return next;
      }, { replace: true });
    }
  };

  const loginHref = formData.vertical
    ? `/login?category=${encodeURIComponent(formData.vertical)}`
    : '/login';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()
      || !formData.password || !formData.confirmPassword) {
      setError(L('Bitte alle Felder ausfüllen', 'Please fill in all fields'));
      return;
    }
    if (formData.firstName.trim().length < 2 || formData.lastName.trim().length < 2) {
      setError(L('Vor- und Nachname müssen mindestens 2 Zeichen haben', 'First and last name must be at least 2 characters long'));
      return;
    }
    const pwdError = passwordError(formData.password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(L('Passwörter stimmen nicht überein', 'Passwords do not match'));
      return;
    }
    if (!isVertical(formData.vertical)) {
      setError(L('Bitte wählen Sie Versicherung oder Energie.', 'Please choose insurance or energy.'));
      return;
    }

    setSubmitting(true);
    try {
      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        vertical: formData.vertical,
      });
      clearSignupCategory();
      navigate(`/verify-email?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`);
    } catch (err) {
      if (err.requiresVerification && err.email) {
        clearSignupCategory();
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
    if (!isVertical(formData.vertical)) {
      setError(L('Bitte wählen Sie Versicherung oder Energie.', 'Please choose insurance or energy.'));
      return;
    }
    setSubmitting(true);
    try {
      rememberOAuthVertical(formData.vertical);
      await loginWithGoogle('/dashboard');
    } catch (err) {
      setError(err.message || L('Google-Anmeldung ist fehlgeschlagen.', 'Google login failed.'));
      setSubmitting(false);
    }
  };

  const handleApple = async () => {
    setError('');
    if (!isVertical(formData.vertical)) {
      setError(L('Bitte wählen Sie Versicherung oder Energie.', 'Please choose insurance or energy.'));
      return;
    }
    setSubmitting(true);
    try {
      rememberOAuthVertical(formData.vertical);
      await loginWithApple('/dashboard');
    } catch (err) {
      setError(err.message || L('Apple-Anmeldung ist fehlgeschlagen.', 'Apple login failed.'));
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

          <h1 className="auth-title">{L('Konto erstellen', 'Create account')}</h1>
          <p className="auth-subtitle">{L('Wählen Sie den Bereich. Den Rest ergänzen Sie nach dem ersten Login.', 'Choose your field. You can add the rest after your first login.')}</p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <fieldset className="vertical-choice">
              <legend>
                {L('Bereich', 'Field')} <span className="auth-required">*</span>
              </legend>
              {VERTICALS.map((option) => {
                const selected = formData.vertical === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={selected ? 'is-active' : undefined}
                    disabled={submitting}
                    onClick={() => selectVertical(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                );
              })}
            </fieldset>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">
                  {L('Vorname', 'First name')} <span className="auth-required">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder={L('Max', 'John')}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">
                  {L('Nachname', 'Last name')} <span className="auth-required">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder={L('Mustermann', 'Smith')}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">
                {L('Geschäftliche E-Mail-Adresse', 'Business email address')} <span className="auth-required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder={L('name@makler.de', 'name@company.com')}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                {L('Passwort', 'Password')} <span className="auth-required">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={L('Mind. 8 Zeichen, Buchstabe und Zahl', 'Min. 8 characters, a letter and a number')}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? L('Passwort verbergen', 'Hide password') : L('Passwort anzeigen', 'Show password')}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              <p className="auth-hint">{L('Mindestens 8 Zeichen, inkl. Buchstabe und Zahl.', 'At least 8 characters, including a letter and a number.')}</p>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                {L('Passwort bestätigen', 'Confirm password')} <span className="auth-required">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder={L('Passwort wiederholen', 'Repeat password')}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? L('Passwort verbergen', 'Hide password') : L('Passwort anzeigen', 'Show password')}
                >
                  <EyeIcon off={showConfirmPassword} />
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? L('Konto wird erstellt…', 'Creating account…') : L('Konto erstellen', 'Create account')}
            </button>
          </form>

          <SocialAuthButtons
            onGoogle={handleGoogle}
            onApple={handleApple}
            disabled={submitting}
          />

          <div className="auth-footer">
            <span>{L('Bereits ein Konto?', 'Already have an account?')}</span>
            <Link to={loginHref}>{L('Anmelden', 'Log in')}</Link>
          </div>
        </div>

        <div className="auth-visual-panel">
          <div className="auth-visual-wrapper">
            <div className="auth-cutout-panel">
              <div className="eyebrow light">{L('Schnell starten', 'Get started quickly')}</div>
              <h2>
                {L('Konto anlegen, E-Mail bestätigen,', 'Create an account, confirm your email,')}{' '}
                <span>{L('einloggen.', 'log in.')}</span>
              </h2>
              <p>
                {L('Beim ersten Login ergänzen Sie Telefon und Unternehmensdaten in einem kurzen Dialog.', 'At your first login, you add your phone number and company details in a short dialog.')}
              </p>
              <div className="auth-cutout-actions">
                <Link className="btn btn-primary" to="/">
                  {L('Zurück zur Startseite', 'Back to home page')} <span className="arrow">←</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
