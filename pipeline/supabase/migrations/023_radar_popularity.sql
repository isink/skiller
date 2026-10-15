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

commit;
