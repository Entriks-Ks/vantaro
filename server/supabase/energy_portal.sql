-- Energy delivery: sub-partner assignment, appointment status, billing, complaints, calendar.
-- Run in the Supabase SQL editor after vertical.sql.

alter table public.leads
  add column if not exists energy_holder_id uuid references auth.users (id) on delete set null,
  add column if not exists energy_status text,
  add column if not exists google_event_id text,
  add column if not exists google_event_etag text,
  add column if not exists calendar_sync_status text;

alter table public.leads drop constraint if exists leads_energy_status_check;
alter table public.leads
  add constraint leads_energy_status_check
  check (
    energy_status is null
    or energy_status in (
      'NEW', 'ASSIGNED', 'CALENDAR_PENDING', 'CALENDAR_SYNCED', 'CONFIRMED',
      'RESCHEDULE_REQUESTED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW',
      'COMPLAINT_OPENED', 'COMPLETED', 'FOLLOW_UP'
    )
  );

create index if not exists leads_energy_holder_idx on public.leads (energy_holder_id);

create table if not exists public.energy_billing_profiles (
  company_id uuid primary key references auth.users (id) on delete cascade,
  model text not null default 'MONTHLY'
    check (model in ('PREPAID', 'MONTHLY', 'THRESHOLD', 'CUSTOM')),
  threshold_quantity integer,
  threshold_amount numeric(12, 2),
  invoice_day integer,
  payment_term_days integer,
  credit_limit numeric(12, 2),
  price_pv_lead numeric(12, 2),
  price_pv_appointment numeric(12, 2),
  price_hp_lead numeric(12, 2),
  price_hp_appointment numeric(12, 2),
  complaint_period_days integer,
  complaint_blocks_invoice boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.energy_delivery_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users (id) on delete cascade,
  product_type text not null
    check (product_type in ('PV_LEAD', 'PV_APPOINTMENT', 'HP_LEAD', 'HP_APPOINTMENT')),
  lead_id uuid not null unique references public.leads (id) on delete cascade,
  unit_price numeric(12, 2),
  billing_model text,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'INVOICED', 'PAID', 'CREDITED', 'CANCELLED')),
  delivered_at timestamptz not null default now(),
  invoice_id text,
  complaint_status text,
  created_at timestamptz not null default now()
);

create index if not exists energy_delivery_lines_company_idx
  on public.energy_delivery_lines (company_id, status);

create table if not exists public.energy_complaints (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  company_id uuid not null references auth.users (id) on delete cascade,
  opened_by uuid not null references auth.users (id) on delete cascade,
  reason text not null
    check (reason in (
      'invalid_phone', 'wrong_territory', 'customer_unaware', 'duplicate', 'appointment_not_attended'
    )),
  comment text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'partial', 'replacement')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);

create index if not exists energy_complaints_company_idx on public.energy_complaints (company_id, status);

create table if not exists public.energy_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_account_id text,
  calendar_id text,
  refresh_token text,
  access_token text,
  access_expires_at timestamptz,
  sync_status text not null default 'pending'
    check (sync_status in ('connected', 'error', 'pending', 'disconnected')),
  last_synced_at timestamptz,
  sync_error text,
  test_event_id text,
  updated_at timestamptz not null default now()
);

alter table public.energy_billing_profiles enable row level security;
alter table public.energy_delivery_lines enable row level security;
alter table public.energy_complaints enable row level security;
alter table public.energy_calendar_connections enable row level security;

revoke all on public.energy_billing_profiles from anon, authenticated;
revoke all on public.energy_delivery_lines from anon, authenticated;
revoke all on public.energy_complaints from anon, authenticated;
revoke all on public.energy_calendar_connections from anon, authenticated;

grant all on public.energy_billing_profiles to service_role;
grant all on public.energy_delivery_lines to service_role;
grant all on public.energy_complaints to service_role;
grant all on public.energy_calendar_connections to service_role;

notify pgrst, 'reload schema';
