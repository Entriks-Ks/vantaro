-- VANTARO IT Support console: read-only map of the database ("Database" page).
-- Run in the Supabase SQL Editor of each project (Development and Production).
-- Safe to re-run.
--
-- Adds one function, public.it_support_relations(). It returns:
--   foreign_keys     every foreign key that starts or ends at a public table (incl. links to auth.users),
--                    with its ON DELETE rule
--   delete_triggers  every DELETE trigger on a public table
--   checks           every CHECK constraint on a public table (allowed values, e.g. lead status)
--   tables           every public table with its primary key, columns, comment and estimated row count
--
-- Add-only and read-only: nothing else changes. Only the server (service_role) may call it.
-- Undo: drop function if exists public.it_support_relations();

create or replace function public.it_support_relations()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'foreign_keys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.conname,
        'table', c.conrelid::regclass::text,
        'columns', (select jsonb_agg(a.attname order by k.ord)
                    from unnest(c.conkey) with ordinality k(attnum, ord)
                    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum),
        'ref_table', c.confrelid::regclass::text,
        'ref_columns', (select jsonb_agg(a.attname order by k.ord)
                        from unnest(c.confkey) with ordinality k(attnum, ord)
                        join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum),
        'on_delete', case c.confdeltype
                       when 'c' then 'CASCADE'
                       when 'n' then 'SET NULL'
                       when 'd' then 'SET DEFAULT'
                       when 'r' then 'RESTRICT'
                       else 'NO ACTION'
                     end
      ) order by c.conrelid::regclass::text, c.conname)
      from pg_constraint c
      where c.contype = 'f'
        and (c.connamespace = 'public'::regnamespace
             or c.confrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace))
    ), '[]'::jsonb),

    'delete_triggers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', t.tgrelid::regclass::text,
        'name', t.tgname,
        'function', t.tgfoid::regproc::text,
        'timing', case when (t.tgtype & 2) = 2 then 'BEFORE' else 'AFTER' end,
        'enabled', t.tgenabled <> 'D'
      ) order by t.tgrelid::regclass::text, t.tgname)
      from pg_trigger t
      join pg_class rel on rel.oid = t.tgrelid
      where not t.tgisinternal
        and (t.tgtype & 8) = 8                      -- fires on DELETE
        and rel.relnamespace = 'public'::regnamespace
    ), '[]'::jsonb),

    'checks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', c.conrelid::regclass::text,
        'name', c.conname,
        'definition', pg_get_constraintdef(c.oid)
      ) order by c.conrelid::regclass::text, c.conname)
      from pg_constraint c
      where c.contype = 'c'
        and c.connamespace = 'public'::regnamespace
    ), '[]'::jsonb),

    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', c.relname,
        'comment', obj_description(c.oid, 'pg_class'),
        'estimated_rows', greatest(c.reltuples, 0)::bigint,
        'rls', c.relrowsecurity,
        'primary_key', coalesce((
          select jsonb_agg(a.attname order by array_position(i.indkey::int2[], a.attnum))
          from pg_index i
          join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
          where i.indrelid = c.oid and i.indisprimary
        ), '[]'::jsonb),
        'columns', (
          select jsonb_agg(jsonb_build_object(
            'name', a.attname,
            'type', format_type(a.atttypid, a.atttypmod),
            'nullable', not a.attnotnull,
            'default', pg_get_expr(d.adbin, d.adrelid)
          ) order by a.attnum)
          from pg_attribute a
          left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
        )
      ) order by c.relname)
      from pg_class c
      where c.relnamespace = 'public'::regnamespace
        and c.relkind in ('r', 'p')
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.it_support_relations() from public, anon, authenticated;
grant execute on function public.it_support_relations() to service_role;

notify pgrst, 'reload schema';
