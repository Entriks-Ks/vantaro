-- Admin "seen" tracking for lead requests (Anforderungen).
-- Unseen = admin_seen_at IS NULL → sidebar reminder badge.
-- Run AFTER lead_requests.sql in the Supabase SQL Editor.

alter table public.lead_requests
  add column if not exists admin_seen_at timestamptz;

-- Existing requests should not flood the badge after deploy.
update public.lead_requests
set admin_seen_at = coalesce(activated_at, created_at, now())
where admin_seen_at is null;

create index if not exists lead_requests_admin_unseen_idx
  on public.lead_requests (status, created_at desc)
  where admin_seen_at is null;

notify pgrst, 'reload schema';
