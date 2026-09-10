import { Link } from 'react-router-dom';

function isCreditedComplaint(complaint) {
  return complaint?.status === 'approved' || complaint?.status === 'partial';
}

export function isReplacementPending(complaint) {
  return isCreditedComplaint(complaint)
    && !complaint?.replacementLeadId
    && !complaint?.replacementLead;
}

export function ComplaintReplacementStatus({ complaint, from }) {
  if (!complaint || !isCreditedComplaint(complaint)) return null;

  const returnTo = from || '/dashboard/reklamationen';

  if (complaint.replacementLead) {
    return (
      <div className="dash-replacement-status dash-replacement-status--sent">
        <span>Ersatz gesendet</span>
        <strong>
          <Link to={`/dashboard/leads/${complaint.replacementLead.id}`} state={{ from: returnTo }}>
            {complaint.replacementLead.fullName || 'Lead'}
          </Link>
        </strong>
      </div>
    );
  }

  if (isReplacementPending(complaint)) {
    return (
      <div className="dash-replacement-status dash-replacement-status--pending">
        <div className="dash-replacement-status__row">
          <div>
            <span>Ersatz ausstehend</span>
            <small>Noch kein Ersatzlead zugewiesen.</small>
          </div>
          <Link
            className="dash-btn dash-btn--ok dash-btn--compact"
            to={`/dashboard/leads?replacementFor=${complaint.id}`}
            state={{ from: returnTo }}
          >
            Ersatz senden
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
