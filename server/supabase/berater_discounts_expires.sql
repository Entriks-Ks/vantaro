-- Optional validity window for standing and one-time discounts.
-- Run AFTER berater_discounts.sql if that file was already applied.

alter table public.berater_discounts
  add column if not exists expires_at timestamptz;

notify pgrst, 'reload schema';
