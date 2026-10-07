begin;

alter table public.skills
  add column if not exists github_stars_checked_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_checked_at timestamptz,
  add column if not exists source_repo_pushed_at timestamptz,
  add column if not exists source_url_checked text;

-- Internal cursor for the daily metadata job. Never expose this table to clients.
create table if not exists public.github_repo_refresh_state (
  repo_key text primary key,
  default_branch text not null,
  stars integer,
  pushed_at timestamptz,
  checked_at timestamptz not null
);

alter table public.github_repo_refresh_state enable row level security;
revoke all on table public.github_repo_refresh_state
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.github_repo_refresh_state
  to service_role;

commit;
