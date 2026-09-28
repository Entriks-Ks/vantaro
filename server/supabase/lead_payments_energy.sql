-- Energy package checkout: Gebiet + Zeitraum on payment (for lead_request after pay).
-- Run AFTER lead_payments.sql / lead_payments_procredit.sql.

alter table public.lead_payments
  add column if not exists territory text,
  add column if not exists desired_timeframe text;

notify pgrst, 'reload schema';
