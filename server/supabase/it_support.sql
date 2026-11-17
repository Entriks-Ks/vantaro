-- VANTARO IT Support console: activity log + system event log
-- Run in the Supabase SQL Editor of each project (Development and Production).
-- Safe to re-run.
--
-- it_support_audit_log  Every change made through the IT Support console (who, what, when, why, before/after).
--                       The API refuses console changes while this table is missing, so nothing goes untracked.
-- system_events         Server errors, warnings and integration events (TC-Dial webhooks, reminder job, e-mail, …)
--                       shown under "Systemfehler" in the console.

create table if not exists public.it_support_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text not null,
  actor_role text not null,
  action text not null,
  target_type text not null,
  target_id text,
  target_label text,
  reason text,
  summary text,
  summary_en text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- English summary for the console's English mode (projects that ran an earlier version of this script).
alter table public.it_support_audit_log add column if not exists summary_en text;

create index if not exists it_support_audit_log_created_idx
  on public.it_support_audit_log (created_at desc);

create index if not exists it_support_audit_log_target_idx
  on public.it_support_audit_log (target_type, target_id, created_at desc);

create index if not exists it_support_audit_log_actor_idx
  on public.it_support_audit_log (actor_id, created_at desc);

-- Append-only: the API never updates or deletes log rows.
alter table public.it_support_audit_log enable row level security;
revoke all on public.it_support_audit_log from anon, authenticated;
grant select, insert on public.it_support_audit_log to service_role;

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'error'
    check (level in ('error', 'warning', 'info')),
  source text not null default 'server',
  message text not null,
  context jsonb not null default '{}'::jsonb,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index if not exists system_events_open_idx
  on public.system_events (last_seen_at desc)
  where resolved_at is null;

create index if not exists system_events_source_idx
  on public.system_events (source, last_seen_at desc);

alter table public.system_events enable row level security;
revoke all on public.system_events from anon, authenticated;
grant all on public.system_events to service_role;

-- Retention suggestion (pg_cron), keeps resolved events for 90 days:
--   select cron.schedule('system-events-retention', '0 4 * * *',
--     $$delete from public.system_events where resolved_at is not null and resolved_at < now() - interval '90 days'$$);

notify pgrst, 'reload schema';
