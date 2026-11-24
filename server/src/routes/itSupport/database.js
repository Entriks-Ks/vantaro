import { Router } from 'express';
import { supabase, supabaseConfig } from '../../lib/supabase.js';
import { isUuid } from '../../lib/leads.js';
import { getUserRole } from '../../lib/roles.js';
import { toDirectoryUser } from '../../lib/users.js';
import { fail, requireDb, route } from './common.js';
import { tr } from './i18n.js';

/**
 * Database explorer for IT Support: what each table holds, how tables are linked, what a delete
 * would set off, and every row that belongs to one user. Read-only: nothing in this file writes.
 * The table map comes live from public.it_support_relations() (server/supabase/it_support_schema_map.sql).
 */
const router = Router();

export const AUTH_USERS = 'auth.users';
export const ROW_LIMIT = 100;
const SCHEMA_FILE = 'server/supabase/it_support_schema_map.sql';
const CACHE_MS = 60_000;

/** Never sent to the browser: payment secrets and calendar tokens. */
const SECRET_COLUMNS = new Set(['pg_order_password', 'return_token', 'hpp_url', 'refresh_token', 'access_token']);
/** Private to the Berater: the console only says whether there is one (same as the Leads page). */
const PRIVATE_COLUMNS = new Set(['broker_notes']);
const SECRET_KEY = /code|hash|token|secret|password/i;
export const HIDDEN = '•••• (hidden)';

export function maskRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (value === null || value === undefined || value === '') continue;
    if (SECRET_COLUMNS.has(key)) out[key] = HIDDEN;
    else if (PRIVATE_COLUMNS.has(key)) out[key] = `(private, ${String(value).length} characters)`;
  }
  return out;
}

/** Masks secret-looking keys anywhere in user metadata (verification code hashes, reset tokens, …). */
function maskMeta(value) {
  if (Array.isArray(value)) return value.map(maskMeta);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    SECRET_KEY.test(key) && entry !== null && entry !== undefined && entry !== '' ? HIDDEN : maskMeta(entry),
  ]));
}

/** A login from auth.users, shown like a table row (only fields that are safe and useful). */
export function authUserRow(raw) {
  return {
    id: raw.id,
    email: raw.email || null,
    phone: raw.phone || null,
    role: getUserRole(raw),
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    last_sign_in_at: raw.last_sign_in_at || null,
    email_confirmed_at: raw.email_confirmed_at || null,
    banned_until: raw.banned_until || null,
    app_metadata: maskMeta(raw.app_metadata || {}),
    user_metadata: maskMeta(raw.user_metadata || {}),
  };
}

let cache = null;

function schemaMapMissing(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return /PGRST202|could not find the function|it_support_relations/i.test(text);
}

export async function loadRelations(req, { fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const { data, error } = await supabase.rpc('it_support_relations');
  if (error) {
    if (schemaMapMissing(error)) {
      throw fail(tr(req)(
        `Die Datenbank-Übersicht ist noch nicht eingerichtet. Bitte ${SCHEMA_FILE} im Supabase SQL Editor ausführen.`,
        `The database map is not set up yet. Please run ${SCHEMA_FILE} in the Supabase SQL Editor.`,
      ), 503, { code: 'schema_map_missing' });
    }
    throw error;
  }
  const value = {
    foreign_keys: data?.foreign_keys || [],
    delete_triggers: data?.delete_triggers || [],
    checks: data?.checks || [],
    tables: data?.tables || [],
  };
  cache = { at: Date.now(), value };
  return value;
}

export function resetRelationsCache() {
  cache = null;
}

function projectRef() {
  return String(supabaseConfig.url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || null;
}

const publicTable = (rel, name) => rel.tables.find((table) => table.table === name);
const orderColumn = (meta) => ['created_at', 'last_seen_at', 'delivered_at', 'updated_at']
  .find((column) => meta?.columns?.some((entry) => entry.name === column)) || null;

async function exactCount(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? null : count ?? 0;
}

async function listAuthUsers() {
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...(data?.users || []));
    if ((data?.users || []).length < 200) break;
  }
  return users;
}

/* ---------- GET /database/relations: the whole map + exact row counts ---------- */

router.get('/relations', route(async (req, res) => {
  requireDb(req);
  const relations = await loadRelations(req, { fresh: req.query.fresh === '1' });
  const counts = Object.fromEntries(await Promise.all(
    relations.tables.map(async (table) => [table.table, await exactCount(table.table)]),
  ));
  counts[AUTH_USERS] = await listAuthUsers().then((users) => users.length, () => null);
  res.json({ relations, counts, projectRef: projectRef() });
}));

/* ---------- GET /database/users/:id: every row that belongs to one user ---------- */

/**
 * One section per foreign key that points at auth.users (found live, so new tables show up on their own),
 * plus links without a foreign key: console actions on this user and partner accounts of a main company.
 */
export function userSections(rel) {
  return rel.foreign_keys
    .filter((fk) => fk.ref_table === AUTH_USERS && fk.columns.length === 1 && !fk.table.includes('.'))
    .map((fk) => ({ key: `${fk.table}.${fk.columns[0]}`, table: fk.table, column: fk.columns[0], onDelete: fk.on_delete, fk: fk.name }));
}

router.get('/users/:id', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  if (!isUuid(req.params.id)) throw fail(t('Nutzer wurde nicht gefunden.', 'User not found.'), 404);
  const { data: found, error: userError } = await supabase.auth.admin.getUserById(req.params.id);
  if (userError || !found?.user) throw fail(t('Nutzer wurde nicht gefunden.', 'User not found.'), 404);
  const raw = found.user;
  const rel = await loadRelations(req);

  const load = async (section, apply) => {
    const meta = publicTable(rel, section.table);
    let query = apply(supabase.from(section.table).select('*', { count: 'exact' }));
    const order = orderColumn(meta);
    if (order) query = query.order(order, { ascending: false });
    const { data, error, count } = await query.limit(ROW_LIMIT);
    return {
      ...section,
      rows: (data || []).map(maskRow),
      total: error ? null : count ?? (data || []).length,
      truncated: (count ?? 0) > ROW_LIMIT,
      ...(error ? { error: error.message } : {}),
    };
  };

  const sections = await Promise.all(userSections(rel).map((section) => load(section, (query) => query.eq(section.column, raw.id))));

  if (publicTable(rel, 'it_support_audit_log')) {
    sections.push(await load(
      { key: 'it_support_audit_log.target_id', table: 'it_support_audit_log', column: 'target_id', onDelete: null, fk: null, noForeignKey: true },
      (query) => query.eq('target_type', 'user').eq('target_id', raw.id),
    ));
  }

  // Partner accounts (dispatcher, sub-partner, field rep) point at their main company in user_metadata, not by foreign key.
  const directory = toDirectoryUser(raw);
  let partners = [];
  if (directory.partnerRole === 'main') {
    partners = await listAuthUsers()
      .then((users) => users.filter((user) => user.id !== raw.id && toDirectoryUser(user).companyId === raw.id).map(authUserRow), () => []);
  }
  sections.push({
    key: 'auth.users.energy_company_id',
    table: AUTH_USERS,
    column: 'user_metadata.energy_company_id',
    onDelete: null,
    fk: null,
    noForeignKey: true,
    rows: partners.slice(0, ROW_LIMIT),
    total: partners.length,
    truncated: partners.length > ROW_LIMIT,
  });

  res.json({
    user: authUserRow(raw),
    company: directory.partnerRole !== 'main' && isUuid(directory.companyId) ? directory.companyId : null,
    rowLimit: ROW_LIMIT,
    sections,
  });
}));

/* ---------- GET /database/record: one row + how many rows point at it ---------- */

function parseKey(req, primaryKey) {
  let key = req.query.key;
  if (typeof key === 'string') {
    try {
      key = JSON.parse(key);
    } catch {
      key = null;
    }
  }
  if (!key || typeof key !== 'object' || primaryKey.some((column) => key[column] === undefined || key[column] === null || key[column] === '')) {
    throw fail(tr(req)(`Schlüssel fehlt: ${primaryKey.join(', ')}`, `Key is missing: ${primaryKey.join(', ')}`));
  }
  return key;
}

async function incomingCounts(rel, table, row) {
  return Promise.all(rel.foreign_keys
    .filter((fk) => fk.ref_table === table && !fk.table.includes('.'))
    .map(async (fk) => {
      const values = fk.ref_columns.map((column) => row[column]);
      if (values.some((value) => value === null || value === undefined)) return { ...fk, count: 0 };
      let query = supabase.from(fk.table).select('*', { count: 'exact', head: true });
      fk.columns.forEach((column, index) => {
        query = query.eq(column, values[index]);
      });
      const { count, error } = await query;
      return { ...fk, count: error ? null : count ?? 0, ...(error ? { error: error.message } : {}) };
    }));
}

router.get('/record', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const table = String(req.query.table || '');
  const rel = await loadRelations(req);

  if (table === AUTH_USERS) {
    const { id } = parseKey(req, ['id']);
    if (!isUuid(id)) throw fail(t('Nutzer wurde nicht gefunden.', 'User not found.'), 404);
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error || !data?.user) throw fail(t('Nutzer wurde nicht gefunden.', 'User not found.'), 404);
    return res.json({ table, row: authUserRow(data.user), incoming: await incomingCounts(rel, table, data.user) });
  }

  const meta = publicTable(rel, table);
  if (!meta) throw fail(t(`Unbekannte Tabelle: ${table}`, `Unknown table: ${table}`), 404);
  if (!meta.primary_key.length) throw fail(t(`${table} hat keinen Primärschlüssel.`, `${table} has no primary key.`));
  const key = parseKey(req, meta.primary_key);

  let query = supabase.from(table).select('*');
  for (const column of meta.primary_key) query = query.eq(column, key[column]);
  const { data: rows, error } = await query.limit(2);
  if (error) throw error;
  if (!rows || rows.length !== 1) throw fail(t('Eintrag wurde nicht gefunden.', 'Row not found.'), 404);
  res.json({ table, row: maskRow(rows[0]), incoming: await incomingCounts(rel, table, rows[0]) });
}));

/* ---------- GET /database/rows: rows of one table where a linking column has a value ---------- */

router.get('/rows', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const table = String(req.query.table || '');
  const column = String(req.query.column || '');
  const value = String(req.query.value ?? '');
  const rel = await loadRelations(req);
  const meta = publicTable(rel, table);
  if (!meta) throw fail(t(`Unbekannte Tabelle: ${table}`, `Unknown table: ${table}`), 404);
  // Only columns that are part of a foreign key: the explorer follows links, it is not a free query tool.
  const linked = rel.foreign_keys.some((fk) => fk.table === table && fk.columns.includes(column));
  if (!linked || !value) throw fail(t('Nur verknüpfte Spalten können gefiltert werden.', 'Only linked columns can be filtered.'));

  let query = supabase.from(table).select('*', { count: 'exact' }).eq(column, value);
  const order = orderColumn(meta);
  if (order) query = query.order(order, { ascending: false });
  const { data, error, count } = await query.limit(ROW_LIMIT);
  if (error) throw error;
  res.json({ table, column, value, rows: (data || []).map(maskRow), total: count ?? (data || []).length, rowLimit: ROW_LIMIT });
}));

export default router;
