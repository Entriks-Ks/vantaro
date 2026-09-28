-- VANTARO verticals: insurance (existing) and energy (photovoltaic / heat pump).
-- Run in the Supabase SQL editor after leads.sql and lead_requests.sql.
-- Existing rows stay insurance.

alter table public.leads
  add column if not exists vertical text;

alter table public.lead_requests
  add column if not exists vertical text;

update public.leads
  set vertical = 'insurance'
  where vertical is null or vertical not in ('insurance', 'energy');

update public.lead_requests
  set vertical = 'insurance'
  where vertical is null or vertical not in ('insurance', 'energy');

alter table public.leads
  alter column vertical set default 'insurance';

alter table public.lead_requests
  alter column vertical set default 'insurance';

alter table public.leads
  alter column vertical set not null;

alter table public.lead_requests
  alter column vertical set not null;

alter table public.leads drop constraint if exists leads_vertical_check;
alter table public.leads
  add constraint leads_vertical_check
  check (vertical in ('insurance', 'energy'));

alter table public.lead_requests drop constraint if exists lead_requests_vertical_check;
alter table public.lead_requests
  add constraint lead_requests_vertical_check
  check (vertical in ('insurance', 'energy'));

alter table public.lead_requests drop constraint if exists lead_requests_lead_type_check;
alter table public.lead_requests
  add constraint lead_requests_lead_type_check
  check (lead_type in (
    'PKV', 'bAV', 'BU',
    'PV_LEAD', 'PV_APPOINTMENT', 'HP_LEAD', 'HP_APPOINTMENT'
  ));

alter table public.lead_requests
  add column if not exists territory text;

alter table public.lead_requests
  add column if not exists desired_timeframe text;

alter table public.leads
  add column if not exists house_number text,
  add column if not exists state text,
  add column if not exists energy_product text,
  add column if not exists delivery_type text,
  add column if not exists owner_status text,
  add column if not exists energy_need text,
  add column if not exists timeframe text,
  add column if not exists call_summary text,
  add column if not exists consent_status text,
  add column if not exists evidence_source text,
  add column if not exists annual_consumption text,
  add column if not exists existing_pv text,
  add column if not exists roof_notes text,
  add column if not exists heating_system text,
  add column if not exists energy_source text,
  add column if not exists construction_year text,
  add column if not exists replacement_timeframe text;

alter table public.leads drop constraint if exists leads_energy_product_check;
alter table public.leads
  add constraint leads_energy_product_check
  check (energy_product is null or energy_product in ('photovoltaic', 'heat_pump'));

alter table public.leads drop constraint if exists leads_delivery_type_check;
alter table public.leads
  add constraint leads_delivery_type_check
  check (delivery_type is null or delivery_type in ('lead', 'appointment'));

alter table public.leads drop constraint if exists leads_existing_pv_check;
alter table public.leads
  add constraint leads_existing_pv_check
  check (existing_pv is null or existing_pv in ('yes', 'no', 'unknown'));

create index if not exists leads_vertical_idx on public.leads (vertical);
create index if not exists lead_requests_vertical_idx on public.lead_requests (vertical);

notify pgrst, 'reload schema';
