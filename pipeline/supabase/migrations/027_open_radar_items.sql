begin;

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
