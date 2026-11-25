import { useEffect, useState } from 'react';
import { Building2, Check, Copy, Flame, MessageCircle, SunMedium } from 'lucide-react';
import { energyLeadTypeOf, energyTypeLabel } from '../../lib/vertical';
import { L } from '../../lib/i18n';

function DetailFact({ label, children, wide = false }) {
  const empty = children == null || children === '' || children === '—';
  return (
    <div className={`broker-detail-fact${wide ? ' is-wide' : ''}${empty ? ' is-empty' : ''}`}>
      <span>{label}</span>
      <strong>{empty ? L('Nicht hinterlegt', 'Not provided') : children}</strong>
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
      onCopied?.(L(`${label} kopiert.`, `${label} copied.`));
    } catch {
      onCopied?.(L('Kopieren nicht möglich.', 'Copying is not possible.'));
    }
  }

  return (
    <span className="broker-detail-action">
      {children}
      <button
        type="button"
        className={`broker-detail-action-copy${copied ? ' is-copied' : ''}`}
        onClick={copy}
        title={L(`${label} kopieren`, `Copy ${label}`)}
        aria-label={L(`${label} kopieren`, `Copy ${label}`)}
      >
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </button>
    </span>
  );
}

function existingPvLabel(value) {
  if (value === 'yes') return L('Ja', 'Yes');
  if (value === 'no') return L('Nein', 'No');
  if (value === 'unknown') return L('Unbekannt', 'Unknown');
  return '';
}

export function EnergyLeadFacts({ lead }) {
  return (
    <section className="broker-panel broker-detail-section">
      <div className="broker-detail-section-head">
        <span className="broker-detail-section-icon" aria-hidden="true"><SunMedium size={18} /></span>
        <div>
          <h2>{L('Paket & Qualifikation', 'Package & qualification')}</h2>
          <p>{L('Worum es im Gespräch geht', 'What the conversation is about')}</p>
        </div>
      </div>
      <div className="energy-qual">
        <div className="energy-qual__summary">
          <DetailFact label={L('Paket', 'Package')}>{energyTypeLabel(energyLeadTypeOf(lead))}</DetailFact>
          <DetailFact label={L('Art', 'Type')}>{lead.deliveryType === 'appointment' ? L('Termin', 'Appointment') : 'Lead'}</DetailFact>
          <DetailFact label={L('Zeitrahmen', 'Timeframe')}>{lead.timeframe}</DetailFact>
          <DetailFact label={L('Bundesland', 'Federal state')}>{lead.state}</DetailFact>
        </div>
        <FactGroup title={L('Gespräch', 'Conversation')} icon={MessageCircle}>
          <DetailFact label={L('Bedarf', 'Need')} wide>{lead.energyNeed}</DetailFact>
          <DetailFact label={L('Zusammenfassung', 'Summary')} wide>{lead.callSummary}</DetailFact>
        </FactGroup>
        <FactGroup title={L('Objekt & Verbrauch', 'Property & consumption')} icon={Building2}>
          <DetailFact label={L('Eigentümerstatus', 'Ownership status')}>{lead.ownerStatus}</DetailFact>
          <DetailFact label={L('Baujahr', 'Year built')}>{lead.constructionYear}</DetailFact>
          <DetailFact label={L('Jahresstromverbrauch', 'Annual electricity consumption')}>{lead.annualConsumption}</DetailFact>
          <DetailFact label={L('Bestehende PV-Anlage', 'Existing PV system')}>{existingPvLabel(lead.existingPv)}</DetailFact>
          <DetailFact label={L('Dach / Gebäude', 'Roof / building')} wide>{lead.roofNotes}</DetailFact>
        </FactGroup>
        <FactGroup title={L('Heizung', 'Heating')} icon={Flame}>
          <DetailFact label={L('Aktuelle Heizung', 'Current heating')}>{lead.heatingSystem}</DetailFact>
          <DetailFact label={L('Energieträger', 'Energy source')}>{lead.energySource}</DetailFact>
          <DetailFact label={L('Austauschzeitraum', 'Replacement timeframe')}>{lead.replacementTimeframe}</DetailFact>
        </FactGroup>
      </div>
    </section>
  );
}
