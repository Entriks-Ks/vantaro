import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  complaintReasonLabel,
  complaintStatusLabel,
  complaintStatusTone,
  fetchComplaints,
  reviewComplaint,
} from '../../lib/complaints';
import { fetchLeads, formatLeadAddress, listLabels } from '../../lib/leads';
import { DashSeg } from './DashboardLayout';
import { formatDateTime, initials } from './helpers';

function beraterName(complaint) {
  return complaint.berater?.fullName || complaint.berater?.email || 'Unbekannt';
}

export function AdminComplaints() {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const [complaints, setComplaints] = useState([]);
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('pending');
  const [openId, setOpenId] = useState('');
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

  const visible = useMemo(() => {
    if (filter === 'all') return complaints;
    return complaints.filter((entry) => entry.status === filter);
  }, [complaints, filter]);

  const counts = useMemo(() => ({
    pending: complaints.filter((entry) => entry.status === 'pending').length,
    approved: complaints.filter((entry) => entry.status === 'approved').length,
    declined: complaints.filter((entry) => entry.status === 'declined').length,
  }), [complaints]);

  async function run(id, payload, success) {
    setSaving(id);
    setError('');
    setNotice('');
    try {
      const result = await reviewComplaint(id, payload);
      await load();
      setDeclineNote('');
      setReplaceId('');
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
          <Link className="dash-btn dash-btn--ghost" to="/dashboard/leads/abgelehnt">
            Abgelehnte Leads
          </Link>
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : visible.length ? (
          <div className="dash-lead-list">
            {visible.map((entry) => {
              const lead = entry.lead;
              const expanded = openId === entry.id;
              const canReplace = Boolean(entry.requestId) && pool.length > 0
                && (entry.request?.status === 'active' || entry.request?.status === 'completed' || !entry.request);
              return (
                <article key={entry.id} className="dash-complaint-card">
                  <button
                    type="button"
                    className="dash-lead-row"
                    onClick={() => {
                      setOpenId(expanded ? '' : entry.id);
                      setDeclineNote('');
                      setReplaceId('');
                    }}
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
                        {lead ? ` · ${formatLeadAddress(lead)}` : ''}
                      </span>
                    </div>
                    <div className="dash-lead-row-side">
                      <span className={`dash-badge dash-badge--${complaintStatusTone(entry.status)}`}>
                        {complaintStatusLabel(entry.status)}
                      </span>
                      <small>Gemeldet {formatDateTime(entry.createdAt)}</small>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="dash-complaint-body">
                      <dl className="dash-complaint-facts">
                        <div>
                          <dt>Berater</dt>
                          <dd>
                            {entry.beraterId ? (
                              <Link to={`/dashboard/berater/${entry.beraterId}`}>{beraterName(entry)}</Link>
                            ) : beraterName(entry)}
                          </dd>
                        </div>
                        <div>
                          <dt>Zugestellt</dt>
                          <dd>{formatDateTime(lead?.assignedAt)}</dd>
                        </div>
                        <div>
                          <dt>Reklamiert</dt>
                          <dd>{formatDateTime(entry.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>Grund</dt>
                          <dd>{complaintReasonLabel(entry.reason)}</dd>
                        </div>
                      </dl>
                      {entry.comment ? <p className="dash-panel-note">{entry.comment}</p> : null}
                      {lead?.email || lead?.phone ? (
                        <p className="dash-panel-note">
                          {[lead.email, lead.phone].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                      {entry.adminNote ? (
                        <p className="dash-panel-note">Ablehnung: {entry.adminNote}</p>
                      ) : null}

                      {entry.status === 'pending' ? (
                        <>
                          <label className="dash-decline-note">
                            Ablehnungsnotiz (sichtbar für den Berater)
                            <textarea
                              rows={3}
                              value={declineNote}
                              onChange={(event) => setDeclineNote(event.target.value)}
                              placeholder="Warum wird die Erstattung abgelehnt?"
                              disabled={Boolean(saving)}
                            />
                          </label>

                          {canReplace ? (
                            <div className="dash-replace-block">
                              <p className="dash-panel-note">
                                Bei Genehmigung können Sie sofort einen freien Ersatzlead senden oder das später tun.
                              </p>
                              <div className="dash-pick-list">
                                {pool.slice(0, 12).map((item) => (
                                  <label key={item.id} className={`dash-pick-row${replaceId === item.id ? ' is-checked' : ''}`}>
                                    <input
                                      type="radio"
                                      name={`replace-${entry.id}`}
                                      checked={replaceId === item.id}
                                      onChange={() => setReplaceId(item.id)}
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
                                <button
                                  type="button"
                                  className="dash-btn dash-btn--ghost"
                                  onClick={() => setReplaceId('')}
                                >
                                  Auswahl aufheben
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <p className="dash-panel-note">
                              Kein freier Lead im Pool. Nach der Genehmigung können Sie den Ersatz senden, sobald einer verfügbar ist.
                            </p>
                          )}

                          <div className="dash-form-actions">
                            <button
                              type="button"
                              className="dash-btn"
                              disabled={Boolean(saving)}
                              onClick={() => run(
                                entry.id,
                                { status: 'approved', replaceLeadId: replaceId || undefined },
                                replaceId
                                  ? 'Erstattet und Ersatzlead gesendet. Der alte Lead liegt unter Abgelehnte Leads.'
                                  : 'Erstattet. Der Lead liegt unter Abgelehnte Leads. Ersatz können Sie später senden.',
                              )}
                            >
                              {replaceId ? 'Erstatten und Ersatz senden' : 'Erstatten'}
                            </button>
                            <button
                              type="button"
                              className="dash-btn dash-btn--ghost"
                              disabled={Boolean(saving) || !declineNote.trim()}
                              onClick={() => run(
                                entry.id,
                                { status: 'declined', note: declineNote },
                                'Erstattung abgelehnt. Der Berater sieht die Notiz.',
                              )}
                            >
                              Ablehnen
                            </button>
                            {lead?.id ? (
                              <Link className="dash-btn dash-btn--ghost" to={`/dashboard/leads/${lead.id}`} state={{ from }}>
                                Lead prüfen
                              </Link>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="dash-form-actions">
                          {lead?.id ? (
                            <Link className="dash-btn dash-btn--ghost" to={`/dashboard/leads/${lead.id}`} state={{ from }}>
                              Lead öffnen
                            </Link>
                          ) : null}
                          {entry.status === 'approved' ? (
                            <Link className="dash-btn dash-btn--ghost" to="/dashboard/leads/abgelehnt">
                              Zu den abgelehnten Leads
                            </Link>
                          ) : null}
                          {entry.beraterId && entry.status === 'approved' ? (
                            <Link className="dash-btn dash-btn--ghost" to={`/dashboard/berater/${entry.beraterId}`}>
                              Ersatz später senden
                            </Link>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
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
    </div>
  );
}
