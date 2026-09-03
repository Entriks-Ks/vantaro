-- VANTARO lead follow-up: conversation status, Termin, Wiedervorlage
-- Run AFTER leads.sql (and lead_workflow.sql if that was already applied).

alter table public.leads
  add column if not exists contact_status text,
  add column if not exists appointment_at timestamptz,
  add column if not exists follow_up_at timestamptz,
  add column if not exists follow_up_reminded_at timestamptz;

alter table public.leads drop constraint if exists leads_contact_status_check;
alter table public.leads
  add constraint leads_contact_status_check
  check (
    contact_status is null
    or contact_status in ('neu', 'kontaktiert', 'termin', 'wiedervorlage', 'abgeschlossen')
  );

create index if not exists leads_follow_up_due_idx
  on public.leads (follow_up_at)
  where contact_status = 'wiedervorlage'
    and follow_up_reminded_at is null
    and assigned_to is not null;

notify pgrst, 'reload schema';
