import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  MapPin,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import useNavigate from '../hooks/useNavigate';
import { accountSetupCta, isAddressComplete, isFirmComplete, isPersonalComplete } from '../pages/dashboard/helpers';
import { L } from '../lib/i18n';

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
  const setupCta = !isAdmin ? accountSetupCta(user) : null;
  const open = Boolean(setupCta) && !skipped && !onSetupPage;
  const personalDone = isPersonalComplete(user);
  const firmDone = isFirmComplete(user);
  const addressDone = isAddressComplete(user);
  const checklist = [
    !personalDone && {
      id: 'profile',
      icon: User,
      title: L('Name & Telefon', 'Name & phone'),
      text: L('Vorname, Nachname und Mobilnummer für Ihr Konto.', 'First name, last name and mobile number for your account.'),
      to: '/dashboard/profil#kontakt',
    },
    !firmDone && {
      id: 'company',
      icon: Building2,
      title: L('Unternehmen', 'Company'),
      text: L('Firmenname und Rechtsform für Portal und Dokumente.', 'Company name and legal form for the portal and documents.'),
      to: '/dashboard/unternehmen#firma',
    },
    !addressDone && {
      id: 'address',
      icon: MapPin,
      title: L('Geschäftsadresse', 'Business address'),
      text: L('Adresse für Vertrag, Rechnungen und Verifizierung.', 'Address for the contract, invoices and verification.'),
      to: '/dashboard/unternehmen#adresse',
    },
  ].filter(Boolean);

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

  if (!open || !setupCta) return null;

  const dismissForNow = () => {
    try {
      sessionStorage.setItem(skipKey(user.id), '1');
    } catch {
      // ignore
    }
    setSkipped(true);
  };

  const title = personalDone ? L('Unternehmen einrichten', 'Set up your company') : L('Profil einrichten', 'Set up your profile');
  const intro = personalDone
    ? L('Ihre Kontaktdaten sind gespeichert. Als Nächstes Firma und Adresse ergänzen.', 'Your contact details are saved. Next, add your company and address.')
    : L(
      `Willkommen${user?.firstName ? `, ${user.firstName}` : ''}. Zuerst Name und Telefon — danach das Unternehmen.`,
      `Welcome${user?.firstName ? `, ${user.firstName}` : ''}. First your name and phone — then your company.`,
    );
  const primaryLabel = personalDone ? L('Unternehmen jetzt einrichten', 'Set up company now') : L('Profil jetzt vervollständigen', 'Complete profile now');

  return (
    <div className="stammdaten-modal" role="dialog" aria-modal="true" aria-labelledby="stammdaten-title">
      <div className="stammdaten-modal__backdrop" />
      <div className="stammdaten-modal__panel">
        <div className="stammdaten-modal__top">
          <div className="stammdaten-modal__badge" aria-hidden="true">
            {personalDone ? <Building2 size={18} /> : <User size={18} />}
          </div>
          <button
            type="button"
            className="stammdaten-modal__close"
            onClick={dismissForNow}
            aria-label={L('Schließen', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="stammdaten-modal__head">
          <h2 id="stammdaten-title">{title}</h2>
          <p>{intro}</p>
        </div>

        <ul className="stammdaten-checklist">
          {checklist.map((item) => {
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

        <button type="button" className="stammdaten-modal__primary" onClick={() => navigate(setupCta.to)}>
          {primaryLabel}
          <ArrowRight size={18} />
        </button>
        <button type="button" className="stammdaten-modal__later" onClick={dismissForNow}>
          {L('Später erledigen', 'Do this later')}
        </button>
      </div>
    </div>
  );
}
