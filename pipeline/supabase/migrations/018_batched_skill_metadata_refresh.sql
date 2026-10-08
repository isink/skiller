begin;

-- The Edge Function reads only the next small batch. Keep the cursor and lease
-- inaccessible to mini-program clients.
create or replace function public.skill_repo_key(p_url text)
returns text
language sql immutable strict
as $$
  select lower(substring(p_url from '^https://github[.]com/([^/]+/[^/?#]+)'));
$$;

create table if not exists public.skill_metadata_refresh_lease (
  name text primary key,
  holder uuid not null,
  expires_at timestamptz not null
);

alter table public.skill_metadata_refresh_lease enable row level security;
revoke all on table public.skill_metadata_refresh_lease
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.skill_metadata_refresh_lease
  to service_role;

create or replace function public.claim_skill_metadata_refresh(p_holder uuid)
returns boolean
language plpgsql
as $$
declare
  claimed boolean;
begin
  insert into public.skill_metadata_refresh_lease (name, holder, expires_at)
  values ('daily', p_holder, now() + interval '180 seconds')
  on conflict (name) do update
    set holder = excluded.holder, expires_at = excluded.expires_at
    where public.skill_metadata_refresh_lease.expires_at < now()
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create or replace function public.release_skill_metadata_refresh(p_holder uuid)
returns void
language sql
as $$
  delete from public.skill_metadata_refresh_lease
  where name = 'daily' and holder = p_holder;
$$;

create or replace function public.skill_metadata_repos_due(p_limit integer)
returns table (repo_key text, github_url text)
language sql stable
as $$
  with repos as (
    select public.skill_repo_key(s.github_url) as key, min(s.github_url) as url
    from public.skills s
    group by 1
  )
  select repos.key, repos.url
  from repos
  left join public.github_repo_refresh_state state on state.repo_key = repos.key
  where repos.key is not null
    and (
      state.checked_at is null
      or (state.checked_at at time zone 'UTC')::date
        < (now() at time zone 'UTC')::date
    )
  order by state.checked_at nulls first, repos.key
  limit least(greatest(coalesce(p_limit, 0), 0), 60);
$$;

create or replace function public.skill_metadata_files_due(p_limit integer)
returns table (id uuid, github_url text, default_branch text, pushed_at timestamptz)
language sql stable
as $$
  select s.id, s.github_url, state.default_branch, state.pushed_at
  from public.skills s
  join public.github_repo_refresh_state state
    on state.repo_key = public.skill_repo_key(s.github_url)
  where state.default_branch <> ''
    and (state.checked_at at time zone 'UTC')::date
      = (now() at time zone 'UTC')::date
    and (
      s.source_checked_at is null
      or s.source_url_checked is distinct from s.github_url
      or s.source_repo_pushed_at is distinct from state.pushed_at
    )
  order by s.source_checked_at nulls first, s.id
  limit least(greatest(coalesce(p_limit, 0), 0), 60);
$$;

-- Update a repository and every skill that comes from it in one transaction.
create or replace function public.apply_skill_repo_metadata(
  p_repo_key text,
  p_found boolean,
  p_stars integer,
  p_default_branch text,
  p_pushed_at timestamptz
)
returns void
language plpgsql
as $$
declare
  checked timestamptz := now();
begin
  if p_repo_key is null or p_repo_key !~ '^[^/]+/[^/]+$'
    or p_found is null
    or (p_found and (p_stars is null or p_stars < 0
      or nullif(p_default_branch, '') is null)) then
    raise exception 'invalid repository metadata';
  end if;

  if p_found then
    update public.skills
    set github_stars = p_stars, github_stars_checked_at = checked
    where public.skill_repo_key(github_url) = p_repo_key;
  else
    update public.skills
    set github_stars = null, github_stars_checked_at = checked,
      source_updated_at = null, source_checked_at = checked,
      source_repo_pushed_at = null, source_url_checked = null
    where public.skill_repo_key(github_url) = p_repo_key;
  end if;

  insert into public.github_repo_refresh_state
    (repo_key, default_branch, stars, pushed_at, checked_at)
  values (
    p_repo_key,
    case when p_found then p_default_branch else '' end,
    case when p_found then p_stars else null end,
    case when p_found then p_pushed_at else null end,
    checked
  )
  on conflict (repo_key) do update
    set default_branch = excluded.default_branch,
        stars = excluded.stars,
        pushed_at = excluded.pushed_at,
        checked_at = excluded.checked_at;
end;
$$;

revoke all on function public.skill_repo_key(text) from public, anon, authenticated;
grant execute on function public.skill_repo_key(text) to service_role;
revoke all on function public.claim_skill_metadata_refresh(uuid) from public, anon, authenticated;
grant execute on function public.claim_skill_metadata_refresh(uuid) to service_role;
revoke all on function public.release_skill_metadata_refresh(uuid) from public, anon, authenticated;
grant execute on function public.release_skill_metadata_refresh(uuid) to service_role;
revoke all on function public.skill_metadata_repos_due(integer) from public, anon, authenticated;
grant execute on function public.skill_metadata_repos_due(integer) to service_role;
revoke all on function public.skill_metadata_files_due(integer) from public, anon, authenticated;
grant execute on function public.skill_metadata_files_due(integer) to service_role;
revoke all on function public.apply_skill_repo_metadata(text, boolean, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_skill_repo_metadata(text, boolean, integer, text, timestamptz)
  to service_role;

commit;
