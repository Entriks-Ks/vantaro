-- Unique human-readable codes for lead requests (Anforderungen).
-- Run AFTER lead_requests.sql in the Supabase SQL editor.

alter table public.lead_requests
  add column if not exists code text;

update public.lead_requests
set code = 'ANF-'
  || to_char(created_at at time zone 'utc', 'YYYYMMDD')
  || '-'
  || upper(substr(replace(id::text, '-', ''), 1, 6))
where code is null or btrim(code) = '';

alter table public.lead_requests
  alter column code set not null;

create unique index if not exists lead_requests_code_uidx on public.lead_requests (code);

notify pgrst, 'reload schema';
