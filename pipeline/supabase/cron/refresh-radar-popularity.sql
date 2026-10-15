-- Run after migration 023 and deployment of refresh-radar-popularity.
-- Reuses the existing Vault secret; no key is embedded in this file.
-- Every 15 minutes process up to 40 sources, with a 60-minute per-source TTL.
select cron.schedule(
  'skiller-refresh-radar-popularity',
  '7,22,37,52 * * * *',
  $$
  select net.http_post(
    url := 'https://gphynosbfjcyexhkgctf.supabase.co/functions/v1/refresh-radar-popularity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'skiller_refresh_service_role_key'
      ),
      'apikey', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'skiller_refresh_service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 100000
  );
  $$
);
