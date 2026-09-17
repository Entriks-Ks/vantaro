-- ProCredit HPP: pending payments + gateway order fields
-- Run AFTER lead_payments.sql in the Supabase SQL Editor.

alter table public.lead_payments
  drop constraint if exists lead_payments_status_check;

alter table public.lead_payments
  add constraint lead_payments_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded'));

alter table public.lead_payments
  alter column status set default 'pending';

alter table public.lead_payments
  add column if not exists pg_order_id text,
  add column if not exists pg_order_password text,
  add column if not exists pg_status text,
  add column if not exists hpp_url text,
  add column if not exists return_token text;

create unique index if not exists lead_payments_pg_order_id_uidx
  on public.lead_payments (pg_order_id)
  where pg_order_id is not null;

create unique index if not exists lead_payments_return_token_uidx
  on public.lead_payments (return_token)
  where return_token is not null;

create index if not exists lead_payments_status_idx
  on public.lead_payments (status);

notify pgrst, 'reload schema';
