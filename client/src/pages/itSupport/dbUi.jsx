import { Chip } from './ui';
import { displayValue, tableUi } from './schemaDocs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One value as people read it: status as a coloured chip, money in euros, dates local. */
export function Cell({ table, column, value }) {
  const shown = displayValue(table, column, value);
  if (shown.empty) return <span className="its-muted">—</span>;
  if (typeof value === 'string' && UUID.test(value)) {
    return <span className="its-db-uuid" title={value}>{value.slice(0, 8)}</span>;
  }
  if (shown.tone) return <Chip tone={shown.tone} icon={false} title={shown.title}>{shown.text}</Chip>;
  return <span className="its-cell-clip" title={shown.title || shown.text}>{shown.text}</span>;
}

/** Coloured square with the table's icon. */
export function TableIcon({ table, size = 'md' }) {
  const ui = tableUi(table);
  const Icon = ui.icon;
  return (
    <span className={`its-db-icon is-${ui.tone} is-${size}`} aria-hidden="true">
      <Icon size={size === 'sm' ? 14 : size === 'lg' ? 22 : 18} />
    </span>
  );
}
