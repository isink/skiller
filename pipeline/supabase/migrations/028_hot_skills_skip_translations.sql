-- 028: 本周热门不再选用其他语言的文档副本作为仓库代表。
-- 原来 affaan-m/ECC 的代表是 docs/ja-JP/skills/dmux-workflows，排在欢迎页「今日热门工具」第一。
-- 只改 get_hot_skills 的候选过滤；在 Supabase SQL Editor 整个执行一次，可重复执行。
begin;

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

revoke all on function public.get_hot_skills(integer, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_hot_skills(integer, integer, integer)
  to anon, authenticated, service_role;

commit;

-- Verify (expect 0 rows):
-- select slug, github_url from public.get_hot_skills(7, 30, 3)
--   where github_url ~* '/(docs|i18n|locales?|translations?)/(ja|ko|de|es|te)';
