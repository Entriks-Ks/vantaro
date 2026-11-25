import { Link } from 'react-router-dom';
import {
  complaintReplacementPath,
  isCreditedComplaint,
  isReplacementPending,
} from '../../lib/complaints';
import { L } from '../../lib/i18n';

export { isReplacementPending };

export function ComplaintReplacementStatus({ complaint, from }) {
  if (!complaint || !isCreditedComplaint(complaint)) return null;

  const returnTo = from || '/dashboard/reklamationen';

  if (complaint.replacementLead) {
    return (
      <div className="dash-replacement-status dash-replacement-status--sent">
        <span>{L('Ersatz gesendet', 'Replacement sent')}</span>
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
            <span>{L('Ersatz ausstehend', 'Replacement pending')}</span>
            <small>{L('Nur passende freie Leads oder Termine aus dem Auftrag.', 'Only matching free leads or appointments from the order.')}</small>
          </div>
          <Link
            className="dash-btn dash-btn--ok dash-btn--compact"
            to={complaintReplacementPath(complaint)}
            state={{ from: returnTo }}
          >
            {L('Ersatz senden', 'Send replacement')}
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
