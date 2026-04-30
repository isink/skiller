-- 010_skill_reports.sql
-- In-app "report" channel for App Store guideline 1.2 compliance.
-- Anonymous reports are allowed (no login required to flag bad content),
-- so RLS on insert is permissive. Reads are admin-only via service role.
-- A trigger fans out to the maintainer's ntfy topic on every insert,
-- mirroring the submissions pipeline in 008.

create table if not exists public.skill_reports (
  id uuid primary key default gen_random_uuid(),
  skill_id text not null,
  skill_slug text,
  skill_name text,
  reason text not null,
  note text,
  reporter_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists skill_reports_created_idx
  on public.skill_reports (created_at desc);

create index if not exists skill_reports_skill_idx
  on public.skill_reports (skill_id);

alter table public.skill_reports enable row level security;

drop policy if exists "skill_reports insert" on public.skill_reports;
create policy "skill_reports insert" on public.skill_reports
  for insert with check (
    reporter_user_id is null
    or reporter_user_id = auth.uid()
  );

-- Push notification to maintainer's phone (private topic).
create or replace function public.notify_new_report()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://ntfy.sh/skiller-sub-7a3f9c2b',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Title', 'Skiller 举报: ' || coalesce(NEW.skill_name, NEW.skill_slug, NEW.skill_id),
      'Message', NEW.reason || coalesce(E'\n\n' || NEW.note, ''),
      'Tags', 'rotating_light',
      'Priority', '4'
    )
  );
  return NEW;
end;
$$;

drop trigger if exists skill_reports_notify_after_insert on public.skill_reports;
create trigger skill_reports_notify_after_insert
after insert on public.skill_reports
for each row execute function public.notify_new_report();
