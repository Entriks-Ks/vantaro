import { useEffect, useState } from 'react';
import { Building2, Check, Copy, Flame, MessageCircle, SunMedium } from 'lucide-react';
import { energyLeadTypeOf, energyTypeLabel } from '../../lib/vertical';

function DetailFact({ label, children, wide = false }) {
  const empty = children == null || children === '' || children === '—';
  return (
    <div className={`broker-detail-fact${wide ? ' is-wide' : ''}${empty ? ' is-empty' : ''}`}>
      <span>{label}</span>
      <strong>{empty ? 'Nicht hinterlegt' : children}</strong>
    </div>
  );
}

function FactGroup({ title, icon: Icon, children }) {
  return (
    <div className="energy-qual__group">
      <h3 className="energy-qual__title">
        {Icon ? <Icon size={14} aria-hidden="true" /> : null}
        {title}
      </h3>
      <div className="energy-qual__grid">{children}</div>
    </div>
  );
}

export function CopyableAction({ value, label, onCopied, children }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      onCopied?.(`${label} kopiert.`);
    } catch {
      onCopied?.('Kopieren nicht möglich.');
    }
  }

  return (
    <span className="broker-detail-action">
      {children}
      <button
        type="button"
        className={`broker-detail-action-copy${copied ? ' is-copied' : ''}`}
        onClick={copy}
        title={`${label} kopieren`}
        aria-label={`${label} kopieren`}
      >
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </button>
    </span>
  );
}

function existingPvLabel(value) {
  if (value === 'yes') return 'Ja';
  if (value === 'no') return 'Nein';
  if (value === 'unknown') return 'Unbekannt';
  return '';
}

export function EnergyLeadFacts({ lead }) {
  return (
    <section className="broker-panel broker-detail-section">
      <div className="broker-detail-section-head">
        <span className="broker-detail-section-icon" aria-hidden="true"><SunMedium size={18} /></span>
        <div>
          <h2>Paket &amp; Qualifikation</h2>
          <p>Worum es im Gespräch geht</p>
        </div>
      </div>
      <div className="energy-qual">
        <div className="energy-qual__summary">
          <DetailFact label="Paket">{energyTypeLabel(energyLeadTypeOf(lead))}</DetailFact>
          <DetailFact label="Art">{lead.deliveryType === 'appointment' ? 'Termin' : 'Lead'}</DetailFact>
          <DetailFact label="Zeitrahmen">{lead.timeframe}</DetailFact>
          <DetailFact label="Bundesland">{lead.state}</DetailFact>
        </div>
        <FactGroup title="Gespräch" icon={MessageCircle}>
          <DetailFact label="Bedarf" wide>{lead.energyNeed}</DetailFact>
          <DetailFact label="Zusammenfassung" wide>{lead.callSummary}</DetailFact>
        </FactGroup>
        <FactGroup title="Objekt & Verbrauch" icon={Building2}>
          <DetailFact label="Eigentümerstatus">{lead.ownerStatus}</DetailFact>
          <DetailFact label="Baujahr">{lead.constructionYear}</DetailFact>
          <DetailFact label="Jahresstromverbrauch">{lead.annualConsumption}</DetailFact>
          <DetailFact label="Bestehende PV-Anlage">{existingPvLabel(lead.existingPv)}</DetailFact>
          <DetailFact label="Dach / Gebäude" wide>{lead.roofNotes}</DetailFact>
        </FactGroup>
        <FactGroup title="Heizung" icon={Flame}>
          <DetailFact label="Aktuelle Heizung">{lead.heatingSystem}</DetailFact>
          <DetailFact label="Energieträger">{lead.energySource}</DetailFact>
          <DetailFact label="Austauschzeitraum">{lead.replacementTimeframe}</DetailFact>
        </FactGroup>
      </div>
    </section>
  );
}
