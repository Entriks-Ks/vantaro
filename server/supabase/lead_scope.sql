-- VANTARO lead packages: deutschlandweit vs regional
-- Run AFTER leads.sql, lead_requests.sql and lead_workflow.sql.

alter table public.leads
  add column if not exists scope text;

alter table public.lead_requests
  add column if not exists scope text;

update public.leads
  set scope = 'deutschlandweit'
  where scope is null or scope not in ('deutschlandweit', 'regional');

update public.lead_requests
  set scope = 'deutschlandweit'
  where scope is null or scope not in ('deutschlandweit', 'regional');

alter table public.leads
  alter column scope set default 'deutschlandweit';

alter table public.lead_requests
  alter column scope set default 'deutschlandweit';

alter table public.leads
  alter column scope set not null;

alter table public.lead_requests
  alter column scope set not null;

alter table public.leads drop constraint if exists leads_scope_check;
alter table public.leads
  add constraint leads_scope_check
  check (scope in ('deutschlandweit', 'regional'));

alter table public.lead_requests drop constraint if exists lead_requests_scope_check;
alter table public.lead_requests
  add constraint lead_requests_scope_check
  check (scope in ('deutschlandweit', 'regional'));

create index if not exists leads_scope_idx on public.leads (scope);
create index if not exists lead_requests_scope_idx on public.lead_requests (scope);

notify pgrst, 'reload schema';
