-- Per-request fulfillment: manual (admin picks leads) or auto (nearest matching leads).
-- Run in the Supabase SQL editor.

alter table public.lead_requests
  add column if not exists fulfillment_mode text not null default 'manual'
    check (fulfillment_mode in ('manual', 'auto'));

alter table public.lead_requests
  add column if not exists auto_filled_at timestamptz;

comment on column public.lead_requests.fulfillment_mode is
  'manual = admin sends leads; auto = system fills remaining with nearest matching pool leads';

create index if not exists lead_requests_fulfillment_mode_idx
  on public.lead_requests (fulfillment_mode)
  where fulfillment_mode = 'auto' and status = 'active';

notify pgrst, 'reload schema';
