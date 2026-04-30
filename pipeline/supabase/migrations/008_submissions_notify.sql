-- 008_submissions_notify.sql
-- Push a ntfy.sh notification to the maintainer's phone every time a new
-- submission lands, so we know to run `npm run review:pending` manually.
-- Topic name is private — anyone who knows it can spam the maintainer's
-- phone, so don't share it.

create extension if not exists pg_net;

create or replace function public.notify_new_submission()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://ntfy.sh/skiller-sub-7a3f9c2b',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Title', 'Skiller 新提交',
      'Message', NEW.github_url,
      'Click', NEW.github_url,
      'Tags', 'inbox_tray'
    )
  );
  return NEW;
end;
$$;

drop trigger if exists submissions_notify_after_insert on public.submissions;
create trigger submissions_notify_after_insert
after insert on public.submissions
for each row execute function public.notify_new_submission();
