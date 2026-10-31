-- Skiller database schema snapshot.
-- Run only on a fresh Supabase project; existing projects use migrations/.

begin;

create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  icon text not null default 'sparkles',
  created_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  description_zh text,
  category text not null references public.categories(slug) on update cascade,
  tags text[] not null default '{}',
  use_cases text[] not null default '{}',
  use_cases_en text[] not null default '{}',
  author text not null default '',
  github_url text not null default '',
  skill_md_content text,
  skill_md_summary_zh text,
  github_stars integer,
  github_stars_checked_at timestamptz,
  source_updated_at timestamptz,
  source_checked_at timestamptz,
  source_repo_pushed_at timestamptz,
  source_url_checked text,
  install_count integer not null default 0
    constraint skills_install_count_nonnegative check (install_count >= 0),
  rank integer not null default 0,
  score integer not null default 0,
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists skills_category_idx on public.skills (category);
create index if not exists skills_rank_idx on public.skills (rank desc);
create index if not exists skills_featured_idx on public.skills (featured) where featured = true;
create index if not exists skills_name_trgm_idx on public.skills using gin (name gin_trgm_ops);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table if not exists public.submissions (
  id uuid primary key default uuid_generate_v4(),
  github_url text not null,
  submitter_email text,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text,
  submitter_user_id uuid references auth.users(id) on delete set null,
  health jsonb,
  agent_decision text check (agent_decision in ('approve', 'reject')),
  agent_reason text,
  agent_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists submissions_status_idx
  on public.submissions (status, created_at desc);
create index if not exists submissions_user_idx
  on public.submissions (submitter_user_id, created_at desc);
create index if not exists submissions_pending_no_agent_idx
  on public.submissions (created_at)
  where status = 'pending' and agent_decision is null;

create table if not exists public.skill_reports (
  id uuid primary key default uuid_generate_v4(),
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
create index if not exists skill_reports_reporter_created_idx
  on public.skill_reports (reporter_user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Metadata-only writes (stars, check timestamps, rank, featured) keep updated_at,
-- the content version used by fill_skill_enrichment's stale-write guard.
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

alter table public.skills enable row level security;
alter table public.categories enable row level security;
alter table public.favorites enable row level security;
alter table public.submissions enable row level security;
alter table public.skill_reports enable row level security;

drop policy if exists "skills read" on public.skills;
create policy "skills read" on public.skills
  for select to anon, authenticated using (true);

drop policy if exists "categories read" on public.categories;
create policy "categories read" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "favorites owner" on public.favorites;
create policy "favorites owner" on public.favorites
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.skills from public, anon, authenticated, service_role;
grant select on table public.skills to anon, authenticated;
grant all on table public.skills to service_role;

revoke all on table public.categories from public, anon, authenticated, service_role;
grant select on table public.categories to anon, authenticated;
grant all on table public.categories to service_role;

revoke all on table public.favorites from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.favorites to authenticated;
grant select, insert, update, delete on table public.favorites to service_role;

revoke all on table public.submissions from public, anon, authenticated, service_role;
grant select on table public.submissions to service_role;
grant update (agent_decision, agent_reason, agent_reviewed_at)
  on table public.submissions to service_role;

revoke all on table public.skill_reports from public, anon, authenticated, service_role;
grant select on table public.skill_reports to service_role;

create or replace function public.get_new_counts_by_category(since timestamptz)
returns table(category text, count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select skill.category, count(*)
  from public.skills as skill
  where skill.created_at > since
  group by skill.category;
$$;

create or replace function public.get_category_counts()
returns table(category text, count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select skill.category, count(*)
  from public.skills as skill
  group by skill.category;
$$;

create or replace function public.get_repo_groups(
  p_category text default null,
  p_offset integer default 0,
  p_limit integer default 50
)
returns table(
  repo text,
  author text,
  stars integer,
  skill_count bigint,
  rep_skill_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select
      regexp_replace(skill.github_url, '^https?://github\.com/([^/]+/[^/]+).*$', '\1') as g_repo,
      skill.author,
      skill.github_stars,
      skill.id,
      skill.featured,
      skill.rank,
      skill.install_count
    from public.skills as skill
    where p_category is null or skill.category = p_category
  ), ranked as (
    select
      base.g_repo,
      base.author,
      base.github_stars,
      base.id,
      row_number() over (
        partition by base.g_repo
        order by base.featured desc, base.rank desc,
          base.install_count desc nulls last, base.id
      ) as row_number,
      count(*) over (partition by base.g_repo) as group_count
    from base
  )
  select
    ranked.g_repo,
    ranked.author,
    ranked.github_stars,
    ranked.group_count,
    ranked.id
  from ranked
  where ranked.row_number = 1
  order by ranked.github_stars desc nulls last, ranked.g_repo
  offset p_offset limit p_limit;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  delete from public.favorites where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

create or replace function public.submit_skill_report(
  p_skill_id uuid,
  p_reason text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  report_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_reason is null
    or p_reason not in ('abuse', 'copyright', 'malicious', 'spam', 'other') then
    raise exception 'Invalid report reason' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 2000 then
    raise exception 'Report note is too long' using errcode = '22001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('skill-report:' || uid::text, 0)
  );
  if (
    select count(*) from public.skill_reports as report
    where report.reporter_user_id = uid
      and report.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Report rate limit exceeded' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.skill_reports as report
    where report.reporter_user_id = uid
      and report.skill_id = p_skill_id::text
      and report.reason = p_reason
      and report.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'Duplicate report' using errcode = 'P0001';
  end if;

  insert into public.skill_reports (
    skill_id, skill_slug, skill_name, reason, note, reporter_user_id
  )
  select
    skill.id::text,
    skill.slug,
    skill.name,
    p_reason,
    nullif(btrim(p_note), ''),
    uid
  from public.skills as skill
  where skill.id = p_skill_id
  returning id into report_id;

  if report_id is null then
    raise exception 'Skill not found' using errcode = '23503';
  end if;
  return report_id;
end;
$$;

create or replace function public.apply_submission_decision(
  p_submission_id uuid,
  p_decision text,
  p_reviewer_note text,
  p_health jsonb,
  p_skill_rows jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_decision text;
begin
  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'Invalid submission decision' using errcode = '22023';
  end if;

  select submission.status, submission.agent_decision
    into current_status, current_decision
  from public.submissions as submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if current_status <> 'pending' then
    raise exception 'Submission is no longer pending' using errcode = 'P0001';
  end if;
  if current_decision is not null and current_decision <> p_decision then
    raise exception 'Submission decision changed' using errcode = 'P0001';
  end if;

  if p_decision = 'approve' then
    if jsonb_typeof(p_skill_rows) is distinct from 'array' then
      raise exception 'Approved submission requires a skill-row array' using errcode = '22023';
    end if;
    if jsonb_array_length(p_skill_rows) = 0 then
      raise exception 'Approved submission requires skill rows' using errcode = '22023';
    end if;

    insert into public.skills (
      slug, name, description, category, tags, author, github_url,
      skill_md_content, rank, score, featured
    )
    select
      row.slug,
      row.name,
      row.description,
      row.category,
      coalesce(array(select jsonb_array_elements_text(row.tags)), '{}'::text[]),
      row.author,
      row.github_url,
      row.skill_md_content,
      row.rank,
      row.score,
      row.featured
    from jsonb_to_recordset(p_skill_rows) as row(
      slug text,
      name text,
      description text,
      category text,
      tags jsonb,
      author text,
      github_url text,
      skill_md_content text,
      rank integer,
      score integer,
      featured boolean
    )
    on conflict (slug) do update set
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      tags = excluded.tags,
      author = excluded.author,
      github_url = excluded.github_url,
      skill_md_content = excluded.skill_md_content,
      rank = excluded.rank,
      score = excluded.score,
      featured = excluded.featured,
      updated_at = now();
  end if;

  update public.submissions
  set status = case p_decision when 'approve' then 'approved' else 'rejected' end,
      reviewer_note = nullif(btrim(p_reviewer_note), ''),
      reviewed_at = now(),
      health = p_health
  where id = p_submission_id;
end;
$$;

revoke all on function public.set_updated_at()
  from public, anon, authenticated, service_role;

revoke all on function public.get_new_counts_by_category(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_new_counts_by_category(timestamptz)
  to anon, authenticated;

revoke all on function public.get_category_counts()
  from public, anon, authenticated, service_role;
grant execute on function public.get_category_counts()
  to anon, authenticated;

revoke all on function public.get_repo_groups(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_repo_groups(text, integer, integer)
  to anon, authenticated;

revoke all on function public.delete_my_account()
  from public, anon, authenticated, service_role;
grant execute on function public.delete_my_account() to authenticated;

revoke all on function public.submit_skill_report(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_skill_report(uuid, text, text)
  to authenticated;

revoke all on function public.apply_submission_decision(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_submission_decision(uuid, text, text, jsonb, jsonb)
  to service_role;

create or replace function public.apply_skill_overrides(
  p_featured_slugs text[],
  p_ranks jsonb,
  p_category_overrides jsonb,
  p_strict boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  override_slug text;
  override_value text;
  parsed_rank integer;
  featured_applied integer;
  ranks_applied integer;
  categories_applied integer;
  missing_slugs text[];
begin
  if p_strict is null
    or p_featured_slugs is null
    or exists (
      select 1
      from unnest(p_featured_slugs) as featured_slug
      where nullif(btrim(featured_slug), '') is null
    )
    or (
      select count(*) <> count(distinct featured_slug)
      from unnest(p_featured_slugs) as featured_slug
    ) then
    raise exception 'Invalid featured slugs' using errcode = '22023';
  end if;

  if jsonb_typeof(p_ranks) is distinct from 'object'
    or jsonb_typeof(p_category_overrides) is distinct from 'object' then
    raise exception 'Override maps must be JSON objects' using errcode = '22023';
  end if;

  select coalesce(array_agg(reference.slug order by reference.slug), array[]::text[])
    into missing_slugs
  from (
    select unnest(p_featured_slugs) as slug
    union
    select jsonb_object_keys(p_ranks) as slug
    union
    select jsonb_object_keys(p_category_overrides) as slug
  ) as reference
  where not exists (
    select 1 from public.skills as skill where skill.slug = reference.slug
  );

  if p_strict and cardinality(missing_slugs) > 0 then
    raise exception 'Override slugs not found: %', array_to_string(missing_slugs, ', ')
      using errcode = '22023';
  end if;

  update public.skills as skill
  set featured = (skill.slug = any(p_featured_slugs))
  where skill.featured is distinct from (skill.slug = any(p_featured_slugs));

  for override_slug, override_value in
    select key, value from jsonb_each_text(p_ranks)
  loop
    if nullif(btrim(override_slug), '') is null then
      raise exception 'Invalid rank slug' using errcode = '22023';
    end if;
    begin
      parsed_rank := override_value::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid rank for %', override_slug using errcode = '22023';
    end;
    update public.skills set rank = parsed_rank where slug = override_slug;
  end loop;

  for override_slug, override_value in
    select key, value from jsonb_each_text(p_category_overrides)
  loop
    if nullif(btrim(override_slug), '') is null
      or not exists (
        select 1 from public.categories where slug = override_value
      ) then
      raise exception 'Invalid category override for %', override_slug
        using errcode = '22023';
    end if;
    update public.skills set category = override_value where slug = override_slug;
  end loop;

  select count(*) into featured_applied
  from public.skills as skill
  where skill.slug = any(p_featured_slugs);

  select count(*) into ranks_applied
  from public.skills as skill
  where skill.slug in (select jsonb_object_keys(p_ranks));

  select count(*) into categories_applied
  from public.skills as skill
  where skill.slug in (select jsonb_object_keys(p_category_overrides));

  return jsonb_build_object(
    'featured_applied', featured_applied,
    'ranks_applied', ranks_applied,
    'categories_applied', categories_applied,
    'missing_slugs', to_jsonb(missing_slugs)
  );
end;
$$;

create or replace function public.fill_skill_enrichment(
  p_skill_id uuid,
  p_source_updated_at timestamptz,
  p_description_zh text,
  p_use_cases text[],
  p_use_cases_en text[],
  p_skill_md_summary_zh text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_description_zh text;
  current_use_cases text[];
  current_use_cases_en text[];
  current_skill_md_summary_zh text;
  repair_use_case_pair boolean;
begin
  if p_source_updated_at is null
    or p_description_zh is null
    or p_use_cases is null
    or p_use_cases_en is null
    or p_skill_md_summary_zh is null
    or length(btrim(p_description_zh)) not between 50 and 80
    or length(btrim(p_skill_md_summary_zh)) not between 150 and 250
    or cardinality(p_use_cases) not between 3 and 5
    or cardinality(p_use_cases_en) <> cardinality(p_use_cases)
    or exists (
      select 1 from unnest(p_use_cases) as item
      where nullif(btrim(item), '') is null
        or length(btrim(item)) not between 4 and 8
    )
    or exists (
      select 1 from unnest(p_use_cases_en) as item
      where nullif(btrim(item), '') is null
        or cardinality(pg_catalog.regexp_split_to_array(btrim(item), '\s+'))
          not between 1 and 3
    ) then
    raise exception 'Invalid enrichment payload' using errcode = '22023';
  end if;

  select
    skill.description_zh,
    skill.use_cases,
    skill.use_cases_en,
    skill.skill_md_summary_zh
  into
    current_description_zh,
    current_use_cases,
    current_use_cases_en,
    current_skill_md_summary_zh
  from public.skills as skill
  where skill.id = p_skill_id
    and skill.updated_at = p_source_updated_at
  for update;

  if not found then
    return false;
  end if;

  repair_use_case_pair :=
    cardinality(coalesce(current_use_cases, '{}'::text[])) not between 3 and 5
    or cardinality(coalesce(current_use_cases_en, '{}'::text[])) not between 3 and 5
    or cardinality(coalesce(current_use_cases, '{}'::text[]))
      <> cardinality(coalesce(current_use_cases_en, '{}'::text[]))
    or exists (
      select 1 from unnest(coalesce(current_use_cases, '{}'::text[])) as item
      where nullif(btrim(item), '') is null
        or length(btrim(item)) not between 4 and 8
    )
    or exists (
      select 1 from unnest(coalesce(current_use_cases_en, '{}'::text[])) as item
      where nullif(btrim(item), '') is null
        or cardinality(pg_catalog.regexp_split_to_array(btrim(item), '\s+'))
          not between 1 and 3
    );

  update public.skills
  set description_zh = case
        when length(btrim(coalesce(current_description_zh, ''))) not between 50 and 80
          then btrim(p_description_zh)
        else description_zh
      end,
      use_cases = case
        when repair_use_case_pair then p_use_cases
        else use_cases
      end,
      use_cases_en = case
        when repair_use_case_pair then p_use_cases_en
        else use_cases_en
      end,
      skill_md_summary_zh = case
        when length(btrim(coalesce(current_skill_md_summary_zh, '')))
          not between 150 and 250
          then btrim(p_skill_md_summary_zh)
        else skill_md_summary_zh
      end
  where id = p_skill_id;

  return true;
end;
$$;

revoke all on function public.apply_skill_overrides(text[], jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_skill_overrides(text[], jsonb, jsonb, boolean)
  to service_role;

revoke all on function public.fill_skill_enrichment(uuid, timestamptz, text, text[], text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.fill_skill_enrichment(uuid, timestamptz, text, text[], text[], text)
  to service_role;

-- Batched source-metadata refresh (migration 018).
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
-- Also records the repository's daily star snapshot (migration 020).
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

-- Trending terms radar (migration 019)
-- Trending AI terms radar. The base table keeps internal provenance (source,
-- source_url, trends_heat) and is writable only by the service role. The mini
-- program reads the restricted view below with the public anon key.
create table if not exists public.trending_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  summary_zh text,
  score numeric check (score is null or (score >= 0 and score <= 1)),
  heat numeric,
  status text check (status is null or status in ('待观察', '已命中', '未命中', '已转选题')),
  discovered_at date,
  recheck_at date,
  trends_heat numeric,
  source text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trending_terms_discovered_score_idx
  on public.trending_terms (discovered_at desc nulls last, score desc nulls last);

drop trigger if exists trending_terms_set_updated_at on public.trending_terms;
create trigger trending_terms_set_updated_at
before update on public.trending_terms
for each row execute function public.set_updated_at();

-- Preserve reviewed radar summaries across repeated imports (migration 022).
create or replace function public.preserve_trending_term_summary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Keep the caller's database role: a SECURITY DEFINER function would make
  -- service_role imports look like administrator edits. Intentional changes
  -- use the postgres role, for example through the administrative SQL Editor.
  if current_user <> 'postgres'
    and nullif(pg_catalog.btrim(old.summary_zh), '') is not null
  then
    new.summary_zh := old.summary_zh;
  end if;
  return new;
end;
$$;

revoke all on function public.preserve_trending_term_summary()
  from public, anon, authenticated, service_role;

-- Covers explicit UPDATE and the UPDATE arm of INSERT ... ON CONFLICT.
-- New rows, missing summaries and updates to other columns remain writable.
drop trigger if exists trending_terms_preserve_summary on public.trending_terms;
create trigger trending_terms_preserve_summary
before update of summary_zh on public.trending_terms
for each row execute function public.preserve_trending_term_summary();

alter table public.trending_terms enable row level security;
drop policy if exists "trending_terms select" on public.trending_terms;

revoke all on table public.trending_terms from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.trending_terms to service_role;

-- The public view and its grants are defined once in the 023 section below.
-- Replaying the schema must not shrink an existing view back to six columns.

-- Hot and latest skills (migration 020)
-- Repository key as a stored generated column. Adding it rewrites the table
-- but does not fire row triggers, so updated_at is not touched.
alter table public.skills
  add column if not exists repo_key text
  generated always as (public.skill_repo_key(github_url)) stored;

create index if not exists skills_repo_key_idx on public.skills (repo_key);
create index if not exists skills_created_at_idx on public.skills (created_at desc);

-- One row per repository per UTC day. Internal: never exposed to clients.
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

-- Retention: the growth window needs about ten days; keep six weeks.
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

-- Hot this week: star growth per repository, one representative skill each.
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
      -- Translated copies of a repository's docs (docs/ja-JP/…, translations/te/…)
      -- are duplicates in a language the reader cannot use; Chinese and English stay.
      and skill.github_url !~* '/(docs|i18n|locales?|translations?|lang|languages)/(ja|ko|de|es|fr|pt|it|ru|te|hi|vi|th|id|tr|ar|pl|nl|uk|fa|bn|ms)([-_][a-z]{2,4})?/'
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

-- Latest additions: newest first, at most p_per_repo skills per repository so
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

-- Daily prune through pg_cron when it is available (Supabase Cron is already
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

-- Invalidate all generated text together when the model's source changes.
create or replace function public.invalidate_changed_skill_enrichment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.description_zh := null;
  new.use_cases := '{}'::text[];
  new.use_cases_en := '{}'::text[];
  new.skill_md_summary_zh := null;
  return new;
end;
$$;

revoke all on function public.invalidate_changed_skill_enrichment()
  from public, anon, authenticated, service_role;

drop trigger if exists skills_invalidate_enrichment on public.skills;
create trigger skills_invalidate_enrichment
before update on public.skills
for each row
when (
  (old.name, old.description, old.skill_md_content)
  is distinct from
  (new.name, new.description, new.skill_md_content)
)
execute function public.invalidate_changed_skill_enrichment();

commit;

-- 023: Radar popularity (per-platform, independently refreshed).
begin;

-- Keep popularity separate from imported editorial scores and summaries.
-- A canonical source is shared by all terms pointing to the same repository.
create or replace function public.radar_popularity_source_key(p_url text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select case
    when p_url ~* '^https://github[.]com/[a-z0-9_-]+/[a-z0-9_.-]+([/?#]|$)'
      then 'github:' || pg_catalog.lower(pg_catalog.regexp_replace(
        pg_catalog.substring(p_url, '(?i)^https://github[.]com/([^/]+/[^/?#]+)'), '[.]git$', '', 'i'))
    when p_url ~* '^https://huggingface[.]co/[a-z0-9_-]+/[a-z0-9_.-]+([/?#]|$)'
      and p_url !~* '^https://huggingface[.]co/(spaces|datasets|docs|api|organizations|collections)/'
      then 'huggingface:' || pg_catalog.substring(p_url, '(?i)^https://huggingface[.]co/([^/]+/[^/?#]+)')
    else null
  end;
$$;

create table if not exists public.radar_popularity_sources (
  source_key text primary key,
  platform text not null check (platform in ('github', 'huggingface')),
  source_id text not null,
  popularity_count bigint check (popularity_count between 0 and 9007199254740991),
  checked_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'ok', 'error', 'missing')),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  failure_count integer not null default 0 check (failure_count >= 0),
  check (source_key = platform || ':' || source_id)
);

create table if not exists public.radar_popularity_refresh_lease (
  name text primary key check (name = 'radar'),
  holder uuid not null,
  expires_at timestamptz not null
);

-- A platform-wide cooldown survives Edge invocations. A rate limit on one
-- repository must also stop the next batch from querying its siblings.
create table if not exists public.radar_popularity_platform_limits (
  platform text primary key check (platform in ('github', 'huggingface')),
  blocked_until timestamptz not null,
  last_limited_at timestamptz not null
);

alter table public.radar_popularity_sources enable row level security;
alter table public.radar_popularity_refresh_lease enable row level security;
alter table public.radar_popularity_platform_limits enable row level security;
revoke all on table public.radar_popularity_sources, public.radar_popularity_refresh_lease,
  public.radar_popularity_platform_limits
  from public, anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.radar_popularity_sources, public.radar_popularity_refresh_lease,
  public.radar_popularity_platform_limits to service_role;

create or replace function public.claim_radar_popularity_refresh(p_holder uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare claimed boolean;
begin
  insert into public.radar_popularity_refresh_lease (name, holder, expires_at)
  values ('radar', p_holder, now() + interval '150 seconds')
  on conflict (name) do update
    set holder = excluded.holder, expires_at = excluded.expires_at
    where public.radar_popularity_refresh_lease.expires_at < now()
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create or replace function public.release_radar_popularity_refresh(p_holder uuid)
returns void
language sql
set search_path = ''
as $$
  delete from public.radar_popularity_refresh_lease
  where name = 'radar' and holder = p_holder;
$$;

create or replace function public.radar_popularity_sources_due(p_holder uuid, p_limit integer)
returns table (source_key text, platform text, source_id text)
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.radar_popularity_refresh_lease
    where name = 'radar' and holder = p_holder and expires_at > now()) then
    raise exception 'radar refresh lease required';
  end if;

  insert into public.radar_popularity_sources (source_key, platform, source_id)
  select distinct key, pg_catalog.split_part(key, ':', 1), pg_catalog.split_part(key, ':', 2)
  from (select public.radar_popularity_source_key(t.source_url) as key from public.trending_terms t) sources
  where key is not null
  on conflict do nothing;

  return query
  select s.source_key, s.platform, s.source_id
  from public.radar_popularity_sources s
  where s.next_attempt_at <= now()
    and (s.checked_at is null or s.checked_at <= now() - interval '60 minutes')
    and not exists (select 1 from public.radar_popularity_platform_limits limits
      where limits.platform = s.platform and limits.blocked_until > now())
    and exists (select 1 from public.trending_terms t
      where public.radar_popularity_source_key(t.source_url) = s.source_key)
  order by s.last_attempt_at nulls first, s.source_key
  limit least(greatest(coalesce(p_limit, 0), 0), 40);
end;
$$;

-- Remove the pre-cooldown signature if this draft migration is reapplied.
drop function if exists public.apply_radar_popularity(uuid, text, text, bigint, integer);
create or replace function public.apply_radar_popularity(
  p_holder uuid, p_source_key text, p_status text,
  p_count bigint default null, p_retry_after_seconds integer default null,
  p_platform_limited boolean default false
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  attempted timestamptz := now();
  source_platform text;
begin
  if p_status is null or p_status not in ('ok', 'error', 'missing')
    or (coalesce(p_platform_limited, false) and p_status <> 'error')
    or (p_status = 'ok' and (p_count is null or p_count < 0 or p_count > 9007199254740991)) then
    raise exception 'invalid radar popularity result';
  end if;
  if not exists (select 1 from public.radar_popularity_refresh_lease
    where name = 'radar' and holder = p_holder and expires_at > attempted) then
    raise exception 'radar refresh lease expired';
  end if;

  update public.radar_popularity_sources s
  set popularity_count = case when p_status = 'ok' then p_count
        when p_status = 'missing' then null else s.popularity_count end,
      checked_at = case when p_status = 'ok' then attempted else s.checked_at end,
      status = p_status,
      last_attempt_at = attempted,
      failure_count = case when p_status = 'ok' then 0 else least(s.failure_count + 1, 16) end,
      next_attempt_at = attempted + case
        when p_status = 'ok' then interval '60 minutes'
        when p_status = 'missing' then interval '24 hours'
        else pg_catalog.make_interval(secs => greatest(
          least(greatest(coalesce(p_retry_after_seconds, 0), 0), 86400),
          least(900 * pg_catalog.power(2, least(s.failure_count, 7)), 86400)
        ))
      end
  where s.source_key = p_source_key
  returning s.platform into source_platform;
  if not found then raise exception 'unknown radar popularity source'; end if;

  if coalesce(p_platform_limited, false) then
    insert into public.radar_popularity_platform_limits (platform, blocked_until, last_limited_at)
    values (source_platform, attempted + pg_catalog.make_interval(secs =>
      case when p_retry_after_seconds > 0 then p_retry_after_seconds else 3600 end), attempted)
    on conflict (platform) do update
      set blocked_until = greatest(public.radar_popularity_platform_limits.blocked_until, excluded.blocked_until),
          last_limited_at = excluded.last_limited_at;
  end if;
end;
$$;

-- Existing clients keep their original six columns. Public clients cannot
-- read source URLs, refresh leases, backoff state, or write any popularity data.
-- Inline the same canonicalization here: no privileged helper RPC is exposed.
create or replace view public.trending_terms_public as
select t.term, t.summary_zh, t.score, t.heat, t.status, t.discovered_at,
  pg_catalog.split_part(c.key, ':', 1) as popularity_platform,
  case when s.status in ('ok', 'error') then s.popularity_count else null end as popularity_count,
  s.checked_at as popularity_checked_at,
  case when c.key is null then null else coalesce(s.status, 'pending') end as popularity_status
from public.trending_terms t
cross join lateral (select case
  when t.source_url ~* '^https://github[.]com/[a-z0-9_-]+/[a-z0-9_.-]+([/?#]|$)'
    then 'github:' || pg_catalog.lower(pg_catalog.regexp_replace(
      pg_catalog.substring(t.source_url, '(?i)^https://github[.]com/([^/]+/[^/?#]+)'), '[.]git$', '', 'i'))
  when t.source_url ~* '^https://huggingface[.]co/[a-z0-9_-]+/[a-z0-9_.-]+([/?#]|$)'
    and t.source_url !~* '^https://huggingface[.]co/(spaces|datasets|docs|api|organizations|collections)/'
    then 'huggingface:' || pg_catalog.substring(t.source_url, '(?i)^https://huggingface[.]co/([^/]+/[^/?#]+)')
  else null end as key) c
left join public.radar_popularity_sources s on s.source_key = c.key;

revoke all on table public.trending_terms_public from public, anon, authenticated, service_role;
grant select on table public.trending_terms_public to anon, authenticated, service_role;

revoke all on function public.radar_popularity_source_key(text) from public, anon, authenticated;
grant execute on function public.radar_popularity_source_key(text) to service_role;
revoke all on function public.claim_radar_popularity_refresh(uuid) from public, anon, authenticated;
grant execute on function public.claim_radar_popularity_refresh(uuid) to service_role;
revoke all on function public.release_radar_popularity_refresh(uuid) from public, anon, authenticated;
grant execute on function public.release_radar_popularity_refresh(uuid) to service_role;
revoke all on function public.radar_popularity_sources_due(uuid, integer) from public, anon, authenticated;
grant execute on function public.radar_popularity_sources_due(uuid, integer) to service_role;
revoke all on function public.apply_radar_popularity(uuid, text, text, bigint, integer, boolean) from public, anon, authenticated;
grant execute on function public.apply_radar_popularity(uuid, text, text, bigint, integer, boolean) to service_role;

-- Open radar candidate pool (migration 027)
-- 开源雷达候选池。抓取脚本（scripts/import/import-open-radar.ts）只写 draft；
-- 人工审核后把 status 改为 published，小程序才能读到。基表含内部来源信息
-- （source_id、source_url、full_name），仅 service_role 可读写；小程序通过下面
-- 的受限视图 open_radar_published 用公开 anon key 读取已发布条目。
create table if not exists public.open_radar_items (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('github_trending', 'product_hunt')),
  source_id text not null check (btrim(source_id) <> ''),
  source_url text,
  -- 仅后台/内部使用：来源站点的仓库全名，永远不进入对外视图。
  full_name text,
  title text not null check (btrim(title) <> ''),
  title_zh text,
  -- summary 来自来源站点的描述（占位，可能是原文）；summary_zh 是后补的自产中文摘要。
  summary text,
  summary_zh text,
  pitfalls text[] not null default '{}',
  install_command text,
  article_url text,
  package_url text,
  language text,
  topics text[] not null default '{}',
  stars_today integer check (stars_today is null or stars_today >= 0),
  stars_total integer check (stars_total is null or stars_total >= 0),
  votes_count integer check (votes_count is null or votes_count >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'rejected')),
  discovered_at date not null default current_date,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id),
  constraint open_radar_items_published_has_summary check (
    status <> 'published'
    or nullif(btrim(coalesce(summary_zh, summary, '')), '') is not null
  ),
  -- 对外不出现 GitHub 品牌字样：发布前必须把来源描述里的品牌词改写掉。
  constraint open_radar_items_published_no_brand check (
    status <> 'published'
    or concat_ws(' ', title, title_zh, summary, summary_zh, install_command, array_to_string(pitfalls, ' '))
      !~* 'github'
  )
);

create index if not exists open_radar_items_status_published_idx
  on public.open_radar_items (status, published_at desc nulls last);
create index if not exists open_radar_items_status_discovered_idx
  on public.open_radar_items (status, discovered_at desc);

create or replace function public.open_radar_items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.open_radar_items_before_write()
  from public, anon, authenticated, service_role;

drop trigger if exists open_radar_items_before_write on public.open_radar_items;
create trigger open_radar_items_before_write
before insert or update on public.open_radar_items
for each row execute function public.open_radar_items_before_write();

alter table public.open_radar_items enable row level security;

revoke all on table public.open_radar_items from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.open_radar_items to service_role;

-- 属主身份运行的视图（无 security_invoker）：anon 只能读到这些列，且只有
-- status = 'published' 的行；source、source_url、full_name 等内部字段不在其中。
create or replace view public.open_radar_published as
select
  id,
  coalesce(nullif(btrim(title_zh), ''), title) as title_zh,
  coalesce(nullif(btrim(summary_zh), ''), nullif(btrim(summary), ''), '') as summary,
  pitfalls,
  install_command,
  article_url,
  package_url,
  published_at
from public.open_radar_items
where status = 'published';

revoke all on table public.open_radar_published from public, anon, authenticated, service_role;
grant select on table public.open_radar_published to anon, authenticated, service_role;

commit;
