begin;

-- 开源雷达详情页正文是项目自己的 README，不是我们改写的中文摘要。
-- README 由抓取/回填脚本（scripts/import/import-open-radar.ts、backfill-open-radar-readme.ts）
-- 清洗后写入：去掉 HTML/图片/徽章，来源平台的仓库地址换成 <repo-url>，品牌词换成「Git 平台」，
-- 并限制长度。小程序不在运行时访问来源站点，只读下面视图里的 readme_md。
alter table public.open_radar_items
  add column if not exists readme_md text;

alter table public.open_radar_items
  drop constraint if exists open_radar_items_readme_length;
alter table public.open_radar_items
  add constraint open_radar_items_readme_length check (readme_md is null or char_length(readme_md) <= 100000);

-- 和标题/摘要一致：已发布条目的 README 不能出现 GitHub 字样。手工粘贴 README 时先把品牌词替换掉，例如
--   regexp_replace(readme, 'github', 'Git 平台', 'gi')
alter table public.open_radar_items
  drop constraint if exists open_radar_items_published_readme_no_brand;
alter table public.open_radar_items
  add constraint open_radar_items_published_readme_no_brand check (
    status <> 'published'
    or readme_md is null
    or readme_md !~* 'github'
  );

-- 新增列只能追加在视图末尾；source、source_url、full_name 等内部字段仍不在视图里。
create or replace view public.open_radar_published as
select
  id,
  coalesce(nullif(btrim(title_zh), ''), title) as title_zh,
  coalesce(nullif(btrim(summary_zh), ''), nullif(btrim(summary), ''), '') as summary,
  pitfalls,
  install_command,
  article_url,
  package_url,
  published_at,
  readme_md
from public.open_radar_items
where status = 'published';

revoke all on table public.open_radar_published from public, anon, authenticated, service_role;
grant select on table public.open_radar_published to anon, authenticated, service_role;

commit;
