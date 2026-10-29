-- Payment audit log (ProCredit security requirement: monitor and respond to suspicious activity)
-- Run AFTER lead_payments_procredit.sql in the Supabase SQL Editor.
-- Never store card data, ProCredit order passwords or certificate material here;
-- server/src/lib/paymentAudit.js strips such keys from metadata before insert.

create table if not exists public.payment_audit_log (
  id uuid primary key default gen_random_uuid(),
  event text not null
    check (event in (
      'checkout_created',
      'payment_paid',
      'payment_failed',
      'payment_synced',
      'return_invalid_token',
      'suspicious_activity'
    )),
  user_id uuid references auth.users (id) on delete set null,
  payment_id uuid references public.lead_payments (id) on delete set null,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_log_user_created_idx
  on public.payment_audit_log (user_id, created_at desc);

create index if not exists payment_audit_log_event_created_idx
  on public.payment_audit_log (event, created_at desc);

alter table public.payment_audit_log enable row level security;

revoke all on public.payment_audit_log from anon, authenticated;
grant all on public.payment_audit_log to service_role;

-- Retention: 12 months (docs/procredit-compliance.md, section 2). Run monthly, e.g. with pg_cron:
--   select cron.schedule('payment-audit-retention', '0 3 1 * *',
--     $$delete from public.payment_audit_log where created_at < now() - interval '12 months'$$);
-- Keep rows linked to an open security incident by exporting them before the purge.

notify pgrst, 'reload schema';
