import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PhoneField from '../../components/PhoneField';
import { useDashboard } from '../../hooks/useDashboard';
import {
  CONCERN_OPTIONS,
  COVERAGE_OPTIONS,
  EMPLOYMENT_OPTIONS,
  INSURANCE_OPTIONS,
  STATUS_OPTIONS,
  assignLead,
  createLead,
  deleteLead,
  downloadLeadCsvTemplate,
  emptyLeadForm,
  employmentLabel,
  fetchLead,
  fetchLeads,
  formToPayload,
  formatLeadAddress,
  formatLeadDate,
  formatPremium,
  importLeads,
  leadToForm,
  listLabels,
  parseLeadCsv,
  statusLabel,
  toggleListValue,
  updateLead,
} from '../../lib/leads';
import { DashSeg } from './DashboardLayout';
import { formatDate } from './helpers';
import { DEFAULT_LEAD_SCOPE, LEAD_SCOPE_OPTIONS, leadScopeLabel } from '../../lib/scopes';

function statusTone(status) {
  if (status === 'zugewiesen') return 'ok';
  if (status === 'erledigt') return 'muted';
  if (status === 'in_bearbeitung') return 'warn';
  return 'new';
}

const SOURCE_LABELS = {
  csv: 'CSV',
  manual: 'Manuell',
  api: 'API',
};

function leadPlace(lead) {
  return [lead?.zip, lead?.city].filter(Boolean).join(' ') || '';
}

function leadInitials(lead) {
  const first = String(lead?.firstName || '').trim();
  const last = String(lead?.lastName || '').trim();
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'L';
}

function returnTo(location, fallback = '/dashboard/leads') {
  const from = location?.state?.from;
  if (typeof from !== 'string' || !from.startsWith('/dashboard')) return fallback;
  const path = from.split('?')[0];
  if (/^\/dashboard\/leads\/[0-9a-f-]{36}$/i.test(path)) return fallback;
  return from;
}

function returnLabel(path) {
  if (path.startsWith('/dashboard/berater')) return 'Zurück zu Berater';
  if (path.startsWith('/dashboard/reklamationen')) return 'Zurück zu Reklamationen';
  if (path.startsWith('/dashboard/leads/abgelehnt')) return 'Zurück zu Abgelehnt';
  if (path.startsWith('/dashboard/anfordern') || path.startsWith('/dashboard/anfragen')) return 'Zurück zu Anforderungen';
  if (path === '/dashboard' || path.startsWith('/dashboard?')) return 'Zurück zur Übersicht';
  return 'Zurück zur Liste';
}

export function LeadListItem({ lead }) {
  const location = useLocation();
  const place = leadPlace(lead);
  const assigned = lead.assignedToName || lead.assignedToEmail || 'Nicht zugewiesen';
  const insurance = listLabels(lead.insuranceStatus, 'insurance');
  const concerns = listLabels(lead.mainConcerns, 'concern');
  const tags = [insurance !== '—' ? insurance : null, concerns !== '—' ? concerns : null].filter(Boolean);
  const from = `${location.pathname}${location.search}`;

  return (
    <Link className="dash-lead-row" to={`/dashboard/leads/${lead.id}`} state={{ from }}>
      <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
        {leadInitials(lead)}
      </span>
      <div className="dash-lead-row-main">
        <strong>{lead.fullName || '—'}</strong>
        <span className="dash-lead-row-sub">
          {[lead.email, place].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
        </span>
        {tags.length ? <span className="dash-lead-row-tags">{tags.join(' · ')}</span> : null}
      </div>
      <div className="dash-lead-row-side">
        <span className="dash-badge dash-badge--muted">{leadScopeLabel(lead.scope)}</span>
        <span className={`dash-badge dash-badge--${statusTone(lead.status)}`}>
          {statusLabel(lead.status)}
        </span>
        <small>{assigned}</small>
        <small>{formatDate(lead.createdAt)}</small>
      </div>
    </Link>
  );
}

function Fact({ label, children }) {
  return (
    <div className="dash-fact">
      <span>{label}</span>
      <div>{children || '—'}</div>
    </div>
  );
}

function ChipList({ ids, type }) {
  const text = listLabels(ids, type);
  if (!ids?.length || text === '—') {
    return <span className="dash-muted">—</span>;
  }
  return (
    <div className="dash-chips">
      {text.split(', ').map((label) => (
        <span key={label} className="is-active">{label}</span>
      ))}
    </div>
  );
}

function LeadView({
  lead,
  beraters,
  assignedTo,
  setAssignedTo,
  onAssign,
  onEdit,
  onDelete,
  saving,
}) {
  const address = formatLeadAddress(lead);
  const employment = lead.employmentStatus === 'sonstiges' && lead.employmentOther
    ? lead.employmentOther
    : employmentLabel(lead.employmentStatus);

  return (
    <div className="dash-lead-view">
      <section className="dash-panel dash-lead-hero">
        <div className="dash-lead-identity">
          <span className="dash-lead-avatar" aria-hidden="true">{leadInitials(lead)}</span>
          <div>
            <div className="dash-lead-kicker">Lead</div>
            <h3>{lead.fullName || '—'}</h3>
            <p>{address}</p>
            <div className="dash-lead-hero-meta">
              <span className={`dash-badge dash-badge--${statusTone(lead.status)}`}>
                {statusLabel(lead.status)}
              </span>
              <span className="dash-badge dash-badge--muted">{leadScopeLabel(lead.scope)}</span>
              <span>{lead.assignedToName || lead.assignedToEmail || 'Nicht zugewiesen'}</span>
            </div>
          </div>
        </div>
        <div className="dash-intro-actions">
          <button type="button" className="dash-btn" onClick={onEdit}>Bearbeiten</button>
          <button type="button" className="dash-btn dash-btn--danger" onClick={onDelete} disabled={saving}>
            Löschen
          </button>
        </div>
      </section>

      <div className="dash-lead-grid">
        <section className="dash-panel">
          <div className="dash-panel-head"><strong>Kontakt</strong></div>
          <div className="dash-facts">
            <Fact label="Telefon">
              {lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : '—'}
            </Fact>
            <Fact label="E-Mail">
              {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}
            </Fact>
            <Fact label="Geburtsdatum">{formatLeadDate(lead.dateOfBirth)}</Fact>
            <Fact label="Berufliche Situation">{employment}</Fact>
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel-head"><strong>Versicherung</strong></div>
          <div className="dash-facts">
            <Fact label="Status"><ChipList ids={lead.insuranceStatus} type="insurance" /></Fact>
            <Fact label="Gesellschaft">{lead.currentInsurer || '—'}</Fact>
            <Fact label="Beitrag / Monat">{formatPremium(lead.monthlyPremium)}</Fact>
            <Fact label="Personenkreis"><ChipList ids={lead.coverageCircle} type="coverage" /></Fact>
          </div>
        </section>
      </div>

      <section className="dash-panel">
        <div className="dash-panel-head"><strong>Hauptanliegen</strong></div>
        <ChipList ids={lead.mainConcerns} type="concern" />
      </section>

      <section className="dash-panel">
        <div className="dash-panel-head"><strong>Gesprächsnotizen</strong></div>
        {lead.notes ? <p className="dash-lead-notes">{lead.notes}</p> : <p className="dash-muted">Keine Notizen.</p>}
      </section>

      <section className="dash-panel">
        <div className="dash-panel-head"><strong>Zuweisung</strong></div>
        <div className="dash-form dash-form--assign">
          <label>
            Berater
            <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              <option value="">Nicht zugewiesen</option>
              {beraters.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName || user.email}
                </option>
              ))}
            </select>
          </label>
          <div className="dash-assign-meta">
            <span>Paket: {leadScopeLabel(lead.scope)}</span>
            <span>Quelle: {SOURCE_LABELS[lead.source] || lead.source || '—'}</span>
            <span>Angelegt {formatDate(lead.createdAt)}</span>
          </div>
        </div>
        <div className="dash-form-actions">
          <button type="button" className="dash-btn" onClick={onAssign} disabled={saving}>
            {saving ? 'Speichern…' : assignedTo ? 'Zuweisen' : 'Zuweisung entfernen'}
          </button>
        </div>
      </section>
    </div>
  );
}

function CheckGroup({ legend, options, values, onToggle }) {
  return (
    <fieldset className="dash-checks is-full">
      <legend>{legend}</legend>
      <div>
        {options.map((option) => (
          <label key={option.id}>
            <input
              type="checkbox"
              checked={values.includes(option.id)}
              onChange={() => onToggle(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function LeadFormFields({ form, setForm }) {
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="dash-form">
      <label className="is-full">
        Paket
        <select
          value={form.scope || DEFAULT_LEAD_SCOPE}
          onChange={(event) => setField('scope', event.target.value)}
          required
        >
          {LEAD_SCOPE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        Vorname
        <input value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} required />
      </label>
      <label>
        Nachname
        <input value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} required />
      </label>
      <label>
        Geburtsdatum
        <input type="date" value={form.dateOfBirth} onChange={(event) => setField('dateOfBirth', event.target.value)} />
      </label>
      <label>
        Berufliche Situation
        <select
          value={form.employmentStatus}
          onChange={(event) => setField('employmentStatus', event.target.value)}
        >
          <option value="">Bitte wählen</option>
          {EMPLOYMENT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      {form.employmentStatus === 'sonstiges' ? (
        <label className="is-full">
          Berufliche Situation, sonstiges
          <input
            value={form.employmentOther}
            onChange={(event) => setField('employmentOther', event.target.value)}
          />
        </label>
      ) : null}
      <label>
        E-Mail-Adresse
        <input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} />
      </label>
      <label>
        Mobilnummer / Telefon
        <PhoneField value={form.phone} onChange={(value) => setField('phone', value)} />
      </label>
      <CheckGroup
        legend="Versicherungsstatus"
        options={INSURANCE_OPTIONS}
        values={form.insuranceStatus}
        onToggle={(id) => setField('insuranceStatus', toggleListValue(form.insuranceStatus, id))}
      />
      <label>
        Aktuelle Gesellschaft / Krankenkasse
        <input value={form.currentInsurer} onChange={(event) => setField('currentInsurer', event.target.value)} />
      </label>
      <label>
        Monatlicher Beitrag (€)
        <input
          inputMode="decimal"
          value={form.monthlyPremium}
          onChange={(event) => setField('monthlyPremium', event.target.value)}
          placeholder="z. B. 420"
        />
      </label>
      <CheckGroup
        legend="Personenkreis"
        options={COVERAGE_OPTIONS}
        values={form.coverageCircle}
        onToggle={(id) => setField('coverageCircle', toggleListValue(form.coverageCircle, id))}
      />
      <CheckGroup
        legend="Hauptanliegen"
        options={CONCERN_OPTIONS}
        values={form.mainConcerns}
        onToggle={(id) => setField('mainConcerns', toggleListValue(form.mainConcerns, id))}
      />
      <label>
        PLZ
        <input value={form.zip} onChange={(event) => setField('zip', event.target.value)} maxLength={5} />
      </label>
      <label>
        Ort
        <input value={form.city} onChange={(event) => setField('city', event.target.value)} />
      </label>
      <label className="is-full">
        Straße (freiwillig)
        <input value={form.street} onChange={(event) => setField('street', event.target.value)} />
      </label>
      <label className="is-full">
        Gesprächsnotizen
        <textarea
          rows={4}
          value={form.notes}
          onChange={(event) => setField('notes', event.target.value)}
        />
      </label>
    </div>
  );
}

export function AdminLeads() {
  const { admin } = useDashboard();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('');
  const [importing, setImporting] = useState(false);

  const beraters = useMemo(
    () => (admin?.directory || []).filter((user) => user.role === 'berater'),
    [admin?.directory],
  );

  async function load(next = {}) {
    const nextStatus = next.status ?? status;
    const nextAssigned = next.assignedTo ?? assignedTo;
    const nextSearch = next.search ?? search;
    const nextScope = next.scope ?? scope;
    setLoading(true);
    setError('');
    try {
      const payload = await fetchLeads({
        status: nextStatus,
        assignedTo: nextAssigned,
        search: nextSearch,
        scope: nextScope,
      });
      setLeads(payload.leads || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLeads()
      .then((payload) => {
        if (active) setLeads(payload.leads || []);
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
  }, []);

  async function onImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const rows = await parseLeadCsv(file);
      const result = await importLeads(rows);
      const skipped = result.errors?.length || 0;
      if (!result.createdCount && !skipped) {
        setNotice('Keine gültigen Zeilen in der CSV-Datei gefunden.');
      } else {
        setNotice(
          skipped
            ? `${result.createdCount} Lead${result.createdCount === 1 ? '' : 's'} importiert, ${skipped} Zeile${skipped === 1 ? '' : 'n'} übersprungen.`
            : `${result.createdCount} Lead${result.createdCount === 1 ? '' : 's'} importiert.`,
        );
      }
      if (skipped) {
        setError(result.errors.map((entry) => `Zeile ${entry.row}: ${entry.message}`).join(' '));
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="dash-stack">
      <div className="dash-toolbar dash-toolbar--end">
        <div className="dash-intro-actions">
          <button type="button" className="dash-btn dash-btn--ghost" onClick={downloadLeadCsvTemplate}>
            CSV-Vorlage
          </button>
          <label className="dash-btn dash-btn--ghost dash-file-btn">
            {importing ? 'Importiere…' : 'CSV importieren'}
            <input type="file" accept=".csv,text/csv" onChange={onImport} disabled={importing} />
          </label>
          <Link className="dash-btn" to="/dashboard/leads/new">Neuer Lead</Link>
        </div>
      </div>

      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <section className="dash-panel">
        <div className="dash-toolbar">
          <DashSeg
            value={status || 'all'}
            onChange={(id) => {
              const next = id === 'all' ? '' : id;
              setStatus(next);
              load({ status: next });
            }}
            options={[
              { id: 'all', label: 'Alle' },
              ...STATUS_OPTIONS.map((option) => ({ id: option.id, label: option.label })),
            ]}
          />
        </div>
        <div className="dash-filters">
          <label>
            Suche
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') load({ search: event.target.value });
              }}
              placeholder="Name, E-Mail, Ort, PLZ"
            />
          </label>
          <label>
            Paket
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value);
                load({ scope: event.target.value });
              }}
            >
              <option value="">Alle Pakete</option>
              {LEAD_SCOPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Zuweisung
            <select
              value={assignedTo}
              onChange={(event) => {
                setAssignedTo(event.target.value);
                load({ assignedTo: event.target.value });
              }}
            >
              <option value="">Alle</option>
              <option value="unassigned">Nicht zugewiesen</option>
              {beraters.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName || user.email}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="dash-btn dash-btn--ghost" onClick={() => load()}>
            Anwenden
          </button>
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : leads.length ? (
          <div className="dash-lead-list">
            {leads.map((lead) => (
              <LeadListItem key={lead.id} lead={lead} />
            ))}
          </div>
        ) : (
          <div className="dash-empty">
            <p>Noch keine Leads. Legen Sie einen an oder importieren Sie eine CSV-Datei.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminLeadEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = returnTo(location);
  const isNew = !id || id === 'new';
  const { admin } = useDashboard();
  const [form, setForm] = useState(emptyLeadForm);
  const [lead, setLead] = useState(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const beraters = useMemo(
    () => (admin?.directory || []).filter((user) => user.role === 'berater'),
    [admin?.directory],
  );

  useEffect(() => {
    if (isNew) {
      setEditing(true);
      return undefined;
    }
    let active = true;
    setEditing(false);
    setLoading(true);
    fetchLead(id)
      .then((payload) => {
        if (!active) return;
        setLead(payload.lead);
        setForm(leadToForm(payload.lead));
        setAssignedTo(payload.lead.assignedTo || '');
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
  }, [id, isNew]);

  function startEdit() {
    setNotice('');
    setError('');
    setForm(leadToForm(lead));
    setEditing(true);
  }

  function cancelEdit() {
    setError('');
    setNotice('');
    setForm(leadToForm(lead));
    setEditing(false);
  }

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = formToPayload(form);
      if (isNew) {
        const created = await createLead(payload);
        navigate(`/dashboard/leads/${created.lead.id}`, { replace: true, state: location.state });
        return;
      }
      const updated = await updateLead(id, payload);
      setLead(updated.lead);
      setForm(leadToForm(updated.lead));
      setAssignedTo(updated.lead.assignedTo || '');
      setEditing(false);
      setNotice('Lead gespeichert.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onAssign() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await assignLead(id, assignedTo || null);
      setLead(updated.lead);
      setForm(leadToForm(updated.lead));
      setAssignedTo(updated.lead.assignedTo || '');
      setNotice(updated.lead.assignedTo ? 'Lead zugewiesen.' : 'Zuweisung entfernt.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm('Diesen Lead wirklich löschen?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteLead(id);
      navigate(backTo);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const subtitle = isNew
    ? 'Qualifizierten Kontakt manuell anlegen.'
    : (editing ? 'Daten anpassen und speichern.' : 'Kontakt prüfen und an einen Berater übergeben.');

  return (
    <div className="dash-stack">
      <Link className="dash-back" to={backTo}>
        <ArrowLeft size={16} />
        {returnLabel(backTo)}
      </Link>

      {isNew || editing ? (
        <p className="dash-lede">{subtitle}</p>
      ) : null}

      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      {loading ? (
        <div className="dash-empty"><p>Laden…</p></div>
      ) : !isNew && lead && !editing ? (
        <LeadView
          lead={lead}
          beraters={beraters}
          assignedTo={assignedTo}
          setAssignedTo={setAssignedTo}
          onAssign={onAssign}
          onEdit={startEdit}
          onDelete={onDelete}
          saving={saving}
        />
      ) : (
        <form className="dash-panel dash-lead-form" onSubmit={onSave}>
          <LeadFormFields form={form} setForm={setForm} />

          {!isNew ? (
            <div className="dash-form dash-form--workflow">
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="dash-form-actions">
            <button type="submit" className="dash-btn" disabled={saving}>
              {saving ? 'Speichern…' : isNew ? 'Lead anlegen' : 'Speichern'}
            </button>
            {!isNew ? (
              <button type="button" className="dash-btn dash-btn--ghost" onClick={cancelEdit} disabled={saving}>
                Abbrechen
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
