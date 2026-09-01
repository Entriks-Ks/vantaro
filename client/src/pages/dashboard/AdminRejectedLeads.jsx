import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeads, restoreRejectedLead } from '../../lib/leads';
import { LeadListItem } from './AdminLeads';

export function AdminRejectedLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const payload = await fetchLeads({ assignedTo: 'rejected' });
    setLeads(payload.leads || []);
  }

  useEffect(() => {
    let active = true;
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

  async function restore(id) {
    setSaving(id);
    setError('');
    setNotice('');
    try {
      await restoreRejectedLead(id);
      await load();
      setNotice('Lead ist wieder im freien Pool.');
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
        <div className="dash-panel-head">
          <div>
            <strong>Verworfen</strong>
            <p className="dash-panel-lede">{loading ? 'Laden…' : `${leads.length} Leads`}</p>
          </div>
          <Link className="dash-btn dash-btn--ghost" to="/dashboard/reklamationen">
            Zu den Reklamationen
          </Link>
        </div>
        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : leads.length ? (
          <div className="dash-sent-list">
            {leads.map((lead) => (
              <div key={lead.id} className="dash-sent-item">
                <LeadListItem lead={lead} />
                <button
                  type="button"
                  className="dash-btn dash-btn--ghost"
                  disabled={Boolean(saving)}
                  onClick={() => restore(lead.id)}
                >
                  Zurück in den Pool
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty">
            <p>Keine abgelehnten Leads. Genehmigte Erstattungen erscheinen hier.</p>
          </div>
        )}
      </section>
    </div>
  );
}
