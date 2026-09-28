import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createLead, fetchLead, updateLead } from '../../lib/leads';
import { EnergyLeadReport } from './EnergyOps';
import {
  ENERGY_PACKAGES,
  ENERGY_STATES,
  EXISTING_PV_OPTIONS,
  energyLeadTypeOf,
} from '../../lib/vertical';

const EMPTY = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  street: '',
  houseNumber: '',
  zip: '',
  city: '',
  state: '',
  packageId: 'PV_LEAD',
  appointmentAt: '',
  ownerStatus: '',
  energyNeed: '',
  timeframe: '',
  callSummary: '',
  consentStatus: '',
  evidenceSource: '',
  annualConsumption: '',
  existingPv: '',
  roofNotes: '',
  heatingSystem: '',
  energySource: '',
  constructionYear: '',
  replacementTimeframe: '',
};

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLead(lead) {
  const packageId = energyLeadTypeOf(lead) || 'PV_LEAD';
  return {
    ...EMPTY,
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    phone: lead.phone || '',
    email: lead.email || '',
    street: lead.street || '',
    houseNumber: lead.houseNumber || '',
    zip: lead.zip || '',
    city: lead.city || '',
    state: lead.state || '',
    packageId,
    appointmentAt: toLocalInput(lead.appointmentAt),
    ownerStatus: lead.ownerStatus || '',
    energyNeed: lead.energyNeed || '',
    timeframe: lead.timeframe || '',
    callSummary: lead.callSummary || '',
    consentStatus: lead.consentStatus || '',
    evidenceSource: lead.evidenceSource || '',
    annualConsumption: lead.annualConsumption || '',
    existingPv: lead.existingPv || '',
    roofNotes: lead.roofNotes || '',
    heatingSystem: lead.heatingSystem || '',
    energySource: lead.energySource || '',
    constructionYear: lead.constructionYear || '',
    replacementTimeframe: lead.replacementTimeframe || '',
  };
}

export default function EnergyLeadEditor() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const isNew = !leadId;
  const [form, setForm] = useState(EMPTY);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!leadId) return undefined;
    let active = true;
    fetchLead(leadId)
      .then((payload) => {
        if (active && payload.lead) {
          setLead(payload.lead);
          setForm(fromLead(payload.lead));
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [leadId]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selected = ENERGY_PACKAGES.find((item) => item.id === form.packageId) || ENERGY_PACKAGES[0];
  const isPv = selected.product === 'photovoltaic';
  const isAppointment = selected.deliveryType === 'appointment';

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      vertical: 'energy',
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      street: form.street.trim(),
      houseNumber: form.houseNumber.trim(),
      zip: form.zip.trim(),
      city: form.city.trim(),
      state: form.state,
      energyProduct: selected.product,
      deliveryType: selected.deliveryType,
      appointmentAt: isAppointment && form.appointmentAt ? new Date(form.appointmentAt).toISOString() : null,
      ownerStatus: form.ownerStatus.trim(),
      energyNeed: form.energyNeed.trim(),
      timeframe: form.timeframe.trim(),
      callSummary: form.callSummary.trim(),
      consentStatus: form.consentStatus.trim(),
      evidenceSource: form.evidenceSource.trim(),
      annualConsumption: isPv ? form.annualConsumption.trim() : '',
      existingPv: isPv ? form.existingPv : '',
      roofNotes: isPv ? form.roofNotes.trim() : '',
      heatingSystem: isPv ? '' : form.heatingSystem.trim(),
      energySource: isPv ? '' : form.energySource.trim(),
      constructionYear: isPv ? '' : form.constructionYear.trim(),
      replacementTimeframe: isPv ? '' : form.replacementTimeframe.trim(),
    };
    try {
      const result = isNew
        ? await createLead(payload)
        : await updateLead(leadId, payload);
      navigate(`/dashboard/leads/energy/${result.lead.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="broker-page"><p>Wird geladen…</p></div>;

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Energie</div>
          <h1>{isNew ? 'Energie-Lead' : 'Energie-Lead bearbeiten'}</h1>
          <p className="lede">Pflichtfelder aus dem Energie-Portal: Kontakt, Adresse, Produkt, Qualifizierung und Nachweis.</p>
        </div>
      </div>
      {error ? <div className="broker-alert">{error}</div> : null}
      <form className="broker-settings-section" onSubmit={submit}>
        <div className="energy-package-grid">
          {ENERGY_PACKAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`vertical-choice-card${form.packageId === item.id ? ' is-active' : ''}`}
              onClick={() => setField('packageId', item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
        <div className="broker-form-grid">
          <label>Vorname<input value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} required /></label>
          <label>Nachname<input value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} required /></label>
          <label>Telefon<input value={form.phone} onChange={(event) => setField('phone', event.target.value)} required /></label>
          <label>E-Mail, falls vorhanden<input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} /></label>
          <label>Straße<input value={form.street} onChange={(event) => setField('street', event.target.value)} required /></label>
          <label>Hausnummer<input value={form.houseNumber} onChange={(event) => setField('houseNumber', event.target.value)} required /></label>
          <label>PLZ<input value={form.zip} onChange={(event) => setField('zip', event.target.value)} required /></label>
          <label>Ort<input value={form.city} onChange={(event) => setField('city', event.target.value)} required /></label>
          <label>
            Bundesland
            <select value={form.state} onChange={(event) => setField('state', event.target.value)} required>
              <option value="">Bitte wählen</option>
              {ENERGY_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
          {isAppointment ? (
            <label>
              Datum und Uhrzeit
              <input type="datetime-local" value={form.appointmentAt} onChange={(event) => setField('appointmentAt', event.target.value)} required />
            </label>
          ) : null}
          <label>Eigentümerstatus<input value={form.ownerStatus} onChange={(event) => setField('ownerStatus', event.target.value)} required /></label>
          <label>Bedarf<input value={form.energyNeed} onChange={(event) => setField('energyNeed', event.target.value)} required /></label>
          <label>Zeitrahmen<input value={form.timeframe} onChange={(event) => setField('timeframe', event.target.value)} required /></label>
          <label className="is-full">Gesprächszusammenfassung<textarea rows={4} value={form.callSummary} onChange={(event) => setField('callSummary', event.target.value)} required /></label>
          <label>Einwilligungsstatus<input value={form.consentStatus} onChange={(event) => setField('consentStatus', event.target.value)} required /></label>
          <label>Quelle<input value={form.evidenceSource} onChange={(event) => setField('evidenceSource', event.target.value)} required /></label>
          {isPv ? (
            <>
              <label>Jahresstromverbrauch, falls bekannt<input value={form.annualConsumption} onChange={(event) => setField('annualConsumption', event.target.value)} /></label>
              <label>
                Bestehende PV-Anlage
                <select value={form.existingPv} onChange={(event) => setField('existingPv', event.target.value)} required>
                  <option value="">Bitte wählen</option>
                  {EXISTING_PV_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label className="is-full">Dach- oder Gebäudehinweise<textarea rows={3} value={form.roofNotes} onChange={(event) => setField('roofNotes', event.target.value)} /></label>
            </>
          ) : (
            <>
              <label>Aktuelle Heizung<input value={form.heatingSystem} onChange={(event) => setField('heatingSystem', event.target.value)} required /></label>
              <label>Energieträger<input value={form.energySource} onChange={(event) => setField('energySource', event.target.value)} required /></label>
              <label>Baujahr oder Gebäudeinfo<input value={form.constructionYear} onChange={(event) => setField('constructionYear', event.target.value)} /></label>
              <label>Gewünschter Austauschzeitraum<input value={form.replacementTimeframe} onChange={(event) => setField('replacementTimeframe', event.target.value)} required /></label>
            </>
          )}
        </div>
        <button type="submit" className="dash-btn" disabled={saving}>{saving ? 'Wird gespeichert…' : 'Speichern'}</button>
      </form>
      {!isNew && lead ? (
        <aside className="broker-panel broker-detail-side">
          <EnergyLeadReport lead={lead} onChange={setLead} />
        </aside>
      ) : null}
      <p><Link to="/dashboard/leads">Zurück zu den Leads</Link></p>
    </div>
  );
}
