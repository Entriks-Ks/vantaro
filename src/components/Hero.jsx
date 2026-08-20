import { Check } from 'lucide-react';
import DarkVeil from './DarkVeil';

export default function Hero() {
  return (
    <section className="hero hero-centered" id="top">
      <div className="hero-veil" aria-hidden="true">
        <DarkVeil
          hueShift={46}
          noiseIntensity={0.01}
          scanlineIntensity={0.35}
          scanlineFrequency={1.1}
          warpAmount={0.35}
          speed={0.45}
        />
      </div>
      <div className="wrap hero-content">
        <div className="eyebrow light">Revenue Engine für Finanzdienstleister</div>
        <h1>
          Aus Erstkontakt wird <em>Umsatz.</em>
        </h1>
        <p className="hero-text">
          VANTARO verbindet qualifizierte Telefonkontakte, exklusives Matching und
          konsequentes Makler-Follow-up zu einer Vertriebsstrecke, die nicht bei einem
          Datensatz endet.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#kontakt">
            Pilotgespräch starten <span className="arrow">↗</span>
          </a>
          <a className="btn btn-outline-light" href="#system">
            System entdecken <span className="arrow">↓</span>
          </a>
        </div>
        <div className="hero-note">
          <span className="hero-note-tick" aria-hidden="true">
            <Check size={13} strokeWidth={2.8} />
          </span>
          <span className="hero-note-text">
            Keine Leadbörse. Ein kontrollierter Weg bis zum Beratungsgespräch.
          </span>
        </div>
      </div>
    </section>
  );
}
