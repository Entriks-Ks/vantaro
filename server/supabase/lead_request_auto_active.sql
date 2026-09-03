-- Auto-activate lead requests. No admin acceptance step.
-- Run AFTER lead_requests.sql and lead_workflow.sql in the Supabase SQL editor.

update public.lead_requests
  set status = 'active',
      activated_at = coalesce(activated_at, now())
  where status in ('pending', 'angefragt', 'angefordert');

alter table public.lead_requests
  alter column status set default 'active';

notify pgrst, 'reload schema';
