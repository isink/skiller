-- 007_submissions_health.sql
-- Stores skill-validator's full JSON report against each submission, so we
-- can audit auto-approval decisions and surface failure reasons later.

alter table public.submissions
  add column if not exists health jsonb;
