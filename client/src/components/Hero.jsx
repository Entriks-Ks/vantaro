import { Check } from 'lucide-react';
import DarkVeil from './DarkVeil';
import { L } from '../lib/i18n';

export default function Hero() {
  return (
    <section className="hero hero-centered" id="top">
      <div className="hero-veil" aria-hidden="true">
        <DarkVeil
          hueShift={46}
          noiseIntensity={0.02}
          scanlineIntensity={0.1}
          scanlineFrequency={0.7}
          warpAmount={0.22}
          speed={0.5}
        />
      </div>
      <div className="wrap hero-content">
          <div className="eyebrow light">{L('Vertriebsplattform für Versicherung & Energie', 'Sales platform for insurance & energy')}</div>
        <h1>
          {L('Aus Erstkontakt wird', 'First contact becomes')} <em>{L('Umsatz.', 'revenue.')}</em>
        </h1>
        <p className="hero-text">
          {L('VANTARO ist die Plattform für qualifizierte Chancen in Versicherung und Energie — mit Matching, Portal und Follow-up in einer durchgängigen Strecke vom Kontakt bis zum Ergebnis.', 'VANTARO is the platform for qualified opportunities in insurance and energy — with matching, portal and follow-up in one seamless workflow from contact to outcome.')}
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#kontakt">
            {L('Pilotgespräch starten', 'Start a pilot call')} <span className="arrow">↗</span>
          </a>
          <a className="btn btn-outline-light" href="#system">
            {L('Plattform entdecken', 'Explore the platform')} <span className="arrow">↓</span>
          </a>
        </div>
        <div className="hero-note">
          <span className="hero-note-tick" aria-hidden="true">
            <Check size={13} strokeWidth={2.8} />
          </span>
          <span className="hero-note-text">
            {L('Keine Leadbörse. Ein kontrollierter Weg für PKV, BU & Co. sowie Photovoltaik und Wärmepumpe.', 'Not a lead marketplace. A controlled path for private health, disability insurance & more, as well as solar PV and heat pumps.')}
          </span>
        </div>
      </div>
    </section>
  );
}
