-- Reminder flags for Termin and Wiedervorlage:
-- *_reminded_at = 1 hour before, *_soon_reminded_at = 15 minutes before.
-- Run in the Supabase SQL editor.

alter table public.leads
  add column if not exists appointment_reminded_at timestamptz,
  add column if not exists appointment_soon_reminded_at timestamptz,
  add column if not exists follow_up_soon_reminded_at timestamptz;

create index if not exists leads_appointment_due_idx
  on public.leads (appointment_at)
  where contact_status = 'termin'
    and appointment_reminded_at is null
    and assigned_to is not null;

create index if not exists leads_appointment_soon_idx
  on public.leads (appointment_at)
  where contact_status = 'termin'
    and appointment_soon_reminded_at is null
    and assigned_to is not null;

create index if not exists leads_follow_up_soon_idx
  on public.leads (follow_up_at)
  where contact_status = 'wiedervorlage'
    and follow_up_soon_reminded_at is null
    and assigned_to is not null;

notify pgrst, 'reload schema';
