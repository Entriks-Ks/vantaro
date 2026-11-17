import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ACTION, formatDateTime, label, TARGET_TYPE } from './format';
import { L } from './i18n';
import { EmptyState, When } from './ui';

function Diff({ before, after }) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  if (!keys.length) return null;
  const show = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  return (
    <table className="its-diff">
      <thead>
        <tr><th>{L('Feld', 'Field')}</th><th>{L('Vorher', 'Before')}</th><th>{L('Nachher', 'After')}</th></tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key}>
            <td>{key}</td>
            <td className="is-before">{show(before?.[key])}</td>
            <td className="is-after">{show(after?.[key])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Entries are stored in both languages; older entries may only have the German summary. */
export function activitySummary(entry) {
  return L(entry.summary, entry.summaryEn || entry.summary);
}

export function ActivityItem({ entry, showTarget = false, onOpenTarget }) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(entry.reason || entry.before || entry.after || entry.ip);
  const role = entry.actorRole === 'admin' ? 'Admin' : L('IT-Support', 'IT Support');
  return (
    <li className={`its-timeline-item${open ? ' is-open' : ''}`}>
      <button type="button" className="its-timeline-row" onClick={() => setOpen((value) => !value)} aria-expanded={open} disabled={!hasDetails}>
        <span className="its-timeline-dot" aria-hidden="true" />
        <span className="its-timeline-main">
          <strong>{label(ACTION, entry.action)}</strong>
          <span>{activitySummary(entry)}</span>
          <small>
            {entry.actorEmail}
            {' · '}
            <When value={entry.createdAt} />
            {showTarget && entry.targetLabel ? ` · ${label(TARGET_TYPE, entry.targetType)}: ${entry.targetLabel}` : ''}
          </small>
        </span>
        {hasDetails ? <ChevronRight size={14} className="its-timeline-chevron" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="its-timeline-details">
          {entry.reason ? <p><b>{L('Begründung', 'Reason')}:</b> {entry.reason}</p> : null}
          <Diff before={entry.before} after={entry.after} />
          <p className="its-muted">
            {formatDateTime(entry.createdAt)} · {entry.actorEmail} ({role})
            {entry.ip ? ` · IP ${entry.ip}` : ''}
          </p>
          {onOpenTarget && entry.targetId && ['lead', 'user', 'payment'].includes(entry.targetType) ? (
            <button type="button" className="its-link" onClick={() => onOpenTarget(entry)}>
              {L(`${label(TARGET_TYPE, entry.targetType)} öffnen`, `Open ${label(TARGET_TYPE, entry.targetType).toLowerCase()}`)}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function ActivityTimeline({ entries, showTarget = false, onOpenTarget, empty }) {
  if (!entries?.length) return <EmptyState title={empty || L('Noch keine Aktionen protokolliert.', 'No actions logged yet.')} />;
  return (
    <ol className="its-timeline">
      {entries.map((entry) => (
        <ActivityItem key={entry.id} entry={entry} showTarget={showTarget} onOpenTarget={onOpenTarget} />
      ))}
    </ol>
  );
}

export function targetPath(entry) {
  if (entry.targetType === 'lead') return `/it-support/leads?id=${entry.targetId}`;
  if (entry.targetType === 'user') return `/it-support/users?id=${entry.targetId}`;
  if (entry.targetType === 'payment') return `/it-support/payments?id=${entry.targetId}`;
  return null;
}
