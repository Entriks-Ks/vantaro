-- VANTARO lead requests (Berater-Aufträge)
-- Run this in the Supabase SQL editor AFTER leads.sql, for each project.

create table if not exists public.lead_requests (
  id uuid primary key default gen_random_uuid(),
  berater_id uuid not null references auth.users (id) on delete cascade,
  requested_count integer not null check (requested_count > 0),
  lead_type text not null default 'PKV'
    check (lead_type in ('PKV', 'bAV', 'BU')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'rejected', 'cancelled')),
  replace_on_refund boolean not null default true,
  notes text,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  paused_at timestamptz
);

create index if not exists lead_requests_berater_idx on public.lead_requests (berater_id);
create index if not exists lead_requests_status_idx on public.lead_requests (status);
create index if not exists lead_requests_created_at_idx on public.lead_requests (created_at desc);

drop trigger if exists lead_requests_set_updated_at on public.lead_requests;
create trigger lead_requests_set_updated_at
before update on public.lead_requests
for each row
execute procedure public.set_leads_updated_at();

alter table public.leads
  add column if not exists request_id uuid references public.lead_requests (id) on delete set null;

create index if not exists leads_request_id_idx on public.leads (request_id);

alter table public.lead_requests enable row level security;

revoke all on public.lead_requests from anon, authenticated;
grant all on public.lead_requests to service_role;

notify pgrst, 'reload schema';
