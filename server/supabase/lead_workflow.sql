-- VANTARO lead workflow: request statuses, types, complaints, refunds
-- Run AFTER leads.sql and lead_requests.sql in the Supabase SQL editor.

alter table public.lead_requests
  add column if not exists lead_type text,
  add column if not exists replace_on_refund boolean not null default true,
  add column if not exists rejected_at timestamptz,
  add column if not exists cancelled_at timestamptz;

update public.lead_requests set lead_type = 'PKV' where lead_type is null;
update public.lead_requests set status = 'pending' where status in ('angefragt', 'pending');
update public.lead_requests set status = 'active' where status in ('aktiv', 'active');
update public.lead_requests set status = 'completed' where status in ('erledigt', 'completed');
update public.lead_requests set status = 'cancelled' where status in ('pausiert', 'cancelled');
update public.lead_requests set status = 'rejected' where status = 'rejected';

alter table public.lead_requests drop constraint if exists lead_requests_status_check;
alter table public.lead_requests
  add constraint lead_requests_status_check
  check (status in ('pending', 'active', 'completed', 'rejected', 'cancelled'));

alter table public.lead_requests drop constraint if exists lead_requests_lead_type_check;
alter table public.lead_requests
  add constraint lead_requests_lead_type_check
  check (lead_type in ('PKV', 'bAV', 'BU'));

alter table public.leads
  add column if not exists refunded_at timestamptz,
  add column if not exists reported_at timestamptz,
  add column if not exists broker_notes text;

create table if not exists public.lead_complaints (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  request_id uuid references public.lead_requests (id) on delete set null,
  berater_id uuid not null references auth.users (id) on delete cascade,
  reason text not null
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
      'other'
    )),
  comment text,
  admin_note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'partial', 'declined', 'info_needed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  refunded_at timestamptz
);

create index if not exists lead_complaints_lead_idx on public.lead_complaints (lead_id);
create index if not exists lead_complaints_berater_idx on public.lead_complaints (berater_id);
create index if not exists lead_complaints_status_idx on public.lead_complaints (status);
create index if not exists lead_complaints_created_at_idx on public.lead_complaints (created_at desc);

drop trigger if exists lead_complaints_set_updated_at on public.lead_complaints;
create trigger lead_complaints_set_updated_at
before update on public.lead_complaints
for each row
execute procedure public.set_leads_updated_at();

alter table public.lead_complaints enable row level security;
revoke all on public.lead_complaints from anon, authenticated;
grant all on public.lead_complaints to service_role;

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
    'other'
  ));

-- Review outcomes + snapshot/proof. Safe to re-run.
alter table public.lead_complaints add column if not exists admin_note text;
alter table public.lead_complaints add column if not exists proof_name text;
alter table public.lead_complaints add column if not exists proof_data text;
alter table public.lead_complaints add column if not exists contact_status text;
alter table public.lead_complaints add column if not exists refund_cents integer;
alter table public.lead_complaints add column if not exists snapshot jsonb;
alter table public.lead_complaints add column if not exists admin_seen_at timestamptz;

alter table public.lead_complaints drop constraint if exists lead_complaints_status_check;
update public.lead_complaints set status = 'declined' where status in ('rejected', 'declined');
update public.lead_complaints set status = 'approved' where status in ('refunded', 'approved');
update public.lead_complaints set status = 'partial' where status in ('teilweise', 'partial');
update public.lead_complaints set status = 'info_needed' where status in ('infos_noetig', 'info_needed');
alter table public.lead_complaints
  add constraint lead_complaints_status_check
  check (status in ('pending', 'approved', 'partial', 'declined', 'info_needed'));

notify pgrst, 'reload schema';
