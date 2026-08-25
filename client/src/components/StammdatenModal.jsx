import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Globe,
  MapPin,
  Phone,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import useNavigate from '../hooks/useNavigate';

const CHECKLIST = [
  {
    id: 'profile',
    icon: User,
    title: 'Profil',
    text: 'Name, Mobilnummer und Profilbild.',
    to: '/dashboard/profil',
  },
  {
    id: 'company',
    icon: Building2,
    title: 'Unternehmen',
    text: 'Firmenname und Rechtsform für Portal und Dokumente.',
    to: '/dashboard/unternehmen',
  },
  {
    id: 'address',
    icon: MapPin,
    title: 'Geschäftsadresse',
    text: 'Adresse für Vertrag, Rechnungen und Verifizierung.',
    to: '/dashboard/unternehmen',
  },
  {
    id: 'contact',
    icon: Phone,
    title: 'Erreichbarkeit',
    text: 'Telefon im Profil für Rückfragen.',
    to: '/dashboard/profil',
  },
  {
    id: 'website',
    icon: Globe,
    title: 'Website',
    text: 'Optional — unter Unternehmen ergänzen.',
    to: '/dashboard/unternehmen',
  },
];

function skipKey(userId) {
  return `vantaro-stammdaten-skip:${userId}`;
}

export default function StammdatenModal() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [skipped, setSkipped] = useState(false);

  const onSetupPage = location.pathname.startsWith('/dashboard/profil')
    || location.pathname.startsWith('/dashboard/unternehmen')
    || location.pathname.startsWith('/dashboard/sicherheit');
  const needsSetup = Boolean(user && !isAdmin && !user.onboardingComplete);
  const open = needsSetup && !skipped && !onSetupPage;
  const needsPhone = !String(user?.phone || '').trim();
  const primaryPath = needsPhone ? '/dashboard/profil' : '/dashboard/unternehmen';

  useEffect(() => {
    if (!user?.id) {
      setSkipped(false);
      return;
    }
    try {
      setSkipped(sessionStorage.getItem(skipKey(user.id)) === '1');
    } catch {
      setSkipped(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const dismissForNow = () => {
    try {
      sessionStorage.setItem(skipKey(user.id), '1');
    } catch {
      // ignore
    }
    setSkipped(true);
  };

  const goPrimary = () => {
    navigate(primaryPath);
  };

  return (
    <div className="stammdaten-modal" role="dialog" aria-modal="true" aria-labelledby="stammdaten-title">
      <div className="stammdaten-modal__backdrop" />
      <div className="stammdaten-modal__panel">
        <div className="stammdaten-modal__top">
          <div className="stammdaten-modal__badge" aria-hidden="true">
            <span>!</span>
          </div>
          <button
            type="button"
            className="stammdaten-modal__close"
            onClick={dismissForNow}
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="stammdaten-modal__head">
          <h2 id="stammdaten-title">Konto einrichten</h2>
          <p>
            Willkommen{user?.firstName ? `, ${user.firstName}` : ''}. Ergänzen Sie Profil und
            Unternehmen — getrennt und übersichtlich.
          </p>
        </div>

        <ul className="stammdaten-checklist">
          {CHECKLIST.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button type="button" className="stammdaten-check" onClick={() => navigate(item.to)}>
                  <span className="stammdaten-check__icon">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="stammdaten-check__copy">
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button type="button" className="stammdaten-modal__primary" onClick={goPrimary}>
          {needsPhone ? 'Profil jetzt vervollständigen' : 'Unternehmen jetzt vervollständigen'}
          <ArrowRight size={18} />
        </button>
        <button type="button" className="stammdaten-modal__later" onClick={dismissForNow}>
          Später erledigen
        </button>
      </div>
    </div>
  );
}
