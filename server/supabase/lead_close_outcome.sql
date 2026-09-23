-- VANTARO lead close outcome: successful vs failed when Abgeschlossen
-- Run AFTER lead_follow_up.sql in the Supabase SQL editor.
-- Existing Abgeschlossen leads stay valid with a null outcome until the Berater sets one.

alter table public.leads
  add column if not exists close_outcome text;

alter table public.leads drop constraint if exists leads_close_outcome_check;
alter table public.leads
  add constraint leads_close_outcome_check
  check (
    close_outcome is null
    or (
      close_outcome in ('erfolgreich', 'fehlgeschlagen')
      and contact_status = 'abgeschlossen'
    )
  );

notify pgrst, 'reload schema';
