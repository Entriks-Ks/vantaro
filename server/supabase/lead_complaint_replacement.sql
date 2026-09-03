-- Link approved refunds to their replacement lead (admin tracking).
-- Run in Supabase SQL Editor after lead_workflow.sql.

alter table public.lead_complaints
  add column if not exists replacement_lead_id uuid references public.leads (id) on delete set null;

create index if not exists lead_complaints_replacement_idx
  on public.lead_complaints (replacement_lead_id)
  where replacement_lead_id is not null;

notify pgrst, 'reload schema';
