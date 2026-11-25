import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Copy,
  ExternalLink,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { L, pick } from './i18n';
import { Cell, TableIcon } from './dbUi';
import { Banner, Button, CopyId, DataTable, Drawer, ErrorBanner, Loading, SearchInput, Tabs, useApi, useToast } from './ui';
import {
  AUTH_USERS,
  cellText,
  checksOf,
  cleanTable,
  columnLabel,
  deleteTree,
  displayValue,
  deleteTriggersOf,
  incomingKeys,
  listColumns,
  outgoingKeys,
  PARENT_RULE_TEXT,
  rowPage,
  RULE_TEXT,
  sqlLiteral,
  supabaseDashboardUrl,
  tableAbout,
  tableLabel,
  tableMeta,
  TRIGGER_DOCS,
} from './schemaDocs';

const RULE_TONE = { CASCADE: 'error', 'SET NULL': 'warn', 'SET DEFAULT': 'warn', RESTRICT: 'neutral', 'NO ACTION': 'neutral' };

export function RuleBadge({ rule }) {
  if (!rule) return <span className="its-rule is-info">{L('kein FK', 'no FK')}</span>;
  return <span className={`its-rule is-${RULE_TONE[rule] || 'neutral'}`}>{rule}</span>;
}

function useCopy() {
  const toast = useToast();
  return (text) => navigator.clipboard?.writeText(text)
    .then(() => toast(L('Kopiert', 'Copied')))
    .catch(() => toast(L('Zwischenablage blockiert', 'Clipboard blocked'), 'error'));
}

function SqlBlock({ label, sql }) {
  const copy = useCopy();
  return (
    <div className="its-sql">
      <div className="its-sql-head">
        <span>{label}</span>
        <button type="button" onClick={() => copy(sql)}><Copy size={12} /> {L('Kopieren', 'Copy')}</button>
      </div>
      <pre>{sql}</pre>
    </div>
  );
}

function CascadeList({ nodes, depth = 0 }) {
  if (!nodes.length) return null;
  return (
    <ul className={`its-cascade${depth ? ' is-nested' : ''}`}>
      {nodes.map((node, index) => (
        <li key={`${node.table}-${node.via}-${index}`}>
          <div className="its-cascade-item">
            <div>
              <strong>{tableLabel(node.table)}</strong> <code>{node.table}.{node.via}</code> <RuleBadge rule={node.rule} />
            </div>
            <p>{pick(RULE_TEXT[node.rule])}</p>
          </div>
          <CascadeList nodes={node.children} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value }) {
  return (
    <div className="its-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** Rows of one table that point at the current row (opened from "Linked from"). */
function LinkedRows({ rel, frame, onOpenRow }) {
  const { data, error, loading, reload } = useApi('/database/rows', { table: frame.table, column: frame.column, value: frame.value });
  const meta = tableMeta(rel, frame.table);
  const columns = listColumns(meta, frame.table).slice(0, 5).map((key) => ({
    key,
    label: key,
    render: (row) => <span className="its-cell-clip">{cellText(row[key]) || '—'}</span>,
  }));
  return (
    <>
      <ErrorBanner error={error} onRetry={reload} />
      <p className="its-muted">
        <code>{frame.table}.{frame.column} = {frame.value}</code>
        {data ? ` · ${data.total} ${L('Zeilen', 'rows')}${data.total > data.rowLimit ? L(` (erste ${data.rowLimit})`, ` (first ${data.rowLimit})`) : ''}` : ''}
      </p>
      <DataTable
        columns={[{ key: 'id', label: 'id', render: (row) => <CopyId value={row.id ?? Object.values(row)[0]} /> }, ...columns]}
        rows={data?.rows}
        rowKey={(row) => JSON.stringify((meta?.primary_key || ['id']).map((column) => row[column]))}
        loading={loading}
        onRowClick={(row) => onOpenRow(frame.table, row)}
      />
    </>
  );
}

/**
 * Info window for a table, or for one row of it: what it is, what it links to and from (with live counts),
 * what a delete would set off, every field, and copy-ready SQL. Read-only; changes are made in Supabase.
 */
export default function TableInfo({ rel, projectRef, target, onClose }) {
  const [stack, setStack] = useState([]);
  const [tab, setTab] = useState('overview');
  const [fieldFilter, setFieldFilter] = useState('');
  const copy = useCopy();

  useEffect(() => {
    setStack(target ? [{ table: cleanTable(target.table), row: target.row || null }] : []);
    setTab('overview');
    setFieldFilter('');
  }, [target]);

  const frame = stack[stack.length - 1] || null;
  const table = frame?.table || null;
  const meta = tableMeta(rel, table);
  const pk = meta?.primary_key || [];
  const key = frame?.row && pk.length && pk.every((column) => frame.row[column] != null)
    ? Object.fromEntries(pk.map((column) => [column, frame.row[column]]))
    : null;

  const info = useApi(table && key && !frame?.column ? '/database/record' : null, table && key ? { table, key: JSON.stringify(key) } : undefined);
  const isRow = Boolean(frame?.row);
  const current = info.data?.row || frame?.row || null;
  const page = isRow ? rowPage(table, current) : null;

  const outgoing = useMemo(() => (table ? outgoingKeys(rel, table) : []), [rel, table]);
  const incoming = useMemo(() => {
    if (!table) return [];
    if (isRow && info.data) return info.data.incoming;
    return incomingKeys(rel, table).map((fk) => ({ ...fk, count: null }));
  }, [rel, table, isRow, info.data]);
  const tree = useMemo(() => (table ? deleteTree(rel, table) : []), [rel, table]);
  const triggers = table ? deleteTriggersOf(rel, table) : [];
  const checks = table ? checksOf(rel, table) : [];

  const counting = isRow && info.loading && !info.data;
  const sumBy = (rules) => incoming.filter((fk) => rules.includes(fk.on_delete)).reduce((total, fk) => total + (fk.count || 0), 0);
  const cascadeCount = sumBy(['CASCADE']);
  const nullCount = sumBy(['SET NULL', 'SET DEFAULT']);
  const blocked = incoming.filter((fk) => ['NO ACTION', 'RESTRICT'].includes(fk.on_delete) && (fk.count || 0) > 0);

  const isAuth = table === AUTH_USERS;
  const qualified = isAuth ? AUTH_USERS : `public.${table}`;
  const where = key ? pk.map((column) => `${column} = ${sqlLiteral(key[column])}`).join(' AND ') : '<condition>';
  const statements = table ? [
    { label: L('Diese Zeile lesen', 'Read this row'), sql: `SELECT * FROM ${qualified} WHERE ${where};` },
    ...incoming
      .filter((fk) => !isRow || !info.data || (fk.count || 0) > 0)
      .map((fk) => ({
        label: L(`Verknüpfte Zeilen in ${cleanTable(fk.table)}`, `Linked rows in ${cleanTable(fk.table)}`),
        sql: `SELECT * FROM public.${cleanTable(fk.table)} WHERE ${fk.columns
          .map((column, index) => `${column} = ${key ? sqlLiteral(current?.[fk.ref_columns[index]]) : '<value>'}`)
          .join(' AND ')};`,
      })),
    ...(isAuth ? [] : [{
      label: L('Löschen (erst Sicherung, Auswirkungen siehe „Beim Löschen“)', 'Delete (back up first, see "If deleted" for the impact)'),
      sql: `DELETE FROM ${qualified} WHERE ${where};`,
    }]),
  ] : [];

  const push = (next) => {
    setStack((list) => [...list, next]);
    setTab('overview');
    setFieldFilter('');
  };
  const follow = (fk) => {
    const refRow = {};
    fk.ref_columns.forEach((column, index) => { refRow[column] = current[fk.columns[index]]; });
    push({ table: cleanTable(fk.ref_table), row: refRow });
  };
  const openLinked = (fk) => push({
    table: cleanTable(fk.table),
    column: fk.columns[0],
    value: String(current?.[fk.ref_columns[0]] ?? ''),
  });
  const openRow = (rowTable, row) => push({ table: cleanTable(rowTable), row });

  const fq = fieldFilter.trim().toLowerCase();
  const fields = (meta?.columns || Object.keys(current || {}).map((name) => ({ name, type: '', nullable: true })))
    .filter((column) => !fq || column.name.toLowerCase().includes(fq) || cellText(current?.[column.name]).toLowerCase().includes(fq));

  const title = frame?.column
    ? L(`${tableLabel(table)}: verknüpfte Zeilen`, `${tableLabel(table)}: linked rows`)
    : tableLabel(table);

  return (
    <Drawer
      open={Boolean(target) && Boolean(frame)}
      onClose={onClose}
      title={title || ''}
      subtitle={table ? <code>{qualified}</code> : null}
    >
      {frame ? (
        <div className="its-info">
          {stack.length > 1 ? (
            <button type="button" className="its-link its-info-back" onClick={() => setStack((list) => list.slice(0, -1))}>
              <ArrowLeft size={14} /> {L(`Zurück zu ${tableLabel(stack[stack.length - 2].table)}`, `Back to ${tableLabel(stack[stack.length - 2].table)}`)}
            </button>
          ) : null}

          {frame.column ? (
            <LinkedRows rel={rel} frame={frame} onOpenRow={openRow} />
          ) : (
            <>
              <div className="its-info-hero">
                <div className="its-info-hero-top">
                  <TableIcon table={table} />
                  <div>
                    <span className="its-info-kind">{isRow ? L('Dieser Eintrag', 'This row') : L('Diese Tabelle', 'This table')}</span>
                    {key ? (
                      <span className="its-info-keys">
                        {pk.map((column) => (
                          <button key={column} type="button" onClick={() => copy(String(key[column]))} title={L('Kopieren', 'Copy')}>
                            <em>{column}</em> <code>{String(key[column])}</code> <Copy size={12} />
                          </button>
                        ))}
                      </span>
                    ) : null}
                  </div>
                  {page ? (
                    <Link className="its-btn is-primary is-sm" to={page} onClick={onClose}>
                      <span>{L('In der Konsole öffnen', 'Open in console')}</span> <ArrowRight size={13} />
                    </Link>
                  ) : null}
                </div>
                <p>{tableAbout(table, meta?.comment)}</p>
                {isRow && counting ? <p className="its-info-plain is-info">{L('Verknüpfte Zeilen werden gezählt …', 'Counting linked rows …')}</p> : null}
                {!isRow ? (
                  <p className="its-info-plain is-info">
                    {L(
                      `Beim Löschen einer Zeile: in ${incoming.filter((fk) => fk.on_delete === 'CASCADE').length} Tabellen wird mitgelöscht, in ${incoming.filter((fk) => ['SET NULL', 'SET DEFAULT'].includes(fk.on_delete)).length} Tabellen wird die Verknüpfung geleert.`,
                      `Deleting a row here deletes linked rows in ${incoming.filter((fk) => fk.on_delete === 'CASCADE').length} tables and clears the link in ${incoming.filter((fk) => ['SET NULL', 'SET DEFAULT'].includes(fk.on_delete)).length} tables.`,
                    )}
                  </p>
                ) : null}
                {isRow && !counting ? (
                  <p className={`its-info-plain${blocked.length ? ' is-error' : cascadeCount ? ' is-warn' : nullCount ? ' is-info' : ' is-ok'}`}>
                    {blocked.length
                      ? L('Diese Zeile kann so nicht gelöscht werden: andere Zeilen hängen noch daran.', 'This row cannot be deleted as is: other rows still depend on it.')
                      : cascadeCount || nullCount
                        ? L(
                          `Wird diese Zeile gelöscht, werden ${cascadeCount} weitere Zeilen mitgelöscht und bei ${nullCount} Zeilen die Verknüpfung geleert.`,
                          `If this row is deleted, ${cascadeCount} other rows are deleted too and ${nullCount} rows lose their link.`,
                        )
                        : L('Nichts anderes hängt an dieser Zeile.', 'Nothing else depends on this row.')}
                  </p>
                ) : null}
              </div>

              <ErrorBanner error={info.error} onRetry={info.reload} />

              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: 'overview', label: L('Überblick', 'Overview') },
                  { value: 'links', label: L('Verknüpfte Daten', 'Connected data'), count: outgoing.length + incoming.length },
                  { value: 'delete', label: L('Beim Löschen', 'If deleted') },
                  { value: 'fields', label: L('Alle Felder', 'All fields'), count: meta?.columns?.length },
                  { value: 'sql', label: 'SQL' },
                ]}
              />

              {tab === 'overview' ? (
                <div className="its-stack">
                  <div className="its-facts">
                    <Fact label={L('Primärschlüssel', 'Primary key')} value={<code>{pk.join(', ') || '—'}</code>} />
                    <Fact label={L('Zeilen (ca.)', 'Rows (approx.)')} value={meta?.estimated_rows ?? '—'} />
                    <Fact label={L('Verweist auf', 'Links to')} value={outgoing.length} />
                    <Fact label={L('Verwiesen von', 'Linked from')} value={incoming.length} />
                    <Fact label="RLS" value={meta?.rls === false ? L('aus', 'off') : L('an (nur Server)', 'on (server only)')} />
                    {triggers.length ? <Fact label={L('Lösch-Trigger', 'Delete triggers')} value={triggers.length} /> : null}
                  </div>
                  {isRow && current ? (
                    <dl className="its-kv">
                      {listColumns(meta, table).map((column) => (
                        <div key={column}>
                          <dt>{columnLabel(column)}</dt>
                          <dd><Cell table={table} column={column} value={current[column]} /></dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {isAuth ? (
                    <Banner tone="info">
                      {L(
                        'Logins nie per SQL ändern oder löschen. Sperren, E-Mail, Passwort-Link und Löschen gehen über die Seite „Nutzer“ oder Supabase → Authentication. Beim Löschen eines Logins entfernt Supabase auch dessen Sitzungen und Identitäten (auth-Schema).',
                        'Never change or delete logins with SQL. Blocking, email, password link and deleting go through the Users page or Supabase → Authentication. Deleting a login also removes its sessions and identities (auth schema).',
                      )}
                    </Banner>
                  ) : null}
                </div>
              ) : null}

              {tab === 'links' ? (
                <div className="its-stack">
                  <section>
                    <h3 className="its-info-h"><ArrowUpRight size={15} /> {L('Verweist auf', 'Links to')}</h3>
                    {!outgoing.length ? <p className="its-muted">{L('Keine Verweise.', 'No links.')}</p> : null}
                    <div className="its-link-list">
                      {outgoing.map((fk) => {
                        const values = current ? fk.columns.map((column) => current[column]) : [];
                        const canFollow = isRow && values.every((value) => value !== null && value !== undefined);
                        return (
                          <div key={fk.name} className="its-link-row">
                            <div>
                              <div className="its-link-title">
                                <TableIcon table={fk.ref_table} size="sm" />
                                <strong>{fk.columns.map(columnLabel).join(', ')}</strong> <ArrowRight size={12} /> <strong>{tableLabel(fk.ref_table)}</strong>
                                <code className="its-muted">{fk.columns.join(', ')} → {cleanTable(fk.ref_table)}.{fk.ref_columns.join(', ')}</code>
                              </div>
                              {isRow ? <div className="its-muted"><code>= {values.map((value) => cellText(value) || 'NULL').join(', ')}</code></div> : null}
                              <div className="its-muted"><RuleBadge rule={fk.on_delete} /> {pick(PARENT_RULE_TEXT[fk.on_delete])}</div>
                            </div>
                            {canFollow ? <Button size="sm" tone="ghost" onClick={() => follow(fk)}>{L('Öffnen', 'Open')} <ArrowRight size={13} /></Button> : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section>
                    <h3 className="its-info-h"><ArrowDownLeft size={15} /> {L('Verwiesen von', 'Linked from')}</h3>
                    {!incoming.length ? <p className="its-muted">{L('Nichts verweist auf diese Tabelle.', 'Nothing points at this table.')}</p> : null}
                    <div className="its-link-list">
                      {incoming.map((fk) => {
                        const has = (fk.count || 0) > 0;
                        return (
                          <div key={fk.name} className={`its-link-row${isRow && !has && info.data ? ' is-dim' : ''}`}>
                            <div>
                              <div className="its-link-title">
                                <TableIcon table={fk.table} size="sm" />
                                <strong>{tableLabel(fk.table)}</strong>
                                <span className="its-muted">{L(`als „${fk.columns.map(columnLabel).join(', ')}“`, `as "${fk.columns.map(columnLabel).join(', ')}"`)}</span>
                                <code className="its-muted">{cleanTable(fk.table)}.{fk.columns.join(', ')}</code>
                              </div>
                              <div className="its-muted"><RuleBadge rule={fk.on_delete} /> {pick(RULE_TEXT[fk.on_delete])}</div>
                            </div>
                            {isRow ? (
                              <button
                                type="button"
                                className={`its-count${has ? ' is-on' : ''}`}
                                disabled={!has || fk.columns.length !== 1}
                                onClick={() => openLinked(fk)}
                                title={has ? L('Zeilen anzeigen', 'Show rows') : undefined}
                              >
                                {counting ? '…' : fk.count ?? '?'}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              ) : null}

              {tab === 'delete' ? (
                <div className="its-stack">
                  {blocked.length ? (
                    <Banner tone="error">
                      <TriangleAlert size={14} /> {L(
                        `Löschen schlägt fehl, solange verknüpfte Zeilen existieren: ${blocked.map((fk) => `${cleanTable(fk.table)} (${fk.count})`).join(', ')}.`,
                        `A delete fails while linked rows exist: ${blocked.map((fk) => `${cleanTable(fk.table)} (${fk.count})`).join(', ')}.`,
                      )}
                    </Banner>
                  ) : null}
                  {!tree.length && !triggers.length ? (
                    <Banner tone="ok">{L('Nichts verweist hierher: Löschen betrifft nur diese Zeile.', 'Nothing points here: a delete affects only this row.')}</Banner>
                  ) : (
                    <>
                      <p className="its-muted">{isRow
                        ? L('Wird diese Zeile gelöscht, passiert in diesen Tabellen:', 'If this row is deleted, this happens in these tables:')
                        : L('Wird eine Zeile dieser Tabelle gelöscht, passiert in diesen Tabellen:', 'If a row of this table is deleted, this happens in these tables:')}
                      </p>
                      <CascadeList nodes={tree} />
                    </>
                  )}
                  {triggers.map((trigger) => (
                    <Banner key={trigger.name} tone="warn">
                      <Zap size={14} /> <strong>{trigger.timing} DELETE</strong> <code>{trigger.function}</code>
                      {' '}{TRIGGER_DOCS[cleanTable(trigger.function)] ? pick(TRIGGER_DOCS[cleanTable(trigger.function)]) : L('Trigger ohne Beschreibung: Funktion in Supabase prüfen.', 'Trigger without a description: check the function in Supabase.')}
                    </Banner>
                  ))}
                  <Banner tone="info">
                    {L(
                      'Die Konsole löscht hier nichts. Vor einem Löschen in Supabase: Sicherung anlegen, Grund im Aktivitätsprotokoll festhalten, Zahlungen/Rechnungen nie löschen.',
                      'The console deletes nothing here. Before deleting in Supabase: take a backup, record the reason, and never delete payments/invoices.',
                    )}
                  </Banner>
                </div>
              ) : null}

              {tab === 'fields' ? (
                <div className="its-stack">
                  <SearchInput value={fieldFilter} onChange={setFieldFilter} placeholder={L('Felder filtern …', 'Filter fields …')} />
                  <dl className="its-fields">
                    {fields.map((column) => (
                      <div key={column.name}>
                        <dt>
                          {columnLabel(column.name) !== column.name ? <strong>{columnLabel(column.name)}</strong> : null}
                          <code>{column.name}</code>
                          {column.type ? <small>{column.type}{column.nullable ? '' : ' · not null'}{column.default ? ` · default ${column.default}` : ''}</small> : null}
                        </dt>
                        <dd>
                          {!isRow ? <span className="its-muted">—</span>
                            : current?.[column.name] === null || current?.[column.name] === undefined
                              ? <span className="its-muted">NULL</span>
                              : typeof current[column.name] === 'object'
                                ? <code>{JSON.stringify(current[column.name], null, 2)}</code>
                                : (
                                  <span className="its-field-value">
                                    <Cell table={table} column={column.name} value={current[column.name]} />
                                    {displayValue(table, column.name, current[column.name]).text !== String(current[column.name])
                                      ? <code className="its-muted">{String(current[column.name])}</code>
                                      : null}
                                  </span>
                                )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {checks.length ? (
                    <section>
                      <h3 className="its-info-h">{L('Erlaubte Werte (CHECK)', 'Allowed values (CHECK)')}</h3>
                      <div className="its-link-list">
                        {checks.map((check) => (
                          <div key={check.name} className="its-link-row">
                            <div><code className="its-muted">{check.name}</code><div><code>{check.definition}</code></div></div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}

              {tab === 'sql' ? (
                <div className="its-stack">
                  <p className="its-muted">{L(
                    'Fertige Abfragen zum Kopieren in den Supabase SQL Editor. Änderungen werden in Supabase gemacht, nicht in der Konsole.',
                    'Ready-to-copy queries for the Supabase SQL Editor. Changes are made in Supabase, not in the console.',
                  )}</p>
                  {statements.map((statement, index) => <SqlBlock key={index} label={statement.label} sql={statement.sql} />)}
                  <div className="its-row-actions">
                    <Button size="sm" icon={Copy} onClick={() => copy(statements.map((statement) => statement.sql).join('\n'))}>{L('Alles kopieren', 'Copy all')}</Button>
                    <a className="its-btn is-primary is-sm" href={supabaseDashboardUrl(projectRef, 'sql/new')} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> <span>{L('SQL Editor öffnen', 'Open SQL Editor')}</span>
                    </a>
                    <a className="its-btn is-default is-sm" href={supabaseDashboardUrl(projectRef, isAuth ? 'auth/users' : 'editor')} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> <span>{isAuth ? L('Authentication öffnen', 'Open Authentication') : L('Table Editor öffnen', 'Open Table Editor')}</span>
                    </a>
                  </div>
                </div>
              ) : null}
            </>
          )}
          {!rel ? <Loading /> : null}
        </div>
      ) : null}
    </Drawer>
  );
}
