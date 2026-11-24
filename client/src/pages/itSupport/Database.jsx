import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Database as DatabaseIcon, Info, RefreshCw, UserRound } from 'lucide-react';
import { label, ROLE } from './format';
import { L } from './i18n';
import { Banner, Button, Card, Chip, CopyId, DataTable, EmptyState, ErrorBanner, Loading, Page, SearchInput, Segmented, useApi } from './ui';
import TableInfo, { RuleBadge } from './TableInfo';
import {
  AUTH_USERS,
  AUTH_USERS_META,
  cellText,
  incomingKeys,
  listColumns,
  outgoingKeys,
  tableAbout,
  tableLabel,
  tableMeta,
} from './schemaDocs';

/* ---------- Tables tab ---------- */

function TablesView({ map, onOpen }) {
  const { relations: rel, counts } = map;
  const [q, setQ] = useState('');
  const tables = useMemo(() => [AUTH_USERS_META, ...rel.tables], [rel]);
  const needle = q.trim().toLowerCase();
  const rows = tables.filter((table) => !needle
    || table.table.toLowerCase().includes(needle)
    || tableLabel(table.table).toLowerCase().includes(needle)
    || table.columns.some((column) => column.name.toLowerCase().includes(needle)));

  return (
    <Card
      flush
      title={L('Tabellen', 'Tables')}
      description={L(
        'Alle Tabellen mit Zweck, Zeilenzahl und Verknüpfungen. Klick öffnet das Info-Fenster: Verknüpfungen, was ein Löschen auslöst, Felder und SQL.',
        'Every table with its purpose, row count and links. A click opens the info window: connections, what a delete sets off, fields and SQL.',
      )}
      actions={<SearchInput value={q} onChange={setQ} placeholder={L('Tabelle oder Spalte …', 'Table or column …')} />}
    >
      <DataTable
        rowKey={(row) => row.table}
        rows={rows}
        onRowClick={(row) => onOpen({ table: row.table })}
        columns={[
          {
            key: 'table',
            label: L('Tabelle', 'Table'),
            render: (row) => (
              <div className="its-db-name">
                <strong>{tableLabel(row.table)}</strong>
                <code>{row.table === AUTH_USERS ? AUTH_USERS : `public.${row.table}`}</code>
              </div>
            ),
          },
          { key: 'about', label: L('Wofür', 'What for'), render: (row) => <span className="its-db-about">{tableAbout(row.table, row.comment)}</span> },
          { key: 'rows', label: L('Zeilen', 'Rows'), className: 'is-num', render: (row) => (counts?.[row.table] ?? '—') },
          { key: 'out', label: L('Verweist auf', 'Links to'), className: 'is-num', render: (row) => outgoingKeys(rel, row.table).length },
          { key: 'in', label: L('Verwiesen von', 'Linked from'), className: 'is-num', render: (row) => incomingKeys(rel, row.table).length },
        ]}
      />
    </Card>
  );
}

/* ---------- User data tab ---------- */

function UserPicker({ onPick }) {
  const [q, setQ] = useState('');
  const users = useApi(q ? '/users' : null, { q, limit: 8 });
  return (
    <Card title={L('Nutzer wählen', 'Pick a user')} description={L('Name, E-Mail, Kundennummer oder ID.', 'Name, email, customer number or ID.')}>
      <SearchInput value={q} onChange={setQ} autoFocus placeholder={L('Nutzer suchen …', 'Search user …')} />
      <ErrorBanner error={users.error} />
      {q ? (
        <DataTable
          rows={users.data?.users}
          loading={users.loading}
          onRowClick={(row) => onPick(row.id)}
          columns={[
            { key: 'name', label: 'Name', render: (row) => row.fullName || '—' },
            { key: 'email', label: L('E-Mail', 'Email') },
            { key: 'role', label: L('Rolle', 'Role'), render: (row) => label(ROLE, row.role) },
            { key: 'id', label: 'ID', render: (row) => <CopyId value={row.id} /> },
          ]}
        />
      ) : null}
    </Card>
  );
}

function sectionTitle(section) {
  if (section.table === AUTH_USERS) return L('Partner-Konten dieser Firma', 'Partner accounts of this company');
  if (section.table === 'it_support_audit_log') return L('Konsolen-Aktionen zu diesem Nutzer', 'Console actions on this user');
  return tableLabel(section.table);
}

function UserData({ map, userId, onOpen, onClear }) {
  const rel = map.relations;
  const { data, error, loading, reload } = useApi(`/database/users/${userId}`);
  const [hideEmpty, setHideEmpty] = useState(true);

  if (!data && loading) return <Loading />;
  if (!data) return <ErrorBanner error={error} onRetry={reload} />;

  const { user, sections } = data;
  const withRows = sections.filter((section) => section.total);
  const shown = hideEmpty ? withRows : sections;
  const cascade = sections.filter((section) => section.onDelete === 'CASCADE').reduce((sum, section) => sum + (section.total || 0), 0);
  const cleared = sections.filter((section) => section.onDelete === 'SET NULL').reduce((sum, section) => sum + (section.total || 0), 0);

  return (
    <div className="its-stack">
      <Card
        title={<span className="its-search-head"><UserRound size={16} /> {user.email}</span>}
        description={L(
          'Alle Zeilen in der Datenbank, die zu diesem Login gehören, gruppiert nach Tabelle und Spalte. Klick auf eine Zeile öffnet das Info-Fenster.',
          'Every row in the database that belongs to this login, grouped by table and column. Click a row for the info window.',
        )}
        actions={(
          <>
            <Button size="sm" tone="ghost" icon={RefreshCw} onClick={reload} aria-label={L('Neu laden', 'Reload')} />
            <Button size="sm" icon={Info} onClick={() => onOpen({ table: AUTH_USERS, row: user })}>{L('Login-Info', 'Login info')}</Button>
            <Link className="its-btn is-default is-sm" to={`/it-support/users?id=${user.id}`}><span>{L('In „Nutzer“ öffnen', 'Open in Users')}</span></Link>
            <Button size="sm" tone="ghost" onClick={onClear}>{L('Anderer Nutzer', 'Other user')}</Button>
          </>
        )}
      >
        <div className="its-drawer-chips">
          <Chip tone="info" icon={false}>{label(ROLE, user.role)}</Chip>
          <CopyId value={user.id} full />
          {data.company ? (
            <Chip icon={false}>{L('Partner der Firma', 'Partner of company')} <CopyId value={data.company} /></Chip>
          ) : null}
        </div>
        <div className="its-info-sums is-light">
          <div><span>{L('Tabellen mit Daten', 'Tables with data')}</span><strong>{withRows.length} / {sections.length}</strong></div>
          <div className={cascade ? 'is-error' : ''}><span>{L('Beim Löschen des Logins mitgelöscht', 'Deleted with the login')}</span><strong>{cascade}</strong></div>
          <div className={cleared ? 'is-warn' : ''}><span>{L('Beim Löschen geleert (NULL)', 'Cleared on delete (NULL)')}</span><strong>{cleared}</strong></div>
        </div>
        <label className="its-check">
          <input type="checkbox" checked={hideEmpty} onChange={(event) => setHideEmpty(event.target.checked)} />
          {L('Leere Tabellen ausblenden', 'Hide empty tables')}
        </label>
      </Card>

      {!shown.length ? <EmptyState icon={DatabaseIcon} title={L('Keine Daten zu diesem Nutzer.', 'No data for this user.')} /> : null}

      {shown.map((section) => {
        const meta = tableMeta(rel, section.table);
        const pk = meta?.primary_key || ['id'];
        const columns = listColumns(meta, section.table).slice(0, 5);
        return (
          <Card
            key={section.key}
            flush
            title={(
              <span className="its-search-head">
                {sectionTitle(section)} <em>{section.total ?? '?'}</em>
              </span>
            )}
            description={(
              <span className="its-db-via">
                <code>{section.table === AUTH_USERS ? section.column : `${section.table}.${section.column}`}</code>
                <ArrowRight size={12} /> <code>{AUTH_USERS}.id</code>
                <RuleBadge rule={section.onDelete} />
                {section.truncated ? <span>{L(`erste ${data.rowLimit} Zeilen`, `first ${data.rowLimit} rows`)}</span> : null}
              </span>
            )}
            actions={<Button size="sm" tone="ghost" icon={Info} onClick={() => onOpen({ table: section.table })}>{L('Tabelle', 'Table')}</Button>}
          >
            {section.error ? <Banner tone="error">{section.error}</Banner> : null}
            <DataTable
              rows={section.rows}
              rowKey={(row) => JSON.stringify(pk.map((column) => row[column]))}
              onRowClick={(row) => onOpen({ table: section.table, row })}
              empty={<EmptyState title={L('Keine Zeilen', 'No rows')} />}
              columns={[
                { key: '_id', label: pk.join(', '), render: (row) => <CopyId value={String(row[pk[0]] ?? '')} /> },
                ...columns.map((key) => ({
                  key,
                  label: key,
                  render: (row) => <span className="its-cell-clip">{cellText(row[key]) || '—'}</span>,
                })),
              ]}
            />
          </Card>
        );
      })}
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
        'Wo welche Daten liegen, womit sie verknüpft sind und was ein Löschen auslösen würde. Nur lesen: Änderungen werden in Supabase gemacht.',
        'Where data lives, what it is linked to and what a delete would set off. Read-only: changes are made in Supabase.',
      )}
      actions={(
        <>
          <Segmented
            value={view}
            onChange={(next) => update(next === 'user' ? { view: 'user' } : { view: '', user: '' })}
            options={[
              { value: 'tables', label: L('Tabellen', 'Tables') },
              { value: 'user', label: L('Daten eines Nutzers', 'User data') },
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
