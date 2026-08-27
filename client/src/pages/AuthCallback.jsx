import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { consumeOAuthNext } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import useNavigate from '../hooks/useNavigate';
import BootScreen from '../components/BootScreen';

export default function AuthCallback() {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    completeOAuthLogin()
      .then(() => {
        if (!active) return;
        const next = consumeOAuthNext();
        navigate(next, { replace: true });
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Anmeldung ist fehlgeschlagen.');
      });

    return () => {
      active = false;
    };
  }, [completeOAuthLogin, navigate]);

  if (error) {
    return (
      <section className="auth-page" id="inhalt">
        <div className="auth-layout wrap">
          <div className="auth-form-container">
            <h1 className="auth-title">Anmeldung fehlgeschlagen</h1>
            <div className="auth-error">{error}</div>
            <div className="auth-footer">
              <Link to="/login">Zurück zur Anmeldung</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return <BootScreen caption="Anmeldung wird abgeschlossen" />;
}
