-- 020: daily repository star snapshots, "hot this week" and "latest" RPCs.
--
-- Run this whole file once in the Supabase SQL Editor of the existing project.
-- It is idempotent: a second run changes no data and no function behaviour.
-- Do not run schema.sql or `supabase db push` against the existing project.
begin;

-- 1. Repository key as a stored generated column. Adding it rewrites the table
--    but does not fire row triggers, so updated_at is not touched.
alter table public.skills
  add column if not exists repo_key text
  generated always as (public.skill_repo_key(github_url)) stored;

create index if not exists skills_repo_key_idx on public.skills (repo_key);
create index if not exists skills_created_at_idx on public.skills (created_at desc);

-- 2. updated_at is the content version used by fill_skill_enrichment's stale
--    write guard. Metadata-only writes (stars, check timestamps, rank, featured)
--    must not move it, otherwise the daily star refresh invalidates every
--    in-flight enrichment. Enrichment columns stay in the list so a successful
--    enrichment still invalidates the version that produced it.
drop trigger if exists skills_set_updated_at on public.skills;
create trigger skills_set_updated_at
before update on public.skills
for each row
when (
  (
    old.name, old.description, old.category, old.tags, old.author,
    old.github_url, old.skill_md_content, old.description_zh, old.use_cases,
    old.use_cases_en, old.skill_md_summary_zh
  ) is distinct from (
    new.name, new.description, new.category, new.tags, new.author,
    new.github_url, new.skill_md_content, new.description_zh, new.use_cases,
    new.use_cases_en, new.skill_md_summary_zh
  )
)
execute function public.set_updated_at();

-- 3. One row per repository per UTC day. Internal: never exposed to clients.
create table if not exists public.github_repo_star_snapshots (
  snapshot_date date not null,
  repo_key text not null,
  stars integer not null check (stars >= 0),
  source text not null default 'refresh' check (source in ('refresh', 'backfill')),
  captured_at timestamptz not null default now(),
  primary key (snapshot_date, repo_key)
);

alter table public.github_repo_star_snapshots enable row level security;
revoke all on table public.github_repo_star_snapshots
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.github_repo_star_snapshots
  to service_role;

-- Day-zero baseline from the stars already collected by the refresh job.
insert into public.github_repo_star_snapshots (snapshot_date, repo_key, stars)
select (state.checked_at at time zone 'UTC')::date, state.repo_key, state.stars
from public.github_repo_refresh_state as state
where state.stars is not null
on conflict (snapshot_date, repo_key) do nothing;

-- 4. The existing refresh path now also records the day's snapshot. No extra
--    GitHub requests: the stars were already fetched.
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

  if p_found then
    insert into public.github_repo_star_snapshots (snapshot_date, repo_key, stars)
    values ((checked at time zone 'UTC')::date, p_repo_key, p_stars)
    on conflict (snapshot_date, repo_key) do update
      set stars = excluded.stars, captured_at = excluded.captured_at;
  end if;
end;
$$;

revoke all on function public.apply_skill_repo_metadata(text, boolean, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_skill_repo_metadata(text, boolean, integer, text, timestamptz)
  to service_role;

-- 5. Retention: the growth window needs about ten days; keep six weeks.
create or replace function public.prune_star_snapshots(p_keep_days integer default 45)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.github_repo_star_snapshots as snapshot
  where snapshot.snapshot_date
    < (now() at time zone 'UTC')::date - greatest(coalesce(p_keep_days, 45), 14);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_star_snapshots(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.prune_star_snapshots(integer) to service_role;

-- 6. Hot this week: star growth per repository, one representative skill each.
--    SECURITY DEFINER because the snapshot table is internal; only the columns
--    below leave the function. The baseline is the newest snapshot on or before
--    (today - p_days) within three days of that target. While history is still
--    short it falls back to the nearest later snapshot at least two days old, so
--    the section works during the first week.
create or replace function public.get_hot_skills(
  p_days integer default 7,
  p_limit integer default 10,
  p_min_growth integer default 3
)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  description_zh text,
  category text,
  tags text[],
  use_cases text[],
  author text,
  github_url text,
  github_stars integer,
  github_stars_checked_at timestamptz,
  source_updated_at timestamptz,
  source_checked_at timestamptz,
  rank integer,
  score integer,
  featured boolean,
  created_at timestamptz,
  published_at timestamptz,
  stars_growth integer,
  growth_days integer,
  repo_skill_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select
      (now() at time zone 'UTC')::date as today,
      least(greatest(coalesce(p_days, 7), 1), 30) as days
  ), latest as (
    select distinct on (snapshot.repo_key)
      snapshot.repo_key, snapshot.snapshot_date, snapshot.stars
    from public.github_repo_star_snapshots as snapshot, params
    where snapshot.snapshot_date >= params.today - 2
    order by snapshot.repo_key, snapshot.snapshot_date desc
  ), base as (
    select distinct on (snapshot.repo_key)
      snapshot.repo_key, snapshot.snapshot_date, snapshot.stars
    from public.github_repo_star_snapshots as snapshot, params
    where snapshot.snapshot_date between params.today - params.days - 3
                                     and params.today - 2
    order by
      snapshot.repo_key,
      (snapshot.snapshot_date > params.today - params.days),
      abs(snapshot.snapshot_date - (params.today - params.days))
  ), growth as (
    select
      latest.repo_key,
      latest.stars - base.stars as stars_growth,
      latest.snapshot_date - base.snapshot_date as growth_days
    from latest
    join base on base.repo_key = latest.repo_key
    where latest.snapshot_date - base.snapshot_date >= 2
      and latest.stars - base.stars >= greatest(coalesce(p_min_growth, 3), 1)
  ), representative as (
    select distinct on (skill.repo_key)
      skill.id, skill.slug, skill.name, skill.description, skill.description_zh,
      skill.category, skill.tags, skill.use_cases, skill.author, skill.github_url,
      skill.github_stars, skill.github_stars_checked_at, skill.source_updated_at,
      skill.source_checked_at, skill.rank, skill.score, skill.featured,
      skill.created_at, skill.published_at,
      growth.stars_growth, growth.growth_days,
      count(*) over (partition by skill.repo_key) as repo_skill_count
    from public.skills as skill
    join growth on growth.repo_key = skill.repo_key
    where coalesce(skill.description_zh, '') <> ''
    order by skill.repo_key, skill.featured desc, skill.rank desc,
      skill.install_count desc, skill.id
  )
  select
    representative.id, representative.slug, representative.name,
    representative.description, representative.description_zh,
    representative.category, representative.tags, representative.use_cases,
    representative.author, representative.github_url, representative.github_stars,
    representative.github_stars_checked_at, representative.source_updated_at,
    representative.source_checked_at, representative.rank, representative.score,
    representative.featured, representative.created_at, representative.published_at,
    representative.stars_growth, representative.growth_days,
    representative.repo_skill_count
  from representative
  order by representative.stars_growth desc,
    representative.github_stars desc nulls last,
    representative.id
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

-- 7. Latest additions: newest first, at most p_per_repo skills per repository so
--    one bulk-imported repository cannot fill the whole section. Only enriched
--    skills (Chinese description present) are shown.
create or replace function public.get_latest_skills(
  p_limit integer default 10,
  p_per_repo integer default 2,
  p_within_days integer default 30
)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  description_zh text,
  category text,
  tags text[],
  use_cases text[],
  author text,
  github_url text,
  github_stars integer,
  github_stars_checked_at timestamptz,
  source_updated_at timestamptz,
  source_checked_at timestamptz,
  rank integer,
  score integer,
  featured boolean,
  created_at timestamptz,
  published_at timestamptz,
  stars_growth integer,
  growth_days integer,
  repo_skill_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recent as (
    select
      skill.id, skill.slug, skill.name, skill.description, skill.description_zh,
      skill.category, skill.tags, skill.use_cases, skill.author, skill.github_url,
      skill.github_stars, skill.github_stars_checked_at, skill.source_updated_at,
      skill.source_checked_at, skill.rank, skill.score, skill.featured,
      skill.created_at, skill.published_at,
      row_number() over (
        partition by coalesce(skill.repo_key, skill.id::text)
        order by skill.created_at desc, skill.id
      ) as repo_position,
      count(*) over (
        partition by coalesce(skill.repo_key, skill.id::text)
      ) as repo_skill_count
    from public.skills as skill
    where skill.created_at
        > now() - make_interval(days => least(greatest(coalesce(p_within_days, 30), 1), 365))
      and coalesce(skill.description_zh, '') <> ''
  )
  select
    recent.id, recent.slug, recent.name, recent.description, recent.description_zh,
    recent.category, recent.tags, recent.use_cases, recent.author, recent.github_url,
    recent.github_stars, recent.github_stars_checked_at, recent.source_updated_at,
    recent.source_checked_at, recent.rank, recent.score, recent.featured,
    recent.created_at, recent.published_at,
    null::integer, null::integer, recent.repo_skill_count
  from recent
  where recent.repo_position <= greatest(coalesce(p_per_repo, 2), 1)
  order by recent.created_at desc, recent.id
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

revoke all on function public.get_hot_skills(integer, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_hot_skills(integer, integer, integer)
  to anon, authenticated, service_role;
revoke all on function public.get_latest_skills(integer, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_latest_skills(integer, integer, integer)
  to anon, authenticated, service_role;

-- 8. Daily prune through pg_cron when it is available (Supabase Cron is already
--    required by the metadata refresh job). cron.schedule replaces a job with
--    the same name, so re-running this file does not create duplicates.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'skiller-prune-star-snapshots',
      '17 3 * * *',
      'select public.prune_star_snapshots(45)'
    );
  else
    raise notice 'pg_cron is not enabled; run supabase/cron/prune-star-snapshots.sql after enabling it';
  end if;
end;
$$;

commit;
