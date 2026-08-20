import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useNavigate from '../hooks/useNavigate';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';
  const tokenHash = searchParams.get('token_hash') || searchParams.get('token') || '';
  const linkType = searchParams.get('type') || 'signup';
  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState(
    emailFromQuery ? 'Wir haben Ihnen einen 6-stelligen Code per E-Mail gesendet.' : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { user, loading, verifyEmail, verifyEmailToken, resendVerification } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (!tokenHash) return undefined;
    let active = true;
    setSubmitting(true);
    verifyEmailToken(tokenHash, linkType)
      .then((result) => {
        if (!active) return;
        setMessage(result.message);
        window.setTimeout(() => {
          navigate('/login?verified=1', { replace: true });
        }, 800);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setSubmitting(false);
      });
    return () => {
      active = false;
    };
  }, [tokenHash, linkType, verifyEmailToken, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const maskedEmail = useMemo(() => {
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    const visible = name.slice(0, 1);
    return `${visible}${'•'.repeat(Math.max(name.length - 1, 2))}@${domain}`;
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email || !code) {
      setError('Bitte E-Mail-Adresse und Code eingeben.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await verifyEmail(email.trim().toLowerCase(), code);
      setMessage(result.message);
      window.setTimeout(() => {
        navigate('/login?verified=1', { replace: true });
      }, 1400);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
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
    } catch (err) {
      setError(err.message);
      if (err.retryAfter) setCooldown(Number(err.retryAfter) || 60);
    } finally {
      setResending(false);
    }
  };

  return (
    <section className="auth-page" id="inhalt">
      <div className="auth-layout">
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
            {email
              ? `Geben Sie den 6-stelligen Code ein, den wir an ${maskedEmail} gesendet haben.`
              : 'Geben Sie Ihre E-Mail-Adresse und den Bestätigungscode ein.'}
          </p>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {!emailFromQuery && (
              <div className="form-group">
                <label htmlFor="email">E-Mail-Adresse</label>
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
              <label htmlFor="code">Bestätigungscode</label>
              <input
                className="auth-code-input"
                type="text"
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                disabled={submitting}
              />
            </div>

            <button type="submit" className="auth-submit" disabled={submitting || code.length !== 6}>
              {submitting ? 'Wird geprüft…' : 'E-Mail bestätigen'}
            </button>
          </form>

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

          <div className="auth-footer">
            <span>Zurück zur</span>
            <Link to="/login">Anmeldung</Link>
          </div>
        </div>
      </div>
    </section>
  );
}


