import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import {
  complaintReasonLabel,
  complaintStatusLabel,
  complaintStatusTone,
  fetchComplaints,
  reviewComplaint,
} from '../../lib/complaints';
import { fetchLeads, formatLeadAddress, listLabels } from '../../lib/leads';
import { DashSeg } from './DashboardLayout';
import { ComplaintReplacementStatus, isReplacementPending } from './ComplaintReplacementStatus';
import { formatDate, formatDateTime, initials } from './helpers';

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

function ComplaintDrawer({
  complaint,
  pool,
  saving,
  declineNote,
  replaceId,
  onDeclineNote,
  onReplaceId,
  onRun,
  onClose,
  from,
}) {
  const lead = complaint.lead;
  const pending = complaint.status === 'pending';
  const canReplace = Boolean(complaint.requestId) && pool.length > 0
    && (complaint.request?.status === 'active' || complaint.request?.status === 'completed' || !complaint.request);
  const replacements = pool.slice(0, 5);
  const address = lead ? formatLeadAddress(lead) : '';
  const leadSummary = (address && address !== '—' ? address : null)
    || lead?.email
    || lead?.phone
    || 'Kontaktdaten';
  const selectedReplace = replacements.find((item) => item.id === replaceId)
    || (replaceId ? pool.find((item) => item.id === replaceId) : null);
  const replaceSummary = selectedReplace?.fullName || (canReplace ? `Optional · ${Math.min(5, pool.length)} von ${pool.length}` : 'Kein freier Lead');
  const beraterPath = complaint.beraterId ? `/dashboard/berater/${complaint.beraterId}` : '';
  const beraterTel = beraterTelHref(beraterPhone(complaint));

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
            <DrawerSection title="Lead" summary={leadSummary} defaultOpen>
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

            {pending ? (
              <DrawerSection title="Ersatzlead" summary={replaceSummary}>
                {canReplace ? (
                  <div className="dash-replace-block">
                    <p className="dash-panel-note">
                      Maximal 5 freie Leads hier. Anderen Ersatz über den Berater wählen.
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
                    Kein freier Lead im Pool. Ersatz können Sie nach der Erstattung über den Berater senden.
                  </p>
                )}
              </DrawerSection>
            ) : null}
          </div>

          {pending ? (
            <label className="dash-decline-note">
              Notiz zum Ablehnen
              <textarea
                rows={2}
                value={declineNote}
                onChange={(event) => onDeclineNote(event.target.value)}
                placeholder="Nur nötig, wenn Sie ablehnen."
                disabled={Boolean(saving)}
              />
            </label>
          ) : null}
        </div>

        <div className={`dash-drawer-actions${pending ? ' dash-drawer-actions--decide' : ''}`}>
          {pending ? (
            <>
              <button
                type="button"
                className="dash-btn dash-btn--ok"
                disabled={Boolean(saving)}
                onClick={() => onRun(
                  complaint.id,
                  { status: 'approved', replaceLeadId: replaceId || undefined },
                  replaceId
                    ? 'Erstattet und Ersatzlead gesendet. Der alte Lead liegt unter Ungültige Leads.'
                    : 'Erstattet. Der Lead liegt unter Ungültige Leads, sobald ein Ersatz gesendet wurde.',
                )}
              >
                {replaceId ? 'Erstatten + Ersatz' : 'Erstatten'}
              </button>
              <button
                type="button"
                className="dash-btn dash-btn--danger"
                disabled={Boolean(saving) || !declineNote.trim()}
                onClick={() => onRun(
                  complaint.id,
                  { status: 'declined', note: declineNote },
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
  const [complaints, setComplaints] = useState([]);
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [filter, setFilter] = useState('pending');
  const [selectedId, setSelectedId] = useState('');
  const [declineNote, setDeclineNote] = useState('');
  const [replaceId, setReplaceId] = useState('');

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
    return complaints.filter((entry) => entry.status === filter);
  }, [complaints, filter]);

  const counts = useMemo(() => ({
    pending: complaints.filter((entry) => entry.status === 'pending').length,
    approved: complaints.filter((entry) => entry.status === 'approved').length,
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
      setDeclineNote('');
      setReplaceId('');
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
    setSelectedId(id);
    setDeclineNote('');
    setReplaceId('');
  }

  return (
    <div className="dash-stack">
      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <div className="dash-metrics dash-metrics--three">
        <div className="dash-metric dash-metric--signal">
          <span>In Prüfung</span>
          <strong>{loading ? '—' : counts.pending}</strong>
          <small>warten auf Entscheidung</small>
        </div>
        <div className="dash-metric">
          <span>Erstattet</span>
          <strong>{loading ? '—' : counts.approved}</strong>
          <small>gültig gestrichen</small>
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
              { id: 'approved', label: 'Erstattet', count: loading ? null : counts.approved },
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
                    <span className="dash-lead-row-tags">{complaintReasonLabel(entry.reason)}</span>
                  </div>
                  <div className="dash-request-meta">
                    <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                    <span className={`dash-badge dash-badge--${complaintStatusTone(entry.status)}`}>
                      {complaintStatusLabel(entry.status)}
                    </span>
                    {entry.status === 'approved' && isReplacementPending(entry) ? (
                      <span className="dash-badge dash-badge--warn">Ersatz offen</span>
                    ) : null}
                    {entry.status === 'approved' && entry.replacementLead ? (
                      <span className="dash-badge dash-badge--ok">Ersatz gesendet</span>
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
          declineNote={declineNote}
          replaceId={replaceId}
          onDeclineNote={setDeclineNote}
          onReplaceId={setReplaceId}
          onRun={run}
          onClose={() => setSelectedId('')}
          from={from}
        />
      ) : null}
    </div>
  );
}
