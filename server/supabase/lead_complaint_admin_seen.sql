-- Admin "seen" tracking for lead complaints (Reklamationen).
-- Unseen pending = admin_seen_at IS NULL → sidebar reminder badge.
-- Run AFTER lead_workflow.sql in the Supabase SQL Editor.

alter table public.lead_complaints
  add column if not exists admin_seen_at timestamptz;

-- Existing complaints should not flood the badge after deploy.
update public.lead_complaints
set admin_seen_at = coalesce(reviewed_at, updated_at, created_at, now())
where admin_seen_at is null;

create index if not exists lead_complaints_admin_unseen_idx
  on public.lead_complaints (status, created_at desc)
  where admin_seen_at is null;

notify pgrst, 'reload schema';
