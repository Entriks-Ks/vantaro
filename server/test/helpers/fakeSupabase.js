import crypto from 'node:crypto';

/**
 * Minimal in-memory stand-in for the Supabase client: just the query-builder calls
 * the payment code uses (select/insert/update, eq/in/gte, order, single/maybeSingle).
 */
class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.op = 'select';
    this.filters = [];
    this.payload = null;
    this.mode = 'many';
    this.sort = null;
  }

  // insert(...).select() / update(...).select() keep their op; a plain select() is the default.
  select() {
    return this;
  }

  insert(payload) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(patch) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }

  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column, values) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  gte(column, value) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.sort = { column, ascending };
    return this;
  }

  single() {
    this.mode = 'single';
    return this;
  }

  maybeSingle() {
    this.mode = 'maybeSingle';
    return this;
  }

  run() {
    const rows = this.db.tables[this.table];
    if (!rows) {
      return { data: null, error: { code: '42P01', message: `relation "public.${this.table}" does not exist` } };
    }
    let result;
    if (this.op === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      result = list.map((entry) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...structuredClone(entry),
      }));
      rows.push(...result);
    } else {
      const matched = rows.filter((row) => this.filters.every((test) => test(row)));
      if (this.op === 'update') {
        for (const row of matched) Object.assign(row, structuredClone(this.payload));
      }
      result = matched;
    }
    if (this.sort) {
      const { column, ascending } = this.sort;
      result = [...result].sort((a, b) => (a[column] > b[column] ? 1 : -1) * (ascending ? 1 : -1));
    }
    result = result.map((row) => structuredClone(row));
    if (this.mode === 'single') {
      return result.length === 1
        ? { data: result[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
    }
    if (this.mode === 'maybeSingle') return { data: result[0] || null, error: null };
    return { data: result, error: null };
  }

  then(resolve, reject) {
    try {
      resolve(this.run());
    } catch (error) {
      reject(error);
    }
  }
}

export function createFakeSupabase() {
  const db = {
    tables: { lead_payments: [], payment_audit_log: [] },
    users: new Map(),
    tokens: new Map(),
  };
  const client = {
    from: (table) => new Query(db, table),
    auth: {
      async getUser(token) {
        const user = db.tokens.get(token);
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid' } };
      },
      admin: {
        async getUserById(id) {
          const user = db.users.get(id);
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'not found' } };
        },
        async updateUserById(id) {
          return { data: { user: db.users.get(id) }, error: null };
        },
      },
    },
  };
  return { db, client };
}
