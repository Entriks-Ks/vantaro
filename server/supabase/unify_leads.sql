-- One lead workflow for insurance and energy.
-- Run in the Supabase SQL editor AFTER vertical.sql, lead_workflow.sql and energy_portal.sql.
-- Safe to re-run. Back up the database before the first run.
--
-- What it does:
--   1. delivery_type is required for every lead ('lead' or 'appointment'); Termine are energy only.
--   2. energy_status is folded into contact_status (the 5-stage pipeline) and dropped.
--   3. energy_complaints are moved into lead_complaints and the table is dropped.
--   4. Per-lead energy billing (energy_delivery_lines, energy_billing_profiles) is dropped;
--      energy is paid through lead_payments packages like insurance.
-- Kept: energy_holder_id, google_event_id, google_event_etag, calendar_sync_status,
--       energy_calendar_connections.

-- 1. delivery_type ---------------------------------------------------------

update public.leads
  set delivery_type = 'lead'
  where delivery_type is null or delivery_type not in ('lead', 'appointment');

update public.leads
  set delivery_type = 'lead'
  where vertical <> 'energy' and delivery_type = 'appointment';

alter table public.leads alter column delivery_type set default 'lead';
alter table public.leads alter column delivery_type set not null;

alter table public.leads drop constraint if exists leads_delivery_type_check;
alter table public.leads
  add constraint leads_delivery_type_check
  check (delivery_type in ('lead', 'appointment'));

alter table public.leads drop constraint if exists leads_appointment_energy_only_check;
alter table public.leads
  add constraint leads_appointment_energy_only_check
  check (vertical = 'energy' or delivery_type = 'lead');

-- 2. energy_status -> contact_status ----------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'energy_status'
  ) then
    update public.leads
      set contact_status = 'abgeschlossen'
      where vertical = 'energy'
        and energy_status = 'COMPLETED'
        and coalesce(contact_status, '') <> 'abgeschlossen';

    update public.leads
      set contact_status = 'wiedervorlage',
          follow_up_at = coalesce(follow_up_at, appointment_at)
      where vertical = 'energy'
        and energy_status = 'FOLLOW_UP'
        and coalesce(contact_status, '') in ('', 'neu', 'kontaktiert', 'termin');

    update public.leads
      set contact_status = case when delivery_type = 'appointment' then 'termin' else 'neu' end
      where vertical = 'energy'
        and assigned_to is not null
        and contact_status is null;

    alter table public.leads drop constraint if exists leads_energy_status_check;
    alter table public.leads drop column energy_status;
  end if;
end $$;

-- 3. energy_complaints -> lead_complaints -----------------------------------

alter table public.lead_complaints drop constraint if exists lead_complaints_reason_check;
alter table public.lead_complaints
  add constraint lead_complaints_reason_check
  check (reason in (
    'invalid_phone',
    'wrong_person',
    'duplicate',
    'wrong_info',
    'missing_fields',
    'exclusivity',
    'tech_error',
    'invalid',
    'contact',
    'requirements',
    'cancelled',
    'other',
    'wrong_territory',
    'customer_unaware',
    'appointment_not_attended'
  ));

do $$
begin
  if to_regclass('public.energy_complaints') is not null then
    insert into public.lead_complaints (
      id, lead_id, berater_id, reason, comment, status,
      created_at, updated_at, reviewed_at, reviewed_by, admin_seen_at
    )
    select
      ec.id,
      ec.lead_id,
      ec.company_id,
      ec.reason,
      ec.comment,
      case ec.status
        when 'rejected' then 'declined'
        when 'replacement' then 'approved'
        when 'approved' then 'approved'
        when 'partial' then 'partial'
        else 'pending'
      end,
      ec.created_at,
      coalesce(ec.decided_at, ec.created_at),
      ec.decided_at,
      ec.decided_by,
      case when ec.status = 'pending' then null else coalesce(ec.decided_at, now()) end
    from public.energy_complaints ec
    where not exists (select 1 from public.lead_complaints lc where lc.id = ec.id);

    drop table public.energy_complaints;
  end if;
end $$;

-- 4. Per-lead energy billing ------------------------------------------------

drop table if exists public.energy_delivery_lines;
drop table if exists public.energy_billing_profiles;

notify pgrst, 'reload schema';
