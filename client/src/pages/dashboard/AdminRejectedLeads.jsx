import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { complaintReasonLabel, fetchComplaints } from '../../lib/complaints';
import { formatLeadAddress, listLabels, restoreRejectedLead } from '../../lib/leads';
import { leadScopeLabel } from '../../lib/scopes';
import { formatDate, formatDateTime, initials } from './helpers';

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

function beraterName(complaint) {
  return complaint?.berater?.fullName || complaint?.berater?.email || '—';
}

function isParkedInvalidLead(complaint) {
  // Refunded after admin decision — stays here until restored to the pool
  return (complaint?.status === 'approved' || complaint?.status === 'partial')
    && Boolean(complaint.lead?.refundedAt);
}

function RestoreConfirmModal({ lead, saving, onConfirm, onCancel }) {
  return (
    <div className="dash-confirm-root" role="dialog" aria-modal="true" aria-labelledby="restore-confirm-title">
      <button type="button" className="dash-confirm-overlay" aria-label="Abbrechen" onClick={onCancel} />
      <div className="dash-confirm-panel">
        <h3 id="restore-confirm-title">Lead wieder aktivieren?</h3>
        <p>
          Möchten Sie <strong>{lead?.fullName || 'diesen Lead'}</strong> wieder in den freien Pool legen?
          Der Lead erscheint dann als <strong>Wieder verfügbar</strong> und kann erneut zugewiesen werden.
        </p>
        <div className="dash-confirm-actions">
          <button type="button" className="dash-btn dash-btn--ghost" onClick={onCancel} disabled={Boolean(saving)}>
            Abbrechen
          </button>
          <button type="button" className="dash-btn dash-btn--ok" onClick={onConfirm} disabled={Boolean(saving)}>
            {saving ? 'Wird aktiviert…' : 'Ja, wieder aktivieren'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvalidLeadDrawer({ complaint, saving, onRestoreRequest, onClose, from }) {
  const lead = complaint.lead;
  const beraterPath = complaint.beraterId ? `/dashboard/berater/${complaint.beraterId}` : '';
  const address = lead ? formatLeadAddress(lead) : '—';

  return (
    <div className="dash-drawer-root">
      <button type="button" className="dash-drawer-overlay" aria-label="Details schließen" onClick={onClose} />
      <aside className="dash-drawer dash-drawer--complaint" aria-labelledby="invalid-drawer-title">
        <div className="dash-drawer-head">
          <div className="dash-drawer-who">
            <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
              {initials(lead || { fullName: 'Lead' })}
            </span>
            <div>
              <div className="dash-lead-kicker">Ungültiger Lead</div>
              <h3 id="invalid-drawer-title">{lead?.fullName || 'Lead'}</h3>
              <small>
                {beraterName(complaint)}
                {' · '}
                Erstattet {formatDate(complaint.refundedAt || lead?.refundedAt)}
              </small>
            </div>
          </div>
          <button type="button" className="dash-drawer-close" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="dash-drawer-body">
          <div className="dash-drawer-chips">
            <span className="dash-badge dash-badge--danger">Ungültig</span>
            {complaint.replacementLeadId || complaint.replacementLead ? (
              <span className="dash-badge dash-badge--ok">Ersatz gesendet</span>
            ) : (
              <span className="dash-badge dash-badge--warn">Ersatz offen</span>
            )}
            {lead?.scope ? (
              <span className="dash-badge dash-badge--muted">{leadScopeLabel(lead.scope)}</span>
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

          {complaint.replacementLead ? (
            <div className="dash-replacement-status dash-replacement-status--sent">
              <span>Ersatz gesendet</span>
              <strong>
                <Link
                  to={`/dashboard/leads/${complaint.replacementLead.id}`}
                  state={{ from }}
                >
                  {complaint.replacementLead.fullName || 'Lead'}
                </Link>
              </strong>
            </div>
          ) : null}

          <div className="dash-drawer-fields dash-drawer-fields--stack">
            <Field label="Adresse">{address}</Field>
            <Field label="E-Mail">
              {lead?.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null}
            </Field>
            <Field label="Telefon">
              {lead?.phone ? <a href={phoneHref(lead.phone)}>{lead.phone}</a> : null}
            </Field>
            <Field label="Berater">{beraterName(complaint)}</Field>
            <Field label="Zugestellt">{formatDateTime(lead?.assignedAt)}</Field>
            <Field label="Erstattet">{formatDateTime(complaint.refundedAt || lead?.refundedAt)}</Field>
            <Field label="Versicherung">{listLabels(lead?.insuranceStatus, 'insurance')}</Field>
          </div>
        </div>

        <div className="dash-drawer-actions dash-drawer-actions--restore">
          <div className="dash-drawer-actions__row">
            {lead?.id ? (
              <Link className="dash-btn dash-btn--ghost" to={`/dashboard/leads/${lead.id}`} state={{ from }}>
                Lead öffnen
              </Link>
            ) : null}
            {beraterPath ? (
              <Link className="dash-btn dash-btn--ghost" to={beraterPath}>
                Berater öffnen
              </Link>
            ) : null}
          </div>
          {lead?.id ? (
            <button
              type="button"
              className="dash-btn dash-btn--ok"
              disabled={Boolean(saving)}
              onClick={() => onRestoreRequest(lead.id)}
            >
              Wieder aktivieren
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function AdminRejectedLeads() {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [confirmLeadId, setConfirmLeadId] = useState('');

  async function load() {
    const approved = await fetchComplaints('approved');
    const partial = await fetchComplaints('partial');
    const merged = [...(approved.complaints || []), ...(partial.complaints || [])];
    const byId = new Map();
    for (const entry of merged) {
      if (entry?.id) byId.set(entry.id, entry);
    }
    setComplaints([...byId.values()].filter(isParkedInvalidLead));
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
    if (!selectedId && !confirmLeadId) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        if (confirmLeadId) setConfirmLeadId('');
        else setSelectedId('');
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [selectedId, confirmLeadId]);

  const sorted = useMemo(
    () => [...complaints].sort((a, b) => {
      const left = new Date(b.refundedAt || b.updatedAt || b.createdAt || 0).getTime();
      const right = new Date(a.refundedAt || a.updatedAt || a.createdAt || 0).getTime();
      return left - right;
    }),
    [complaints],
  );

  const selected = sorted.find((entry) => entry.id === selectedId) || null;
  const confirmLead = confirmLeadId
    ? (sorted.find((entry) => entry.lead?.id === confirmLeadId)?.lead || null)
    : null;

  async function restore(leadId) {
    setSaving(leadId);
    setError('');
    setNotice('');
    try {
      await restoreRejectedLead(leadId);
      await load();
      setConfirmLeadId('');
      setSelectedId('');
      setNotice('Lead ist wieder im freien Pool als Wieder verfügbar.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="dash-stack">
      {notice ? <div className="dash-alert dash-alert--ok">{notice}</div> : null}
      {error ? <div className="dash-alert">{error}</div> : null}

      <section className="dash-panel">
        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : sorted.length ? (
          <div className="dash-lead-list">
            {sorted.map((complaint) => {
              const lead = complaint.lead;
              return (
                <article
                  key={complaint.id}
                  className={`dash-lead-row dash-rejected-row${selectedId === complaint.id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(complaint.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(complaint.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="dash-lead-avatar dash-lead-avatar--sm" aria-hidden="true">
                    {initials(lead || { fullName: 'Lead' })}
                  </span>
                  <div className="dash-lead-row-main">
                    <strong>{lead?.fullName || 'Lead'}</strong>
                    <span className="dash-lead-row-sub">{beraterName(complaint)}</span>
                    <span className="dash-lead-row-tags">
                      {complaintReasonLabel(complaint.reason)}
                      {complaint.replacementLead?.fullName
                        ? ` · Ersatz: ${complaint.replacementLead.fullName}`
                        : ''}
                    </span>
                  </div>
                  <div className="dash-request-meta">
                    <div className="dash-request-meta__info">
                      <span className="dash-badge dash-badge--danger">Ungültig</span>
                      <time dateTime={complaint.refundedAt || lead?.refundedAt}>
                        {formatDate(complaint.refundedAt || lead?.refundedAt)}
                      </time>
                    </div>
                    <div className="dash-request-meta__controls">
                      <span className="dash-badge dash-badge--ok">Ersetzt</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dash-empty">
            <p>
              Noch keine ungültigen Leads. Erstattete Leads erscheinen hier,
              sobald ein Ersatzlead gesendet wurde.
            </p>
          </div>
        )}
      </section>

      {selected ? (
        <InvalidLeadDrawer
          complaint={selected}
          saving={saving}
          onRestoreRequest={setConfirmLeadId}
          onClose={() => setSelectedId('')}
          from={from}
        />
      ) : null}

      {confirmLead ? (
        <RestoreConfirmModal
          lead={confirmLead}
          saving={saving}
          onConfirm={() => restore(confirmLeadId)}
          onCancel={() => setConfirmLeadId('')}
        />
      ) : null}
    </div>
  );
}
