-- VANTARO lead package payments (ProCredit HPP)
-- Run AFTER lead_requests.sql, lead_workflow.sql and lead_scope.sql.
-- Then run lead_payments_procredit.sql for pending status + gateway columns.
-- Card PAN/CVC are never stored — only optional masked hints from the bank.

create table if not exists public.lead_payments (
  id uuid primary key default gen_random_uuid(),
  berater_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid references public.lead_requests (id) on delete set null,
  package_id text not null,
  package_label text not null,
  scope text not null
    check (scope in ('deutschlandweit', 'regional')),
  lead_type text not null default 'PKV',
  lead_count integer not null check (lead_count > 0),
  net_cents integer not null check (net_cents >= 0),
  tax_cents integer not null check (tax_cents >= 0),
  gross_cents integer not null check (gross_cents >= 0),
  invoice_number text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  method text not null default 'card',
  card_brand text,
  card_last4 text,
  card_holder text,
  card_exp_month integer,
  card_exp_year integer,
  billing_name text,
  billing_email text,
  billing_company text,
  test_mode boolean not null default true,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lead_payments_berater_idx on public.lead_payments (berater_id);
create index if not exists lead_payments_request_idx on public.lead_payments (request_id);
create index if not exists lead_payments_created_at_idx on public.lead_payments (created_at desc);

alter table public.lead_payments enable row level security;

revoke all on public.lead_payments from anon, authenticated;
grant all on public.lead_payments to service_role;

notify pgrst, 'reload schema';
