-- VANTARO: external lead IDs (TC-Dial and other API sources)
-- Run AFTER leads.sql in the Supabase SQL Editor.

alter table public.leads
  add column if not exists external_source text;

alter table public.leads
  add column if not exists external_id text;

update public.leads
  set external_source = null
  where external_source is not null
    and trim(external_source) = '';

update public.leads
  set external_id = null
  where external_id is not null
    and trim(external_id) = '';

create unique index if not exists leads_external_source_id_uidx
  on public.leads (external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists leads_external_id_idx
  on public.leads (external_id)
  where external_id is not null;

notify pgrst, 'reload schema';
