-- ProCredit receipt fields required on the customer confirmation (approval code, transaction time)
-- Run AFTER lead_payments_procredit.sql in the Supabase SQL Editor.

alter table public.lead_payments
  add column if not exists pg_approval_code text,
  add column if not exists pg_tran_time text,
  add column if not exists confirmation_sent_at timestamptz;

notify pgrst, 'reload schema';
