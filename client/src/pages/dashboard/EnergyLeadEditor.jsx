import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarX2,
  ClipboardList,
  Flame,
  MapPin,
  MessageSquareText,
  Package,
  ShieldCheck,
  SunMedium,
  UserRound,
  Zap,
} from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { complaintReasonLabel, complaintStatusLabel } from '../../lib/complaints';
import { createLead, deleteLead, fetchLead, isLeadDeliveryLocked, updateLead } from '../../lib/leads';
import {
  ENERGY_PACKAGES,
  ENERGY_STATES,
  EXISTING_PV_OPTIONS,
  energyLeadTypeOf,
  energyPackageFor,
  energyTypeLabel,
} from '../../lib/vertical';
import {
  CopyableValue,
  Field,
  LeadAssignPanel,
  LeadCompletenessPanel,
  LeadHero,
  LeadOriginPanel,
  LeadSection,
  LeadText,
  LeadTile,
  SteppedLeadForm,
  canAssignLead,
  isBlank,
  isEmptyValue,
  leadPlace,
  returnLabel,
  returnTo,
} from './LeadDetail';

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

const CALENDAR_SYNC_LABELS = {
  connected: 'Im Kalender des Beraters eingetragen',
  pending: 'Kalender-Eintrag wird synchronisiert',
  error: 'Kalender-Eintrag fehlgeschlagen',
  disconnected: 'Kein Kalender verbunden',
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

function existingPvLabel(value) {
  return EXISTING_PV_OPTIONS.find((option) => option.id === value)?.label || '';
}

function streetLine(lead) {
  return [lead.street, lead.houseNumber].filter(Boolean).join(' ');
}

function energyChecks(lead) {
  const isPv = lead.energyProduct === 'photovoltaic';
  const checks = [];
  if (lead.deliveryType === 'appointment') checks.push(['Termin', Boolean(lead.appointmentAt), 'package']);
  checks.push(
    ['Telefon', !isBlank(lead.phone), 'contact'],
    ['Straße & Hausnummer', Boolean(lead.street && lead.houseNumber), 'address'],
    ['PLZ', !isBlank(lead.zip), 'address'],
    ['Ort', !isBlank(lead.city), 'address'],
    ['Bundesland', !isBlank(lead.state), 'address'],
    ['Eigentümerstatus', !isBlank(lead.ownerStatus), 'need'],
    ['Bedarf', !isBlank(lead.energyNeed), 'need'],
    ['Zeitrahmen', !isBlank(lead.timeframe), 'need'],
    ['Gesprächszusammenfassung', !isBlank(lead.callSummary), 'need'],
  );
  if (isPv) {
    checks.push(['Bestehende PV-Anlage', !isBlank(lead.existingPv), 'object']);
  } else {
    checks.push(
      ['Aktuelle Heizung', !isBlank(lead.heatingSystem), 'object'],
      ['Energieträger', !isBlank(lead.energySource), 'object'],
      ['Austauschzeitraum', !isBlank(lead.replacementTimeframe), 'object'],
    );
  }
  checks.push(
    ['Einwilligung', !isBlank(lead.consentStatus), 'consent'],
    ['Nachweisquelle', !isBlank(lead.evidenceSource), 'consent'],
  );
  return checks;
}

function relativeDay(date) {
  const startOf = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(new Date())) / 86400000);
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days === -1) return 'Gestern';
  return days > 0 ? `In ${days} Tagen` : `Vor ${-days} Tagen`;
}

function AppointmentBanner({ lead }) {
  const date = lead.appointmentAt ? new Date(lead.appointmentAt) : null;
  const valid = date && !Number.isNaN(date.getTime());

  if (!valid) {
    return (
      <section className="dash-panel dash-lead-appt is-missing">
        <span className="dash-lead-appt__icon" aria-hidden="true"><CalendarX2 size={20} /></span>
        <div className="dash-lead-appt__body">
          <span className="dash-lead-appt__label">Vereinbarter Termin</span>
          <strong>Kein Termin hinterlegt</strong>
          <small>Bitte bearbeiten und Datum und Uhrzeit eintragen.</small>
        </div>
      </section>
    );
  }

  const past = date.getTime() < Date.now();
  const day = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  const sync = CALENDAR_SYNC_LABELS[lead.calendarSyncStatus];

  return (
    <section className={`dash-panel dash-lead-appt${past ? ' is-past' : ''}`}>
      <span className="dash-lead-appt__icon" aria-hidden="true"><CalendarClock size={20} /></span>
      <div className="dash-lead-appt__body">
        <span className="dash-lead-appt__label">Vereinbarter Termin</span>
        <strong>{day} · {time} Uhr</strong>
        {sync ? (
          <small className={`dash-lead-appt__sync is-${lead.calendarSyncStatus}`}>{sync}</small>
        ) : null}
      </div>
      <span className="dash-lead-appt__when">{past ? `Vergangen · ${relativeDay(date)}` : relativeDay(date)}</span>
    </section>
  );
}

function EnergyLeadView({ lead, onEdit, onDelete, onAssigned, saving }) {
  const type = energyLeadTypeOf(lead);
  const isPv = lead.energyProduct === 'photovoltaic';
  const isAppointment = lead.deliveryType === 'appointment';
  const locked = isLeadDeliveryLocked(lead);
  const street = streetLine(lead);
  const place = leadPlace(lead);

  return (
    <div className={`dash-lead-view${locked ? ' is-locked' : ''}`}>
      <LeadHero
        lead={lead}
        kicker={isAppointment ? 'Energie-Termin' : 'Energie-Lead'}
        facts={[place, lead.state]}
        badges={(
          <>
            <span className="dash-badge dash-badge--muted">{energyTypeLabel(type)}</span>
            <span className={`dash-badge dash-badge--${isAppointment ? 'warn' : 'muted'}`}>
              {isAppointment ? 'Termin' : 'Lead'}
            </span>
          </>
        )}
        onEdit={onEdit}
        onDelete={onDelete}
        saving={saving}
        locked={locked}
      />

      {isAppointment ? <AppointmentBanner lead={lead} /> : null}

      {lead.complaint ? (
        <div className="dash-alert">
          Reklamation: {complaintStatusLabel(lead.complaint.status)} · {complaintReasonLabel(lead.complaint.reason, 'energy')}.{' '}
          <Link to="/dashboard/reklamationen">Zu den Reklamationen</Link>
        </div>
      ) : null}

      <div className="dash-lead-layout">
        <div className="dash-lead-main">
          <LeadSection icon={UserRound} title="Person & Kontakt" subtitle="Wer ist der Kunde und wie ist er erreichbar">
            <div className="dash-lead-tiles">
              <LeadTile label="Telefon" empty={!lead.phone}>
                <CopyableValue value={lead.phone} label="Telefonnummer" />
              </LeadTile>
              <LeadTile label="E-Mail" empty={!lead.email}>
                <CopyableValue value={lead.email} label="E-Mail" />
              </LeadTile>
              <LeadTile label="Adresse" empty={!street && !place}>
                {street ? <span className="dash-lead-tile__line">{street}</span> : null}
                {place ? <span className="dash-lead-tile__line">{place}</span> : null}
              </LeadTile>
              <LeadTile label="Bundesland">{lead.state}</LeadTile>
            </div>
          </LeadSection>

          <LeadSection
            icon={isPv ? SunMedium : Zap}
            title="Paket & Bedarf"
            subtitle="Worum es im Gespräch geht"
          >
            <div className="dash-lead-tiles dash-lead-tiles--highlight dash-lead-tiles--three">
              <LeadTile label="Paket">{energyTypeLabel(type)}</LeadTile>
              <LeadTile label="Zeitrahmen">{lead.timeframe}</LeadTile>
              <LeadTile label="Eigentümerstatus">{lead.ownerStatus}</LeadTile>
            </div>
            <div className="dash-lead-tiles">
              <LeadTile label="Bedarf" wide>{lead.energyNeed}</LeadTile>
            </div>
          </LeadSection>

          {isPv ? (
            <LeadSection icon={Building2} title="Objekt & Verbrauch" subtitle="Angaben zu Gebäude, Dach und Stromverbrauch">
              <div className="dash-lead-tiles">
                <LeadTile label="Jahresstromverbrauch">{lead.annualConsumption}</LeadTile>
                <LeadTile label="Bestehende PV-Anlage">{existingPvLabel(lead.existingPv)}</LeadTile>
                <LeadTile label="Dach / Gebäude" wide>{lead.roofNotes}</LeadTile>
              </div>
            </LeadSection>
          ) : (
            <LeadSection icon={Flame} title="Heizung & Gebäude" subtitle="Aktuelle Heizung und gewünschter Austausch">
              <div className="dash-lead-tiles">
                <LeadTile label="Aktuelle Heizung">{lead.heatingSystem}</LeadTile>
                <LeadTile label="Energieträger">{lead.energySource}</LeadTile>
                <LeadTile label="Baujahr / Gebäude">{lead.constructionYear}</LeadTile>
                <LeadTile label="Austauschzeitraum">{lead.replacementTimeframe}</LeadTile>
              </div>
            </LeadSection>
          )}

          <LeadSection icon={MessageSquareText} title="Gesprächszusammenfassung" subtitle="Was im Qualifizierungsgespräch besprochen wurde">
            <LeadText value={lead.callSummary} empty="Keine Zusammenfassung hinterlegt." />
          </LeadSection>

          <LeadSection icon={ShieldCheck} title="Einwilligung & Nachweis" subtitle="Rechtliche Grundlage für die Kontaktaufnahme">
            <div className="dash-lead-tiles">
              <LeadTile label="Einwilligungsstatus">{lead.consentStatus}</LeadTile>
              <LeadTile label="Nachweisquelle">{lead.evidenceSource}</LeadTile>
            </div>
          </LeadSection>
        </div>

        <aside className="dash-lead-aside">
          {canAssignLead(lead, locked) ? (
            <LeadAssignPanel lead={lead} disabled={saving} onAssigned={onAssigned} />
          ) : null}
          <LeadCompletenessPanel checks={energyChecks(lead)} />
          <LeadOriginPanel lead={lead} packageLabel={energyTypeLabel(type)}>
            {isAppointment && CALENDAR_SYNC_LABELS[lead.calendarSyncStatus] ? (
              <div>
                <dt>Kalender</dt>
                <dd>{CALENDAR_SYNC_LABELS[lead.calendarSyncStatus]}</dd>
              </div>
            ) : null}
          </LeadOriginPanel>
        </aside>
      </div>
    </div>
  );
}

const PRODUCT_CHOICES = [
  { id: 'photovoltaic', label: 'Photovoltaik', description: 'Solaranlage, Dach und Stromverbrauch', icon: SunMedium },
  { id: 'heat_pump', label: 'Wärmepumpe', description: 'Heizungstausch und Gebäude', icon: Flame },
];

const DELIVERY_CHOICES = [
  { id: 'lead', label: 'Lead', description: 'Qualifizierter Kontakt, Berater vereinbart den Termin', icon: UserRound },
  { id: 'appointment', label: 'Termin', description: 'Fester Termin mit Datum und Uhrzeit', icon: CalendarClock },
];

function ChoiceGroup({ legend, options, value, onChange }) {
  return (
    <fieldset className="dash-lead-choice is-full">
      <legend className="dash-field-label">{legend}<em className="dash-req" aria-hidden="true">*</em></legend>
      <div className="dash-lead-choice__options">
        {options.map((option) => {
          const Icon = option.icon;
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`dash-lead-choice__option${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
            >
              <span className="dash-lead-choice__icon" aria-hidden="true"><Icon size={17} /></span>
              <span className="dash-lead-choice__text">
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function formSteps(isPv) {
  return [
    { id: 'package', label: 'Paket', icon: Package },
    { id: 'contact', label: 'Kontakt', icon: UserRound },
    { id: 'address', label: 'Adresse', icon: MapPin },
    { id: 'need', label: 'Bedarf', icon: ClipboardList },
    isPv
      ? { id: 'object', label: 'Objekt', icon: Building2 }
      : { id: 'object', label: 'Heizung', icon: Flame },
    { id: 'consent', label: 'Einwilligung', icon: ShieldCheck },
  ];
}

function StepFields({ step, form, bind, selected, isPv, isAppointment, selectPackage }) {
  const miss = (key) => isEmptyValue(form[key]);

  if (step === 'package') {
    return (
      <div className="dash-form">
        <ChoiceGroup
          legend="Produkt"
          options={PRODUCT_CHOICES}
          value={selected.product}
          onChange={(product) => selectPackage(product, selected.deliveryType)}
        />
        <ChoiceGroup
          legend="Lieferart"
          options={DELIVERY_CHOICES}
          value={selected.deliveryType}
          onChange={(deliveryType) => selectPackage(selected.product, deliveryType)}
        />
        {isAppointment ? (
          <div className="dash-lead-edit__appt is-full">
            <Field label="Datum und Uhrzeit des Termins" required missing={miss('appointmentAt')}>
              <input type="datetime-local" {...bind('appointmentAt')} required />
            </Field>
          </div>
        ) : null}
      </div>
    );
  }
  if (step === 'contact') {
    return (
      <div className="dash-form">
        <Field label="Vorname" required missing={miss('firstName')}>
          <input {...bind('firstName')} autoComplete="off" required />
        </Field>
        <Field label="Nachname" required missing={miss('lastName')}>
          <input {...bind('lastName')} autoComplete="off" required />
        </Field>
        <Field label="Telefon" required missing={miss('phone')}>
          <input type="tel" {...bind('phone')} placeholder="+49 151 23456789" required />
        </Field>
        <Field label="E-Mail" optional><input type="email" {...bind('email')} /></Field>
      </div>
    );
  }
  if (step === 'address') {
    return (
      <div className="dash-form dash-lead-edit__address">
        <Field label="Straße" required missing={miss('street')}><input {...bind('street')} required /></Field>
        <Field label="Hausnummer" required missing={miss('houseNumber')}><input {...bind('houseNumber')} required /></Field>
        <Field label="PLZ" required missing={miss('zip')}>
          <input {...bind('zip')} inputMode="numeric" maxLength={5} required />
        </Field>
        <Field label="Ort" required missing={miss('city')}><input {...bind('city')} required /></Field>
        <Field label="Bundesland" required full missing={miss('state')}>
          <select {...bind('state')} required>
            <option value="">Bitte wählen</option>
            {ENERGY_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </Field>
      </div>
    );
  }
  if (step === 'need') {
    return (
      <div className="dash-form">
        <Field label="Eigentümerstatus" required missing={miss('ownerStatus')}>
          <input {...bind('ownerStatus')} placeholder="z. B. Eigentümer, Einfamilienhaus" required />
        </Field>
        <Field label="Zeitrahmen" required missing={miss('timeframe')}>
          <input {...bind('timeframe')} placeholder="z. B. in 3–6 Monaten" required />
        </Field>
        <Field label="Bedarf" required full missing={miss('energyNeed')}>
          <input {...bind('energyNeed')} placeholder="Worum geht es dem Kunden?" required />
        </Field>
        <Field label="Gesprächszusammenfassung" required full missing={miss('callSummary')}>
          <textarea rows={3} {...bind('callSummary')} required />
        </Field>
      </div>
    );
  }
  if (step === 'object') {
    return isPv ? (
      <div className="dash-form">
        <Field label="Jahresstromverbrauch" optional>
          <input {...bind('annualConsumption')} placeholder="z. B. 4.500 kWh" />
        </Field>
        <Field label="Bestehende PV-Anlage" required missing={miss('existingPv')}>
          <select {...bind('existingPv')} required>
            <option value="">Bitte wählen</option>
            {EXISTING_PV_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Dach- oder Gebäudehinweise" optional full>
          <textarea rows={3} {...bind('roofNotes')} placeholder="Ausrichtung, Dachform, Verschattung …" />
        </Field>
      </div>
    ) : (
      <div className="dash-form">
        <Field label="Aktuelle Heizung" required missing={miss('heatingSystem')}>
          <input {...bind('heatingSystem')} placeholder="z. B. Gasbrennwert" required />
        </Field>
        <Field label="Energieträger" required missing={miss('energySource')}>
          <input {...bind('energySource')} placeholder="z. B. Gas, Öl" required />
        </Field>
        <Field label="Baujahr oder Gebäudeinfo" optional>
          <input {...bind('constructionYear')} />
        </Field>
        <Field label="Gewünschter Austauschzeitraum" required missing={miss('replacementTimeframe')}>
          <input {...bind('replacementTimeframe')} required />
        </Field>
      </div>
    );
  }
  return (
    <div className="dash-form">
      <Field label="Einwilligungsstatus" required missing={miss('consentStatus')}>
        <input {...bind('consentStatus')} placeholder="z. B. telefonisch erteilt" required />
      </Field>
      <Field label="Nachweisquelle" required missing={miss('evidenceSource')}>
        <input {...bind('evidenceSource')} placeholder="z. B. Gesprächsaufzeichnung" required />
      </Field>
    </div>
  );
}

function EnergyLeadForm({ form, setField, isNew, saving, onSubmit, onCancel }) {
  const selected = ENERGY_PACKAGES.find((item) => item.id === form.packageId) || ENERGY_PACKAGES[0];
  const isPv = selected.product === 'photovoltaic';
  const isAppointment = selected.deliveryType === 'appointment';
  const name = [form.firstName, form.lastName].map((part) => part.trim()).filter(Boolean).join(' ');
  const checks = [
    ['Vor- & Nachname', Boolean(form.firstName.trim() && form.lastName.trim()), 'contact'],
    ...energyChecks({ ...form, energyProduct: selected.product, deliveryType: selected.deliveryType }),
  ];
  const bind = (key) => ({ value: form[key], onChange: (event) => setField(key, event.target.value) });

  function selectPackage(product, deliveryType) {
    const next = energyPackageFor(product, deliveryType);
    if (next) setField('packageId', next.id);
  }

  return (
    <SteppedLeadForm
      kicker={isNew ? (isAppointment ? 'Neuer Energie-Termin' : 'Neuer Energie-Lead') : `${selected.label} bearbeiten`}
      title={name || (isNew ? 'Kontakt anlegen' : '—')}
      submitLabel={isNew ? 'Lead anlegen' : 'Änderungen speichern'}
      saving={saving}
      steps={formSteps(isPv)}
      checks={checks}
      onSubmit={onSubmit}
      onCancel={onCancel}
      renderStep={(step) => (
        <StepFields
          step={step}
          form={form}
          bind={bind}
          selected={selected}
          isPv={isPv}
          isAppointment={isAppointment}
          selectPackage={selectPackage}
        />
      )}
    />
  );
}

export default function EnergyLeadEditor() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useDashboard();
  const [searchParams] = useSearchParams();
  const isNew = !leadId || leadId === 'new';
  const newAppointment = isNew && searchParams.get('delivery') === 'appointment';
  const [form, setForm] = useState(() => (
    newAppointment ? { ...EMPTY, packageId: 'PV_APPOINTMENT' } : EMPTY
  ));
  const [lead, setLead] = useState(null);
  const backTo = returnTo(
    location,
    newAppointment || lead?.deliveryType === 'appointment' ? '/dashboard/termine' : '/dashboard/leads',
  );
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (isNew) {
      setEditing(true);
      return undefined;
    }
    let active = true;
    setEditing(false);
    setLoading(true);
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
  }, [leadId, isNew]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selected = ENERGY_PACKAGES.find((item) => item.id === form.packageId) || ENERGY_PACKAGES[0];
  const isPv = selected.product === 'photovoltaic';
  const isAppointment = selected.deliveryType === 'appointment';

  function startEdit() {
    if (isLeadDeliveryLocked(lead)) {
      setError('Zugestellte Leads können nicht bearbeitet werden.');
      return;
    }
    setNotice('');
    setError('');
    setForm(fromLead(lead));
    setEditing(true);
  }

  function cancelEdit() {
    setError('');
    setNotice('');
    setForm(fromLead(lead));
    setEditing(false);
  }

  async function onDelete() {
    if (isLeadDeliveryLocked(lead)) {
      setError('Zugestellte Leads können nicht gelöscht werden.');
      return;
    }
    if (!window.confirm('Diesen Lead wirklich löschen?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteLead(leadId);
      navigate(backTo);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
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
      if (isNew) {
        const result = await createLead(payload);
        navigate(`/dashboard/leads/energy/${result.lead.id}`, { replace: true, state: location.state });
        return;
      }
      const result = await updateLead(leadId, payload);
      setLead(result.lead);
      setForm(fromLead(result.lead));
      setEditing(false);
      setNotice('Lead gespeichert.');
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const showView = !isNew && lead && !editing;

  return (
    <div className="dash-stack">
      <Link className="dash-back" to={backTo}>
        <ArrowLeft size={16} />
        {returnLabel(backTo)}
      </Link>

      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      {loading ? (
        <div className="dash-empty"><p>Laden…</p></div>
      ) : showView ? (
        <EnergyLeadView
          lead={lead}
          onEdit={startEdit}
          onDelete={onDelete}
          onAssigned={(next) => {
            if (!next) return;
            setLead(next);
            setForm(fromLead(next));
            setNotice('Lead wurde dem Berater zugewiesen.');
            setError('');
            refresh({ silent: true }).catch(() => {});
          }}
          saving={saving}
        />
      ) : (
        <EnergyLeadForm
          form={form}
          setField={setField}
          isNew={isNew}
          saving={saving}
          onSubmit={submit}
          onCancel={isNew ? () => navigate(backTo) : cancelEdit}
        />
      )}
    </div>
  );
}
