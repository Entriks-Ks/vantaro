import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useNavigate from '../hooks/useNavigate';

const CODE_LENGTH = 6;

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';
  const token = searchParams.get('confirm') || searchParams.get('token') || searchParams.get('token_hash') || '';
  const codeFromQuery = onlyDigits(searchParams.get('code') || '');
  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState(codeFromQuery);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(
    emailFromQuery && !token && !codeFromQuery ? 'Wir haben Ihnen einen 6-stelligen Code per E-Mail gesendet.' : '',
  );
  const [submitting, setSubmitting] = useState(Boolean(token || codeFromQuery.length === CODE_LENGTH));
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(emailFromQuery ? 60 : 0);
  const [showWait, setShowWait] = useState(false);
  const { user, loading, verifyEmail, verifyEmailToken, resendVerification } = useAuth();
  const navigate = useNavigate();
  const inputsRef = useRef([]);
  const submittingRef = useRef(false);

  const fromLink = Boolean(token || codeFromQuery.length === CODE_LENGTH);
  const goVerified = useCallback((payload) => {
    navigate(payload?.access_token ? '/dashboard' : '/login?verified=1', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (loading || !user) return;
    navigate('/dashboard', { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (loading || user || !emailFromQuery || (!token && codeFromQuery.length !== CODE_LENGTH)) {
      return undefined;
    }

    let cancelled = false;
    setSubmitting(true);
    setError('');

    const run = async () => {
      if (token) {
        try {
          const payload = await verifyEmailToken(emailFromQuery, token);
          if (!cancelled) goVerified(payload);
          return;
        } catch (err) {
          if (cancelled) return;
          if (codeFromQuery.length !== CODE_LENGTH) {
            setError(err.message);
            setSubmitting(false);
            return;
          }
        }
      }

      try {
        const payload = await verifyEmail(emailFromQuery, codeFromQuery);
        if (!cancelled) goVerified(payload);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setSubmitting(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [loading, user, emailFromQuery, token, codeFromQuery, verifyEmail, verifyEmailToken, goVerified]);

  useEffect(() => {
    if (cooldown <= 0) {
      setShowWait(false);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (submitting || fromLink) return;
    inputsRef.current[0]?.focus();
  }, [fromLink, submitting]);

  const submitCode = async (nextCode) => {
    const digits = onlyDigits(nextCode);
    const nextEmail = email.trim().toLowerCase();

    if (!nextEmail || digits.length !== CODE_LENGTH || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      goVerified(await verifyEmail(nextEmail, digits));
    } catch (err) {
      setError(err.message);
      setCode('');
      window.setTimeout(() => inputsRef.current[0]?.focus(), 0);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const updateCode = (nextCode) => {
    const digits = onlyDigits(nextCode);
    setCode(digits);
    if (digits.length === CODE_LENGTH && email.trim()) {
      submitCode(digits);
    }
  };

  const handleDigitChange = (index, value) => {
    if (submitting) return;
    const incoming = onlyDigits(value);
    if (incoming.length > 1) {
      updateCode(incoming);
      const focusAt = Math.min(incoming.length, CODE_LENGTH - 1);
      inputsRef.current[focusAt]?.focus();
      return;
    }

    const digits = code.split('');
    digits[index] = incoming;
    const next = Array.from({ length: CODE_LENGTH }, (_, i) => digits[i] || '').join('');
    updateCode(next);

    if (incoming && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      event.preventDefault();
      const digits = code.split('');
      digits[index - 1] = '';
      setCode(digits.join(''));
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    updateCode(event.clipboardData.getData('text'));
    const focusAt = Math.min(onlyDigits(event.clipboardData.getData('text')).length, CODE_LENGTH - 1);
    inputsRef.current[focusAt]?.focus();
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setError('');
    setMessage('');
    setResending(true);
    try {
      const result = await resendVerification(email.trim().toLowerCase());
      setMessage(result.message);
      setCooldown(60);
      setCode('');
      inputsRef.current[0]?.focus();
    } catch (err) {
      const wait = Number(err.retryAfter) || Number(String(err.message).match(/(\d+)\s*Sekunden/)?.[1]) || 0;
      if (wait > 0) {
        setShowWait(true);
        setCooldown(wait);
        return;
      }
      setError(err.message);
    } finally {
      setResending(false);
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

          <h1 className="auth-title">E-Mail bestätigen</h1>
          <p className="auth-subtitle">
            {fromLink && submitting
              ? 'Ihr Bestätigungslink wird geprüft…'
              : email
                ? `Wir haben einen Bestätigungslink und einen 6-stelligen Code an ${email} gesendet.`
                : 'Geben Sie Ihre E-Mail-Adresse und den Bestätigungscode ein.'}
          </p>

          {error && <div className="auth-error">{error}</div>}
          {showWait && cooldown > 0 && (
            <div className="auth-error">
              Bitte warten Sie {cooldown} Sekunden, bevor Sie einen neuen Code anfordern.
            </div>
          )}
          {message && <div className="auth-success">{message}</div>}

          {!(fromLink && submitting) && (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitCode(code);
            }}
          >
            {!emailFromQuery && (
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
            )}

            <div className="form-group">
              <label htmlFor="code-0">Bestätigungscode <span className="auth-required">*</span></label>
              <div className="auth-otp" onPaste={handlePaste}>
                {Array.from({ length: CODE_LENGTH }, (_, index) => (
                  <input
                    key={index}
                    ref={(node) => {
                      inputsRef.current[index] = node;
                    }}
                    id={index === 0 ? 'code-0' : undefined}
                    className="auth-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={index === 0 ? CODE_LENGTH : 1}
                    value={code[index] || ''}
                    onChange={(event) => handleDigitChange(index, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    disabled={submitting}
                    aria-label={`Ziffer ${index + 1} von ${CODE_LENGTH}`}
                  />
                ))}
              </div>
              {submitting && (
                <p className="auth-otp-hint">Code wird geprüft…</p>
              )}
            </div>
          </form>
          )}

          {!(fromLink && submitting) && (
          <button
            type="button"
            className="auth-resend"
            onClick={handleResend}
            disabled={resending || cooldown > 0 || !email}
          >
            {cooldown > 0
              ? `Neuer Code in ${cooldown}s`
              : resending
                ? 'Wird gesendet…'
                : 'Neuen Code senden'}
          </button>
          )}

          <div className="auth-footer">
            <span>Zurück zur</span>
            <Link to="/login">Anmeldung</Link>
          </div>
        </div>

        <div className="auth-visual-panel">
          <div className="auth-visual-wrapper">
            <div className="auth-cutout-panel">
              <div className="eyebrow light">Sicherer Zugang zu Ihrem Portal</div>
              <h2>
                Bestätigen Sie Ihre E-Mail, um{' '}
                <span>Ihr Matching zu starten.</span>
              </h2>
              <p>
                Der Code aktiviert Ihr Konto. Danach öffnet sich Ihr Portal — mit Chancen, Nachverfolgung und Guthaben an einem Ort.
              </p>
              <div className="auth-cutout-actions">
                <Link className="btn btn-primary" to="/">
                  Zurück zur Startseite <span className="arrow">←</span>
                </Link>
                <a
                  className="btn btn-outline-light"
                  href="mailto:info@vantaro.io?subject=VANTARO%20Support"
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
