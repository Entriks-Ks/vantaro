import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, FileText, X } from 'lucide-react';
import {
  complaintReasonLabel,
  complaintStatusLabel,
  complaintStatusTone,
  contactStatusLabel,
  fetchComplaints,
  markComplaintsSeen,
  reviewComplaint,
} from '../../lib/complaints';
import { employmentLabel, fetchLeads, formatLeadAddress, listLabels } from '../../lib/leads';
import { DEFAULT_LEAD_SCOPE, leadScopeLabel } from '../../lib/scopes';
import { useDashboard } from '../../hooks/useDashboard';
import { leadPurchaseCents } from './packages';
import { DashSeg } from './DashboardLayout';
import { ComplaintReplacementStatus, isReplacementPending } from './ComplaintReplacementStatus';
import { formatDate, formatDateTime, formatEuroExact, initials } from './helpers';

function beraterName(complaint) {
  return complaint.berater?.fullName || complaint.berater?.email || 'Unbekannt';
}

function beraterPhone(complaint) {
  return String(complaint.berater?.phone || '').trim();
}

function beraterTelHref(phone) {
  const cleaned = phone.replace(/\s/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function Field({ label, children }) {
  const value = children == null || children === '' ? '—' : children;
  return (
    <div className="dash-drawer-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function phoneHref(phone) {
  const cleaned = String(phone || '').replace(/\s/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function complaintFullCents(complaint) {
  const fromSnapshot = Number(complaint?.snapshot?.priceCents);
  if (Number.isFinite(fromSnapshot) && fromSnapshot > 0) return Math.round(fromSnapshot);
  return leadPurchaseCents(complaint?.lead || {});
}

function eurosToCents(value) {
  const normalized = String(value || '').trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros <= 0) return null;
  return Math.round(euros * 100);
}

function centsToEuroInput(cents) {
  const amount = Number(cents) || 0;
  return (amount / 100).toFixed(2).replace('.', ',');
}

function isProofImage(dataUrl) {
  return /^data:image\//i.test(String(dataUrl || ''));
}

function isProofPdf(dataUrl) {
  return /^data:application\/pdf/i.test(String(dataUrl || ''));
}

function complaintScope(complaint) {
  return complaint?.request?.scope || complaint?.lead?.scope || '';
}

function snapshotEmployment(snapshot) {
  if (!snapshot) return '';
  if (snapshot.employmentStatus === 'sonstiges' && snapshot.employmentOther) {
    return snapshot.employmentOther;
  }
  return employmentLabel(snapshot.employmentStatus);
}

function DrawerSection({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`dash-drawer-section${open ? ' is-open' : ''}`}>
      <button type="button" className="dash-drawer-section-toggle" onClick={() => setOpen((value) => !value)}>
        <span>
          <b>{title}</b>
          {!open && summary ? <em>{summary}</em> : null}
        </span>
        <ChevronDown size={16} />
      </button>
      {open ? <div className="dash-drawer-section-body">{children}</div> : null}
    </section>
  );
}

function ComplaintEvidence({ complaint }) {
  const snapshot = complaint.snapshot;
  const contact = complaint.contactStatus || snapshot?.contactStatus;
  const proofName = complaint.proofName || 'Nachweis';
  const proofData = complaint.proofData;
  const brokerNotes = String(snapshot?.brokerNotes || '').trim();
  const stockNotes = String(snapshot?.notes || '').trim();
  const insurance = listLabels(snapshot?.insuranceStatus, 'insurance');
  const concerns = listLabels(snapshot?.mainConcerns, 'concern');
  const coverage = listLabels(snapshot?.coverageCircle, 'coverage');
  const talk = [
    snapshot?.phone,
    snapshot?.email,
    snapshotEmployment(snapshot),
    insurance !== '—' ? insurance : '',
  ].filter(Boolean).join(' · ') || 'Keine Gesprächsdaten hinterlegt';

  const hasSnapshot = Boolean(snapshot);
  const hasProof = Boolean(proofData || proofName);

  if (!hasSnapshot && !hasProof && !contact && !complaint.comment) return null;

  return (
    <div className="dash-complaint-evidence">
      <div className="dash-drawer-fields dash-drawer-fields--stack">
        <Field label="Kontaktstatus">{contactStatusLabel(contact)}</Field>
        <Field label="Kaufpreis">{formatEuroExact(complaintFullCents(complaint))}</Field>
        {snapshot?.assignedAt ? (
          <Field label="Übergabe">{formatDateTime(snapshot.assignedAt)}</Field>
        ) : null}
      </div>

      {hasSnapshot ? (
        <div className="dash-complaint-snapshot">
          <p className="dash-complaint-snapshot__label">Snapshot bei Einreichung</p>
          <p className="dash-complaint-snapshot__talk">{talk}</p>
          {concerns && concerns !== '—' ? (
            <p className="dash-complaint-snapshot__meta"><span>Anliegen</span>{concerns}</p>
          ) : null}
          {coverage && coverage !== '—' ? (
            <p className="dash-complaint-snapshot__meta"><span>Absicherung</span>{coverage}</p>
          ) : null}
          <p className="dash-complaint-snapshot__notes">
            <span>Notizen</span>
            {brokerNotes || stockNotes || 'Keine Notizen'}
            {brokerNotes && stockNotes && brokerNotes !== stockNotes ? (
              <small>Bestand: {stockNotes}</small>
            ) : null}
          </p>
        </div>
      ) : null}

      {proofData ? (
        <div className="dash-complaint-proof">
          <p className="dash-complaint-proof__label">Nachweis vom Berater</p>
          {isProofImage(proofData) ? (
            <a
              className="dash-complaint-proof__image"
              href={proofData}
              target="_blank"
              rel="noreferrer"
              title={proofName}
            >
              <img src={proofData} alt={proofName} />
            </a>
          ) : null}
          <a
            className="dash-btn dash-btn--ghost dash-btn--compact"
            href={proofData}
            download={proofName}
            target="_blank"
            rel="noreferrer"
          >
            <FileText size={14} aria-hidden="true" />
            {isProofPdf(proofData) ? `PDF öffnen · ${proofName}` : proofName}
          </a>
        </div>
      ) : complaint.proofName ? (
        <p className="dash-panel-note">Nachweis genannt: {complaint.proofName} (Datei nicht verfügbar)</p>
      ) : null}
    </div>
  );
}

function ComplaintDrawer({
  complaint,
  pool,
  saving,
  adminNote,
  replaceId,
  partialEuro,
  onAdminNote,
  onReplaceId,
  onPartialEuro,
  onRun,
  onClose,
  from,
}) {
  const lead = complaint.lead;
  const decidable = complaint.status === 'pending' || complaint.status === 'info_needed';
  const requiredScope = complaintScope(complaint) || DEFAULT_LEAD_SCOPE;
  const scopedPool = useMemo(() => {
    return pool.filter((item) => (item.scope || DEFAULT_LEAD_SCOPE) === requiredScope);
  }, [pool, requiredScope]);
  const canReplace = Boolean(complaint.requestId) && scopedPool.length > 0
    && (complaint.request?.status === 'active' || complaint.request?.status === 'completed' || !complaint.request);
  const replacements = scopedPool.slice(0, 5);
  const address = lead ? formatLeadAddress(lead) : '';
  const leadSummary = (address && address !== '—' ? address : null)
    || lead?.email
    || lead?.phone
    || 'Kontaktdaten';
  const selectedReplace = replacements.find((item) => item.id === replaceId)
    || (replaceId ? scopedPool.find((item) => item.id === replaceId) : null);
  const replaceSummary = selectedReplace?.fullName
    || (canReplace ? `Optional · ${Math.min(5, scopedPool.length)} von ${scopedPool.length}` : 'Kein freier Lead');
  const beraterPath = complaint.beraterId ? `/dashboard/berater/${complaint.beraterId}` : '';
  const beraterTel = beraterTelHref(beraterPhone(complaint));
  const fullCents = complaintFullCents(complaint);
  const noteRequired = !adminNote.trim();
  const partialCents = eurosToCents(partialEuro);
  const evidenceSummary = [
    contactStatusLabel(complaint.contactStatus || complaint.snapshot?.contactStatus),
    complaint.proofData || complaint.proofName ? 'Nachweis' : '',
  ].filter((value) => value && value !== '—').join(' · ') || 'Eingereichte Angaben';

  return (
    <div className="dash-drawer-root">
      <button type="button" className="dash-drawer-overlay" aria-label="Details schließen" onClick={onClose} />
      <aside className="dash-drawer dash-drawer--complaint" aria-labelledby="complaint-drawer-title">
        <div className="dash-drawer-head">
          <div className="dash-drawer-who">
            <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
              {initials({ fullName: lead?.fullName || beraterName(complaint) })}
            </span>
            <div>
              <div className="dash-lead-kicker">Reklamation</div>
              <h3 id="complaint-drawer-title">{lead?.fullName || 'Lead'}</h3>
              <small>
                {complaint.beraterId ? (
                  <Link to={`/dashboard/berater/${complaint.beraterId}`}>{beraterName(complaint)}</Link>
                ) : beraterName(complaint)}
                {' · '}
                {formatDate(complaint.createdAt)}
              </small>
            </div>
          </div>
          <button type="button" className="dash-drawer-close" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="dash-drawer-body">
          <div className="dash-drawer-chips">
            <span className={`dash-badge dash-badge--${complaintStatusTone(complaint.status)}`}>
              {complaintStatusLabel(complaint.status)}
            </span>
            {complaint.refundCents != null ? (
              <span className="dash-badge dash-badge--ok">
                Gutschrift {formatEuroExact(complaint.refundCents)}
              </span>
            ) : null}
            {requiredScope ? (
              <span className="dash-badge dash-badge--muted">{leadScopeLabel(requiredScope)}</span>
            ) : null}
          </div>

          <p className="dash-complaint-reason">{complaintReasonLabel(complaint.reason)}</p>

          {complaint.comment ? (
            <blockquote className="dash-complaint-quote">
              <span>Notiz vom Berater</span>
              {complaint.comment}
            </blockquote>
          ) : null}

          {complaint.adminNote ? (
            <blockquote className="dash-complaint-quote dash-complaint-quote--admin">
              <span>Notiz vom Admin</span>
              {complaint.adminNote}
            </blockquote>
          ) : null}

          <ComplaintReplacementStatus complaint={complaint} from={from} />

          <div className="dash-drawer-accordions" key={complaint.id}>
            <DrawerSection title="Eingereichte Angaben" summary={evidenceSummary} defaultOpen>
              <ComplaintEvidence complaint={complaint} />
            </DrawerSection>

            <DrawerSection title="Lead" summary={leadSummary}>
              <div className="dash-drawer-fields dash-drawer-fields--stack">
                <Field label="Adresse">{address}</Field>
                <Field label="E-Mail">
                  {lead?.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null}
                </Field>
                <Field label="Telefon">
                  {lead?.phone ? <a href={phoneHref(lead.phone)}>{lead.phone}</a> : null}
                </Field>
                <Field label="Zugestellt">{formatDateTime(lead?.assignedAt)}</Field>
              </div>
            </DrawerSection>

            {decidable ? (
              <DrawerSection title="Ersatzlead" summary={replaceSummary}>
                {canReplace ? (
                  <div className="dash-replace-block">
                    <p className="dash-panel-note">
                      Scope {leadScopeLabel(requiredScope)} · max. 5 freie Leads hier.
                      Anderen Ersatz über Leads wählen.
                    </p>
                    <div className="dash-pick-list dash-pick-list--drawer">
                      {replacements.map((item) => (
                        <label key={item.id} className={`dash-pick-row${replaceId === item.id ? ' is-checked' : ''}`}>
                          <input
                            type="radio"
                            name={`replace-${complaint.id}`}
                            checked={replaceId === item.id}
                            onChange={() => onReplaceId(item.id)}
                            disabled={Boolean(saving)}
                          />
                          <span>
                            <strong>{item.fullName}</strong>
                            <small>
                              {[formatLeadAddress(item), listLabels(item.insuranceStatus, 'insurance')]
                                .filter((value) => value && value !== '—')
                                .join(' · ')}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                    {replaceId ? (
                      <button type="button" className="dash-text-btn" onClick={() => onReplaceId('')}>
                        Ohne Ersatz erstatten
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="dash-panel-note">
                    Kein freier Lead mit Scope {leadScopeLabel(requiredScope)}.
                    Ersatz können Sie nach der Erstattung über Leads senden.
                  </p>
                )}
              </DrawerSection>
            ) : null}
          </div>

          {decidable ? (
            <div className="dash-complaint-decide">
              <label className="dash-decline-note">
                Notiz an den Berater
                <textarea
                  rows={2}
                  value={adminNote}
                  onChange={(event) => onAdminNote(event.target.value)}
                  placeholder="Pflicht bei Ablehnung oder Infos anfordern."
                  disabled={Boolean(saving)}
                />
              </label>
              <label className="dash-decline-note">
                Teilgutschrift (EUR)
                <input
                  type="text"
                  inputMode="decimal"
                  value={partialEuro}
                  onChange={(event) => onPartialEuro(event.target.value)}
                  placeholder={centsToEuroInput(Math.round(fullCents / 2))}
                  disabled={Boolean(saving)}
                />
                <small className="dash-complaint-decide__hint">
                  Vollbetrag {formatEuroExact(fullCents)}. Leer = Hälfte.
                </small>
              </label>
            </div>
          ) : null}
        </div>

        <div className={`dash-drawer-actions${decidable ? ' dash-drawer-actions--decide dash-drawer-actions--decide-wide' : ''}`}>
          {decidable ? (
            <>
              <button
                type="button"
                className="dash-btn dash-btn--ok"
                disabled={Boolean(saving)}
                onClick={() => onRun(
                  complaint.id,
                  {
                    status: 'approved',
                    note: adminNote || undefined,
                    replaceLeadId: replaceId || undefined,
                  },
                  replaceId
                    ? 'Erstattet und Ersatzlead gesendet. Der alte Lead liegt unter Ungültige Leads.'
                    : 'Erstattet. Der Lead liegt unter Ungültige Leads, sobald ein Ersatz gesendet wurde.',
                )}
              >
                {replaceId ? 'Erstatten + Ersatz' : 'Erstatten'}
              </button>
              <button
                type="button"
                className="dash-btn dash-btn--ghost"
                disabled={Boolean(saving) || (partialEuro.trim() !== '' && partialCents == null)}
                onClick={() => onRun(
                  complaint.id,
                  {
                    status: 'partial',
                    note: adminNote || undefined,
                    refundCents: partialCents || undefined,
                    replaceLeadId: replaceId || undefined,
                  },
                  replaceId
                    ? 'Teilweise erstattet und Ersatzlead gesendet.'
                    : `Teilweise erstattet${partialCents ? ` (${formatEuroExact(partialCents)})` : ''}.`,
                )}
              >
                Teilweise
              </button>
              <button
                type="button"
                className="dash-btn dash-btn--ghost"
                disabled={Boolean(saving) || noteRequired}
                onClick={() => onRun(
                  complaint.id,
                  { status: 'info_needed', note: adminNote },
                  'Weitere Informationen angefordert. Der Berater sieht die Notiz.',
                )}
              >
                Infos anfordern
              </button>
              <button
                type="button"
                className="dash-btn dash-btn--danger"
                disabled={Boolean(saving) || noteRequired}
                onClick={() => onRun(
                  complaint.id,
                  { status: 'declined', note: adminNote },
                  'Erstattung abgelehnt. Der Berater sieht die Notiz.',
                )}
              >
                Ablehnen
              </button>
              {beraterPath ? (
                <>
                  <Link className="dash-btn dash-btn--ghost" to={beraterPath}>
                    Berater öffnen
                  </Link>
                  {beraterTel ? (
                    <a className="dash-btn dash-btn--ghost" href={beraterTel}>
                      Berater anrufen
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="dash-btn dash-btn--ghost"
                      disabled
                      title="Keine Telefonnummer hinterlegt"
                    >
                      Berater anrufen
                    </button>
                  )}
                </>
              ) : null}
            </>
          ) : beraterPath ? (
            <>
              <Link className="dash-btn dash-btn--ghost" to={beraterPath}>
                Berater öffnen
              </Link>
              {beraterTel ? (
                <a className="dash-btn dash-btn--ghost" href={beraterTel}>
                  Berater anrufen
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function AdminComplaints() {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const { refresh: refreshDashboard } = useDashboard();
  const [complaints, setComplaints] = useState([]);
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [filter, setFilter] = useState('pending');
  const [selectedId, setSelectedId] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [replaceId, setReplaceId] = useState('');
  const [partialEuro, setPartialEuro] = useState('');

  async function load() {
    const [complaintPayload, leadPayload] = await Promise.all([
      fetchComplaints(),
      fetchLeads({ assignedTo: 'unassigned' }),
    ]);
    setComplaints(complaintPayload.complaints || []);
    setPool((leadPayload.leads || []).filter((lead) => lead.status !== 'erledigt' && !lead.refundedAt));
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then(async () => {
        if (!active) return;
        try {
          await markComplaintsSeen();
          await refreshDashboard({ silent: true });
        } catch {
          /* next poll corrects badge */
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
  }, [refreshDashboard]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setSelectedId('');
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [selectedId]);

  const visible = useMemo(() => {
    if (filter === 'all') return complaints;
    if (filter === 'credited') {
      return complaints.filter((entry) => entry.status === 'approved' || entry.status === 'partial');
    }
    return complaints.filter((entry) => entry.status === filter);
  }, [complaints, filter]);

  const counts = useMemo(() => ({
    pending: complaints.filter((entry) => entry.status === 'pending').length,
    info_needed: complaints.filter((entry) => entry.status === 'info_needed').length,
    credited: complaints.filter((entry) => entry.status === 'approved' || entry.status === 'partial').length,
    declined: complaints.filter((entry) => entry.status === 'declined').length,
  }), [complaints]);

  const selected = complaints.find((entry) => entry.id === selectedId) || null;
  const drawerOpen = Boolean(selected);

  async function run(id, payload, success) {
    setSaving(id);
    setError('');
    setNotice('');
    try {
      const result = await reviewComplaint(id, payload);
      await load();
      refreshDashboard({ silent: true }).catch(() => {});
      setAdminNote('');
      setReplaceId('');
      setPartialEuro('');
      setSelectedId('');
      if (result.replaceError) {
        setNotice(`${success} Ersatz: ${result.replaceError}`);
      } else if (success) {
        setNotice(success);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  function openComplaint(id) {
    const entry = complaints.find((item) => item.id === id);
    setSelectedId(id);
    setAdminNote(entry?.status === 'info_needed' ? (entry.adminNote || '') : '');
    setReplaceId('');
    setPartialEuro(centsToEuroInput(Math.round(complaintFullCents(entry) / 2)));
  }

  return (
    <div className="dash-stack">
      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <div className="dash-metrics dash-metrics--four">
        <div className="dash-metric dash-metric--signal">
          <span>In Prüfung</span>
          <strong>{loading ? '—' : counts.pending}</strong>
          <small>warten auf Entscheidung</small>
        </div>
        <div className="dash-metric">
          <span>Infos nötig</span>
          <strong>{loading ? '—' : counts.info_needed}</strong>
          <small>Berater ergänzt</small>
        </div>
        <div className="dash-metric">
          <span>Erstattet</span>
          <strong>{loading ? '—' : counts.credited}</strong>
          <small>voll / teilweise</small>
        </div>
        <div className="dash-metric">
          <span>Abgelehnt</span>
          <strong>{loading ? '—' : counts.declined}</strong>
          <small>bleiben beim Berater</small>
        </div>
      </div>

      <section className="dash-panel">
        <div className="dash-toolbar">
          <DashSeg
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'pending', label: 'In Prüfung', count: loading ? null : counts.pending },
              { id: 'info_needed', label: 'Infos nötig', count: loading ? null : counts.info_needed },
              { id: 'credited', label: 'Erstattet', count: loading ? null : counts.credited },
              { id: 'declined', label: 'Abgelehnt', count: loading ? null : counts.declined },
              { id: 'all', label: 'Alle', count: loading ? null : complaints.length },
            ]}
          />
          <Link className="dash-btn dash-btn--ghost" to="/dashboard/leads/ungueltig">
            Ungültige Leads
          </Link>
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : visible.length ? (
          <div className="dash-lead-list">
            {visible.map((entry) => {
              const lead = entry.lead;
              const credited = entry.status === 'approved' || entry.status === 'partial';
              return (
                <article
                  key={entry.id}
                  className={`dash-lead-row dash-complaint-row is-${entry.status}${selectedId === entry.id ? ' is-selected' : ''}`}
                  onClick={() => openComplaint(entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openComplaint(entry.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
                    {initials({ fullName: lead?.fullName || beraterName(entry) })}
                  </span>
                  <div className="dash-lead-row-main">
                    <strong>{lead?.fullName || 'Lead'}</strong>
                    <span className="dash-lead-row-sub">
                      {beraterName(entry)}
                      {entry.berater?.company ? ` · ${entry.berater.company}` : ''}
                    </span>
                    <span className="dash-lead-row-tags">
                      {complaintReasonLabel(entry.reason)}
                      {entry.proofData || entry.proofName ? ' · Nachweis' : ''}
                      {entry.contactStatus ? ` · ${contactStatusLabel(entry.contactStatus)}` : ''}
                    </span>
                  </div>
                  <div className="dash-request-meta">
                    <div className="dash-request-meta__info">
                      <span className={`dash-badge dash-badge--${complaintStatusTone(entry.status)}`}>
                        {complaintStatusLabel(entry.status)}
                      </span>
                      <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                    </div>
                    {credited && (isReplacementPending(entry) || entry.replacementLead) ? (
                      <div className="dash-request-meta__controls">
                        {isReplacementPending(entry) ? (
                          <span className="dash-badge dash-badge--warn">Ersatz offen</span>
                        ) : null}
                        {entry.replacementLead ? (
                          <span className="dash-badge dash-badge--ok">Ersatz gesendet</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dash-empty">
            <p>Keine Reklamationen für diesen Filter.</p>
          </div>
        )}
      </section>

      {drawerOpen ? (
        <ComplaintDrawer
          key={selected.id}
          complaint={selected}
          pool={pool}
          saving={saving}
          adminNote={adminNote}
          replaceId={replaceId}
          partialEuro={partialEuro}
          onAdminNote={setAdminNote}
          onReplaceId={setReplaceId}
          onPartialEuro={setPartialEuro}
          onRun={run}
          onClose={() => setSelectedId('')}
          from={from}
        />
      ) : null}
    </div>
  );
}
