-- Migration 020 schedules this job automatically when pg_cron is enabled.
-- Use this file only if Supabase Cron was enabled after 020 was applied.
-- Re-running replaces the existing job with the same name.
select cron.schedule(
  'skiller-prune-star-snapshots',
  '17 3 * * *',
  'select public.prune_star_snapshots(45)'
);
