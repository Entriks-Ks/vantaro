-- VANTARO leads
-- Run this in the Supabase SQL editor for each project you use
-- (Vantaro-Development and Vantaro-Production).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  employment_status text
    check (
      employment_status is null
      or employment_status in ('selbststaendig', 'zusaetzlich_angestellt', 'sonstiges')
    ),
  employment_other text,
  email text,
  phone text,
  insurance_status text[] not null default '{}'::text[],
  current_insurer text,
  monthly_premium numeric(10, 2),
  coverage_circle text[] not null default '{}'::text[],
  main_concerns text[] not null default '{}'::text[],
  zip text,
  city text,
  street text,
  notes text,
  broker_notes text,
  contact_status text
    check (
      contact_status is null
      or contact_status in ('neu', 'kontaktiert', 'termin', 'wiedervorlage', 'abgeschlossen')
    ),
  appointment_at timestamptz,
  follow_up_at timestamptz,
  follow_up_reminded_at timestamptz,
  status text not null default 'neu'
    check (status in ('neu', 'in_bearbeitung', 'zugewiesen', 'erledigt')),
  assigned_to uuid references auth.users (id) on delete set null,
  assigned_at timestamptz,
  request_id uuid,
  refunded_at timestamptz,
  reported_at timestamptz,
  source text not null default 'manual'
    check (source in ('csv', 'manual', 'api')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

create or replace function public.set_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row
execute procedure public.set_leads_updated_at();

alter table public.leads enable row level security;

revoke all on public.leads from anon, authenticated;
grant all on public.leads to service_role;

notify pgrst, 'reload schema';
