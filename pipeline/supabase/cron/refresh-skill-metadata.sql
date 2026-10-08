-- Run only after the Edge Function is deployed, pg_cron and pg_net are enabled,
-- and Vault contains skiller_refresh_service_role_key. Never paste the key here.
select cron.schedule(
  'skiller-refresh-skill-metadata',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://gphynosbfjcyexhkgctf.supabase.co/functions/v1/refresh-skill-metadata',
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
    body := '{}'::jsonb
  );
  $$
);
