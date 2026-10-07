-- Berater discounts: standing (until revoked) + one-time (consumed on paid checkout).
-- Run AFTER lead_payments.sql. Also adds list/discount snapshot columns on lead_payments.

create table if not exists public.berater_discounts (
  id uuid primary key default gen_random_uuid(),
  berater_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('standing', 'one_time')),
  code text not null,
  value_type text not null check (value_type in ('percent', 'fixed_cents')),
  value integer not null check (value > 0),
  applies_to text not null default 'all'
    check (applies_to in ('all', 'leads', 'appointments')),
  status text not null default 'active'
    check (status in ('active', 'reserved', 'consumed', 'revoked')),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  reserved_payment_id uuid references public.lead_payments (id) on delete set null,
  consumed_payment_id uuid references public.lead_payments (id) on delete set null,
  consumed_at timestamptz,
  expires_at timestamptz,
  constraint berater_discounts_percent_range
    check (value_type <> 'percent' or value <= 100)
);

create unique index if not exists berater_discounts_code_idx
  on public.berater_discounts (code);

create unique index if not exists berater_discounts_one_standing_idx
  on public.berater_discounts (berater_id)
  where kind = 'standing' and status in ('active', 'reserved');

create index if not exists berater_discounts_berater_idx
  on public.berater_discounts (berater_id, status, kind);

create index if not exists berater_discounts_reserved_payment_idx
  on public.berater_discounts (reserved_payment_id)
  where reserved_payment_id is not null;

alter table public.lead_payments
  add column if not exists list_cents integer,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists discount_snapshot jsonb;

alter table public.berater_discounts enable row level security;

revoke all on public.berater_discounts from anon, authenticated;
grant all on public.berater_discounts to service_role;

notify pgrst, 'reload schema';
