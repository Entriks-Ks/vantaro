import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Database as DatabaseIcon,
  Eraser,
  Info,
  Link2,
  RefreshCw,
  Table2,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { label, ROLE } from './format';
import { L } from './i18n';
import { Banner, Button, Card, Chip, CopyId, DataTable, EmptyState, ErrorBanner, Loading, Page, SearchInput, Segmented, Stat, useApi } from './ui';
import TableInfo, { RuleBadge } from './TableInfo';
import { Cell, TableIcon } from './dbUi';
import {
  AUTH_USERS,
  AUTH_USERS_META,
  cleanTable,
  columnLabel,
  GROUPS,
  incomingKeys,
  listColumns,
  outgoingKeys,
  rowPage,
  tableAbout,
  tableLabel,
  tableMeta,
  tableOrder,
  tableUi,
} from './schemaDocs';

function Legend() {
  return (
    <div className="its-db-legend">
      <strong>{L('So lesen:', 'How to read:')}</strong>
      <span><RuleBadge rule="CASCADE" /> {L('wird beim Löschen mitgelöscht', 'deleted along with it')}</span>
      <span><RuleBadge rule="SET NULL" /> {L('bleibt, Verknüpfung wird geleert', 'kept, link is cleared')}</span>
      <span><RuleBadge rule="NO ACTION" /> {L('blockiert das Löschen', 'blocks the delete')}</span>
      <span><RuleBadge rule={null} /> {L('Verknüpfung ohne Fremdschlüssel', 'link without a foreign key')}</span>
    </div>
  );
}

/* ---------- Tables tab ---------- */

function TableCard({ rel, table, count, onOpen }) {
  const out = outgoingKeys(rel, table);
  const targets = [...new Set(out.map((fk) => cleanTable(fk.ref_table)))];
  const linkedFrom = new Set(incomingKeys(rel, table).map((fk) => cleanTable(fk.table))).size;
  const ui = tableUi(table);
  return (
    <button type="button" className="its-db-card" onClick={() => onOpen({ table })}>
      <div className="its-db-card-top">
        <TableIcon table={table} />
        <div className="its-db-card-name">
          <strong>{tableLabel(table)}</strong>
          <code>{table === AUTH_USERS ? AUTH_USERS : `public.${table}`}</code>
        </div>
        <div className="its-db-card-count">
          <strong>{count ?? '—'}</strong>
          <span>{L('Zeilen', 'rows')}</span>
        </div>
      </div>
      <p>{ui.summary || tableAbout(table)}</p>
      <div className="its-db-card-links">
        {targets.length ? targets.map((target) => (
          <span key={target} className="its-db-pill"><ArrowUpRight size={11} /> {tableLabel(target)}</span>
        )) : <span className="its-db-pill is-muted">{L('verweist auf nichts', 'links to nothing')}</span>}
        {linkedFrom ? <span className="its-db-pill is-in"><Link2 size={11} /> {linkedFrom === 1 ? L('1 Tabelle verweist hierher', '1 table links here') : L(`${linkedFrom} Tabellen verweisen hierher`, `${linkedFrom} tables link here`)}</span> : null}
      </div>
    </button>
  );
}

function TablesView({ map, onOpen }) {
  const { relations: rel, counts } = map;
  const [q, setQ] = useState('');
  const tables = useMemo(() => [AUTH_USERS_META, ...rel.tables], [rel]);
  const needle = q.trim().toLowerCase();
  const visible = tables.filter((table) => !needle
    || table.table.toLowerCase().includes(needle)
    || tableLabel(table.table).toLowerCase().includes(needle)
    || table.columns.some((column) => column.name.toLowerCase().includes(needle)));
  const totalRows = rel.tables.reduce((sum, table) => sum + (counts?.[table.table] || 0), 0);

  return (
    <div className="its-stack">
      <div className="its-stats is-compact">
        <Stat label={L('Tabellen', 'Tables')} value={tables.length} icon={Table2} hint={L('inkl. Logins', 'incl. logins')} />
        <Stat label={L('Zeilen gesamt', 'Rows in total')} value={totalRows.toLocaleString()} icon={DatabaseIcon} hint={L('ohne Logins', 'without logins')} />
        <Stat label={L('Konten', 'Accounts')} value={counts?.[AUTH_USERS]} icon={Users} hint="auth.users" />
        <Stat label={L('Verknüpfungen', 'Links')} value={rel.foreign_keys.length} icon={Link2} hint={L('zwischen Tabellen', 'between tables')} />
      </div>

      <Card>
        <div className="its-db-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder={L('Tabelle oder Spalte suchen …', 'Search table or column …')} />
          <Legend />
        </div>
      </Card>

      {!visible.length ? <EmptyState icon={Table2} title={L('Keine passende Tabelle', 'No matching table')} /> : null}

      {GROUPS.map((group) => {
        const inGroup = visible.filter((table) => tableUi(table.table).group === group.id).sort((a, b) => tableOrder(a.table) - tableOrder(b.table));
        if (!inGroup.length) return null;
        return (
          <section key={group.id} className="its-db-group">
            <header>
              <h2>{L(group.label[0], group.label[1])}</h2>
              <span>{L(group.hint[0], group.hint[1])}</span>
            </header>
            <div className="its-db-grid">
              {inGroup.map((table) => (
                <TableCard key={table.table} rel={rel} table={table.table} count={counts?.[table.table]} onOpen={onOpen} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------- User data tab ---------- */

function UserPicker({ onPick }) {
  const [q, setQ] = useState('');
  const users = useApi(q ? '/users' : null, { q, limit: 8 });
  const results = users.data?.users || [];
  return (
    <section className="its-card its-db-picker">
      <header className="its-db-picker-head">
        <span className="its-db-picker-icon" aria-hidden="true"><UserRound size={20} /></span>
        <div>
          <h2>{L('Wessen Daten möchten Sie sehen?', 'Whose data do you want to see?')}</h2>
          <p>{L(
            'Nutzer suchen und auswählen. Danach sehen Sie alles, was in der Datenbank zu diesem Konto gehört.',
            'Search and pick a user. You will then see everything in the database that belongs to that account.',
          )}</p>
        </div>
      </header>
      <div className="its-db-picker-search">
        <SearchInput value={q} onChange={setQ} autoFocus placeholder={L('Name, E-Mail, Kundennummer oder ID …', 'Name, email, customer number or ID …')} />
      </div>
      <ErrorBanner error={users.error} />
      {!q ? (
        <p className="its-db-picker-hint">{L('Tipp: Sie können auch in einem Nutzer-Fenster auf „Datenbank“ klicken.', 'Tip: you can also click "Database" in a user\'s panel on the Users page.')}</p>
      ) : users.loading && !results.length ? (
        <Loading />
      ) : !results.length ? (
        <EmptyState icon={UserRound} title={L('Kein Nutzer gefunden', 'No user found')}>{L('Anderen Suchbegriff versuchen.', 'Try another search term.')}</EmptyState>
      ) : (
        <ul className="its-db-results">
          {results.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => onPick(row.id)}>
                <span className="its-avatar" aria-hidden="true">{initials(row.fullName || row.email)}</span>
                <span className="its-db-results-text">
                  <strong>{row.fullName || row.email}</strong>
                  <small>{row.email}</small>
                </span>
                <Chip tone={row.role === 'berater' ? 'neutral' : 'info'} icon={false}>{label(ROLE, row.role)}</Chip>
                <ArrowRight size={15} className="its-db-results-go" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function initials(text) {
  return String(text || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function displayName(user) {
  const meta = user.user_metadata || {};
  return meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || user.email;
}

function sectionTitle(section) {
  if (section.table === AUTH_USERS) return L('Partner-Konten dieser Firma', 'Partner accounts of this company');
  if (section.table === 'it_support_audit_log') return L('Konsolen-Aktionen zu diesem Nutzer', 'Console actions on this user');
  return tableLabel(section.table);
}

function sectionVia(section) {
  if (section.table === AUTH_USERS) return L('über user_metadata.energy_company_id', 'via user_metadata.energy_company_id');
  if (section.noForeignKey) return L(`über ${section.column}`, `via ${section.column}`);
  return L(`als „${columnLabel(section.column)}“`, `as "${columnLabel(section.column)}"`);
}

const sectionAnchor = (section) => `db-${section.key.replace(/[^a-z0-9]+/gi, '-')}`;

function UserData({ map, userId, onOpen, onClear }) {
  const rel = map.relations;
  const { data, error, loading, reload } = useApi(`/database/users/${userId}`);

  if (!data && loading) return <Loading />;
  if (!data) return <ErrorBanner error={error} onRetry={reload} />;

  const { user, sections } = data;
  const withRows = sections.filter((section) => section.total);
  const empty = sections.filter((section) => !section.total && !section.error);
  const sum = (rule) => sections.filter((section) => section.onDelete === rule).reduce((total, section) => total + (section.total || 0), 0);
  const cascade = sum('CASCADE');
  const cleared = sum('SET NULL');
  const name = displayName(user);

  return (
    <div className="its-stack">
      <section className="its-db-profile">
        <span className="its-db-avatar" aria-hidden="true">{initials(name)}</span>
        <div className="its-db-profile-text">
          <h2>{name}</h2>
          <p>{user.email}</p>
          <div className="its-db-profile-chips">
            <Chip tone={user.role === 'berater' ? 'neutral' : 'info'} icon={false}>{label(ROLE, user.role)}</Chip>
            <CopyId value={user.id} />
            {data.company ? <Chip icon={false}>{L('Partner einer Firma', 'Partner of a company')} <CopyId value={data.company} /></Chip> : null}
          </div>
        </div>
        <div className="its-db-profile-actions">
          <Link className="its-btn is-primary is-sm" to={`/it-support/users?id=${user.id}`}><UserRound size={14} /><span>{L('Nutzerseite', 'User page')}</span></Link>
          <Button size="sm" icon={Info} onClick={() => onOpen({ table: AUTH_USERS, row: user })}>{L('Login-Details', 'Login details')}</Button>
          <Button size="sm" tone="ghost" icon={RefreshCw} onClick={reload} aria-label={L('Neu laden', 'Reload')} />
          <Button size="sm" tone="ghost" onClick={onClear}>{L('Anderer Nutzer', 'Other user')}</Button>
        </div>
      </section>

      <div className="its-db-impact">
        <div><DatabaseIcon size={16} /><span><strong>{withRows.reduce((total, section) => total + section.total, 0)}</strong> {L(`Zeilen in ${withRows.length} Bereichen`, `rows in ${withRows.length} areas`)}</span></div>
        <div className={cascade ? 'is-error' : ''}><Trash2 size={16} /><span><strong>{cascade}</strong> {L('würden beim Löschen des Kontos mitgelöscht', 'would be deleted with the account')}</span></div>
        <div className={cleared ? 'is-warn' : ''}><Eraser size={16} /><span><strong>{cleared}</strong> {L('würden ihre Verknüpfung verlieren (NULL)', 'would lose their link (NULL)')}</span></div>
      </div>

      {withRows.length ? (
        <div className="its-db-tiles">
          {withRows.map((section) => (
            <a key={section.key} className="its-db-tile" href={`#${sectionAnchor(section)}`} title={`${sectionTitle(section)} · ${sectionVia(section)}`}>
              <TableIcon table={section.table} size="sm" />
              <span>
                <strong>{sectionTitle(section)}</strong>
                <small>{sectionVia(section)}</small>
              </span>
              <em>{section.total}</em>
            </a>
          ))}
        </div>
      ) : <EmptyState icon={DatabaseIcon} title={L('Zu diesem Konto gibt es keine Daten.', 'There is no data for this account.')} />}

      {empty.length ? (
        <div className="its-db-none">
          <span>{L('Keine Daten in', 'No data in')}</span>
          {empty.map((section) => (
            <span key={section.key} className="its-db-pill is-muted" title={section.key}>
              {sectionTitle(section)}{section.table !== AUTH_USERS && section.table !== 'it_support_audit_log' ? ` · ${columnLabel(section.column)}` : ''}
            </span>
          ))}
        </div>
      ) : null}

      {sections.filter((section) => section.total || section.error).map((section) => {
        const meta = tableMeta(rel, section.table);
        const pk = meta?.primary_key || ['id'];
        const columns = listColumns(meta, section.table).slice(0, 5);
        const withPage = section.rows.some((row) => rowPage(section.table, row));
        return (
          <section key={section.key} id={sectionAnchor(section)} className="its-card is-flush its-db-section">
            <header className="its-card-head">
              <div className="its-db-section-title">
                <TableIcon table={section.table} />
                <div>
                  <h2>{sectionTitle(section)} <em>{section.total ?? '?'}</em></h2>
                  <p className="its-db-via">
                    {sectionVia(section)} <RuleBadge rule={section.onDelete} />
                    {section.truncated ? <span>{L(`erste ${data.rowLimit} angezeigt`, `first ${data.rowLimit} shown`)}</span> : null}
                  </p>
                </div>
              </div>
              <div className="its-card-actions">
                <Button size="sm" tone="ghost" icon={Info} onClick={() => onOpen({ table: section.table })}>{L('Über die Tabelle', 'About the table')}</Button>
              </div>
            </header>
            <div className="its-card-body">
              {section.error ? <Banner tone="error">{section.error}</Banner> : null}
              <DataTable
                rows={section.rows}
                rowKey={(row) => JSON.stringify(pk.map((column) => row[column]))}
                onRowClick={(row) => onOpen({ table: section.table, row })}
                empty={<EmptyState title={L('Keine Zeilen', 'No rows')} />}
                columns={[
                  ...columns.map((key) => ({
                    key,
                    label: columnLabel(key),
                    render: (row) => <Cell table={section.table} column={key} value={row[key]} />,
                  })),
                  ...(withPage ? [{
                    key: '_page',
                    label: '',
                    className: 'is-num',
                    render: (row) => (rowPage(section.table, row) ? (
                      <Link className="its-link" to={rowPage(section.table, row)} onClick={(event) => event.stopPropagation()}>
                        {L('Öffnen', 'Open')} <ArrowRight size={12} />
                      </Link>
                    ) : null),
                  }] : []),
                ]}
              />
            </div>
          </section>
        );
      })}

      <Card><Legend /></Card>
    </div>
  );
}

/* ---------- page ---------- */

export default function DatabasePage() {
  const [params, setParams] = useSearchParams();
  const map = useApi('/database/relations');
  const [target, setTarget] = useState(null);
  const view = params.get('user') || params.get('view') === 'user' ? 'user' : 'tables';
  const userId = params.get('user') || '';

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  return (
    <Page
      title={L('Datenbank', 'Database')}
      description={L(
        'Wo welche Daten liegen und womit sie verknüpft sind. Nur lesen: Änderungen werden in Supabase gemacht.',
        'Where data lives and what it is linked to. Read-only: changes are made in Supabase.',
      )}
      actions={(
        <>
          <Segmented
            value={view}
            onChange={(next) => update(next === 'user' ? { view: 'user' } : { view: '', user: '' })}
            options={[
              { value: 'tables', label: L('Alle Tabellen', 'All tables') },
              { value: 'user', label: L('Daten eines Nutzers', 'Data of a user') },
            ]}
          />
          <Button size="sm" tone="ghost" icon={RefreshCw} onClick={map.reload} aria-label={L('Neu laden', 'Reload')} />
        </>
      )}
    >
      {map.error?.code === 'schema_map_missing' ? (
        <Banner tone="warn">{map.error.message}</Banner>
      ) : (
        <ErrorBanner error={map.error} onRetry={map.reload} />
      )}
      {!map.data && map.loading ? <Loading /> : null}
      {map.data ? (
        view === 'user' ? (
          userId
            ? <UserData map={map.data} userId={userId} onOpen={setTarget} onClear={() => update({ user: '', view: 'user' })} />
            : <UserPicker onPick={(id) => update({ user: id, view: '' })} />
        ) : (
          <TablesView map={map.data} onOpen={setTarget} />
        )
      ) : null}
      <TableInfo rel={map.data?.relations} projectRef={map.data?.projectRef} target={target} onClose={() => setTarget(null)} />
    </Page>
  );
}
