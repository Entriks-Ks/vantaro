import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Copy,
  Info,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import { api } from './api';
import { formatDateTime, formatRelative, shortId } from './format';
import { L } from './i18n';

/* ---------- data loading ---------- */

/** GET with loading/error state. `params` is serialised, so pass plain values. */
export function useApi(path, params) {
  const key = JSON.stringify([path, params || {}]);
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api.get(path, params)
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (active) setState((prev) => ({ data: prev.data, error, loading: false }));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}

/* ---------- toasts ---------- */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, message, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), tone === 'error' ? 8000 : 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="its-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`its-toast is-${toast.tone}`}>
            {toast.tone === 'error' ? <CircleX size={16} /> : <CircleCheck size={16} />}
            <span>{toast.message}</span>
            <button type="button" aria-label={L('Schließen', 'Close')} onClick={() => setToasts((list) => list.filter((t) => t.id !== toast.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------- layout ---------- */

export function Page({ title, description, actions, children }) {
  return (
    <div className="its-page">
      <header className="its-page-head">
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="its-page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function Card({ title, description, actions, children, flush = false, className = '' }) {
  return (
    <section className={`its-card${flush ? ' is-flush' : ''}${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <header className="its-card-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="its-card-actions">{actions}</div> : null}
        </header>
      )}
      <div className="its-card-body">{children}</div>
    </section>
  );
}

const TONE_ICON = {
  ok: CircleCheck,
  warn: TriangleAlert,
  error: CircleAlert,
  info: Info,
  neutral: CircleDashed,
};

export function Chip({ tone = 'neutral', icon = true, children, title }) {
  const Icon = TONE_ICON[tone] || CircleDashed;
  return (
    <span className={`its-chip is-${tone}`} title={title}>
      {icon ? <Icon size={12} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Button({ children, tone = 'default', size = 'md', icon: Icon, loading = false, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`its-btn is-${tone} is-${size}${className ? ` ${className}` : ''}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <RefreshCw size={14} className="its-spin" aria-hidden="true" /> : (Icon ? <Icon size={14} aria-hidden="true" /> : null)}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export function Stat({ label, value, tone = 'neutral', hint, onClick, icon: Icon }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`its-stat is-${tone}${onClick ? ' is-clickable' : ''}`} onClick={onClick}>
      <div className="its-stat-top">
        <span>{label}</span>
        {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      </div>
      <strong>{value ?? '—'}</strong>
      {hint ? <small>{hint}</small> : null}
    </Tag>
  );
}

export function Loading({ label = L('Wird geladen …', 'Loading …') }) {
  return (
    <div className="its-loading" role="status">
      <RefreshCw size={16} className="its-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="its-banner is-error" role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{error.message || String(error)}</span>
      {onRetry ? <Button size="sm" onClick={onRetry} icon={RefreshCw}>{L('Erneut versuchen', 'Try again')}</Button> : null}
    </div>
  );
}

export function Banner({ tone = 'info', children, action }) {
  const Icon = TONE_ICON[tone] || Info;
  return (
    <div className={`its-banner is-${tone}`}>
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
      {action || null}
    </div>
  );
}

export function EmptyState({ icon: Icon = CircleCheck, title, children }) {
  return (
    <div className="its-empty">
      <Icon size={22} aria-hidden="true" />
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

/* ---------- filters ---------- */

export function SearchInput({ value, onChange, placeholder = L('Suchen …', 'Search …'), autoFocus = false }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => setDraft(value || ''), [value]);
  useEffect(() => {
    if (draft === (value || '')) return undefined;
    const timer = window.setTimeout(() => onChange(draft), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  return (
    <label className="its-search">
      <Search size={15} aria-hidden="true" />
      <input
        type="search"
        value={draft}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={placeholder}
      />
      {draft ? (
        <button type="button" aria-label={L('Suche leeren', 'Clear search')} onClick={() => { setDraft(''); onChange(''); }}>
          <X size={14} />
        </button>
      ) : null}
    </label>
  );
}

export function Select({ label, value, onChange, options, className = '' }) {
  const id = useId();
  return (
    <label className={`its-select${className ? ` ${className}` : ''}`} htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="its-seg" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? 'is-active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count != null ? <em className={option.alert && option.count ? 'is-alert' : undefined}>{option.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({ children }) {
  return <div className="its-toolbar">{children}</div>;
}

/* ---------- table ---------- */

export function DataTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  onRowClick,
  loading,
  empty,
  selectable = false,
  selected,
  onSelectedChange,
  activeKey,
}) {
  const allKeys = (rows || []).map(rowKey);
  const allSelected = selectable && allKeys.length > 0 && allKeys.every((key) => selected?.has(key));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) allKeys.forEach((key) => next.delete(key));
    else allKeys.forEach((key) => next.add(key));
    onSelectedChange(next);
  };
  const toggleOne = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange(next);
  };

  return (
    <div className={`its-table-wrap${loading ? ' is-loading' : ''}`}>
      <table className="its-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="is-check">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={L('Alle auswählen', 'Select all')} />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.key} className={column.className} style={column.width ? { width: column.width } : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={`${onRowClick ? 'is-clickable' : ''}${activeKey === key ? ' is-active' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (event) => {
                  if (event.key === 'Enter') onRowClick(row);
                } : undefined}
              >
                {selectable ? (
                  <td className="is-check" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selected?.has(key) || false} onChange={() => toggleOne(key)} aria-label={L('Auswählen', 'Select')} />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.key} className={column.className} data-label={column.label}>
                    {column.render ? column.render(row) : (row[column.key] ?? '—')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!loading && !(rows || []).length ? (empty || <EmptyState title={L('Keine Einträge', 'No entries')} />) : null}
      {loading && !(rows || []).length ? <Loading /> : null}
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || 1)));
  if (pages <= 1) return <div className="its-pager"><span>{total || 0} {L('Einträge', 'entries')}</span></div>;
  return (
    <div className="its-pager">
      <span>{L(`${total} Einträge · Seite ${page} von ${pages}`, `${total} entries · page ${page} of ${pages}`)}</span>
      <div>
        <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={L('Vorherige Seite', 'Previous page')} />
        <Button size="sm" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={L('Nächste Seite', 'Next page')} />
      </div>
    </div>
  );
}

/* ---------- detail ---------- */

export function Drawer({ open, title, subtitle, onClose, children, headerExtra }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      // A confirmation dialog on top handles Escape itself; only close the panel when it is the top layer.
      if (event.key === 'Escape' && !document.querySelector('.its-modal-layer')) onClose();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="its-drawer-layer">
      <button type="button" className="its-drawer-scrim" aria-label={L('Schließen', 'Close')} onClick={onClose} />
      <aside className="its-drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}>
        <header className="its-drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="its-drawer-head-actions">
            {headerExtra}
            <Button size="sm" tone="ghost" icon={X} onClick={onClose} aria-label={L('Schließen', 'Close')} />
          </div>
        </header>
        <div className="its-drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="its-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={value === tab.value ? 'is-active' : undefined}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count ? <em>{tab.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="its-kv">
      {items.filter(Boolean).map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value === null || value === undefined || value === '' ? '—' : value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CopyId({ value, full = false }) {
  const [copied, setCopied] = useState(false);
  if (!value) return '—';
  return (
    <button
      type="button"
      className="its-copy"
      title={L(`${value} kopieren`, `Copy ${value}`)}
      onClick={(event) => {
        event.stopPropagation();
        navigator.clipboard?.writeText(String(value)).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
    >
      <code>{full ? value : shortId(value)}</code>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export function When({ value }) {
  if (!value) return '—';
  return <time dateTime={value} title={formatDateTime(value)}>{formatRelative(value)}</time>;
}

/* ---------- actions ---------- */

/** A list of explained actions: what it does is visible before clicking. */
export function ActionList({ actions }) {
  const visible = actions.filter(Boolean).filter((action) => !action.hidden);
  if (!visible.length) return <p className="its-muted">{L('Für diesen Eintrag sind keine Aktionen verfügbar.', 'No actions are available for this entry.')}</p>;
  return (
    <div className="its-actions">
      {visible.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            className={`its-action is-${action.tone || 'default'}`}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.disabled ? action.disabledReason : undefined}
          >
            {Icon ? <span className="its-action-icon"><Icon size={16} aria-hidden="true" /></span> : null}
            <span className="its-action-text">
              <strong>{action.label}</strong>
              <small>{action.disabled && action.disabledReason ? action.disabledReason : action.description}</small>
            </span>
            <ChevronRight size={16} aria-hidden="true" className="its-action-chevron" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Confirmation dialog for every change. Shows what will happen, optionally asks for a reason
 * (stored in the activity log) and for a typed confirmation on destructive actions.
 */
export function ActionDialog({ dialog, onClose }) {
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => {
    setReason('');
    setTyped('');
    setValues(dialog?.initialValues || {});
    setError(null);
    setBusy(false);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, busy, onClose]);

  const reasonRequired = dialog?.reason === 'required';
  const reasonOk = !reasonRequired || reason.trim().length >= 5;
  const typedOk = !dialog?.confirmText || typed.trim().toLowerCase() === String(dialog.confirmText).toLowerCase();
  const fieldsOk = useMemo(
    () => (dialog?.fields || []).every((field) => !field.required || String(values[field.name] ?? '').trim()),
    [dialog, values],
  );

  if (!dialog) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!reasonOk || !typedOk || !fieldsOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await dialog.onConfirm({ reason: reason.trim() || undefined, values, typed: typed.trim() });
      if (dialog.success) toast(typeof dialog.success === 'function' ? dialog.success(result) : dialog.success);
      onClose(result);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="its-modal-layer" role="presentation">
      <button type="button" className="its-drawer-scrim" aria-label={L('Abbrechen', 'Cancel')} onClick={() => !busy && onClose()} />
      <form className={`its-modal is-${dialog.tone || 'default'}`} role="dialog" aria-modal="true" aria-label={dialog.title} onSubmit={submit}>
        <header>
          <h2>{dialog.title}</h2>
          <Button size="sm" tone="ghost" icon={X} onClick={() => !busy && onClose()} aria-label={L('Abbrechen', 'Cancel')} />
        </header>
        <div className="its-modal-body">
          {dialog.description ? <p className="its-modal-lede">{dialog.description}</p> : null}
          {dialog.effects?.length ? (
            <div className="its-effects">
              <span>{L('Was passiert', 'What happens')}</span>
              <ul>
                {dialog.effects.map((effect) => <li key={effect}>{effect}</li>)}
              </ul>
            </div>
          ) : null}
          {(dialog.fields || []).map((field) => (
            <label key={field.name} className="its-field">
              <span>{field.label}{field.required ? ' *' : ''}</span>
              {field.type === 'select' ? (
                <select
                  value={values[field.name] ?? ''}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                >
                  {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : field.type === 'checkbox' ? (
                <span className="its-check">
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.checked }))}
                  />
                  <em>{field.hint}</em>
                </span>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={values[field.name] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                />
              )}
              {field.help ? <small>{field.help}</small> : null}
            </label>
          ))}
          {dialog.reason ? (
            <label className="its-field">
              <span>{L('Begründung', 'Reason')}{reasonRequired ? ' *' : L(' (optional)', ' (optional)')}</span>
              <textarea
                rows={3}
                value={reason}
                placeholder={L('z. B. Ticket-Nr., Anfrage des Beraters, Testdaten …', 'e.g. ticket no., advisor request, test data …')}
                onChange={(event) => setReason(event.target.value)}
              />
              <small>{L('Wird mit Ihrem Namen und Zeitstempel im Aktivitätsprotokoll gespeichert.', 'Stored in the activity log with your name and a timestamp.')}</small>
            </label>
          ) : null}
          {dialog.confirmText ? (
            <label className="its-field">
              <span>{L(`Zur Bestätigung „${dialog.confirmText}“ eingeben *`, `Type "${dialog.confirmText}" to confirm *`)}</span>
              <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
            </label>
          ) : null}
          {error ? <ErrorBanner error={error} /> : null}
        </div>
        <footer>
          <Button tone="ghost" onClick={() => onClose()} disabled={busy}>{L('Abbrechen', 'Cancel')}</Button>
          <Button
            type="submit"
            tone={dialog.tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            disabled={!reasonOk || !typedOk || !fieldsOk}
          >
            {dialog.confirmLabel || L('Ausführen', 'Run')}
          </Button>
        </footer>
      </form>
    </div>
  );
}

/** State helper: `open(dialogConfig)` shows the dialog, `element` renders it. */
export function useActionDialog() {
  const [dialog, setDialog] = useState(null);
  const close = useCallback(() => setDialog(null), []);
  return {
    open: setDialog,
    element: <ActionDialog dialog={dialog} onClose={close} />,
  };
}

export function JsonBlock({ value }) {
  if (value == null) return <span className="its-muted">—</span>;
  return <pre className="its-json">{JSON.stringify(value, null, 2)}</pre>;
}
