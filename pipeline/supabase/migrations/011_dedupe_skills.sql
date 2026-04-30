-- 011_dedupe_skills.sql
-- One-off cleanup: same author+name appearing as multiple rows is always the
-- import pipeline picking up the same SKILL.md copied into different subdirs
-- of one repo (e.g. majiayu000/claude-skill-registry has vue-skill duplicated
-- across `skills/data/`, `skills/other/`, `skills/other/other/`, `other/`).
-- Keep the earliest created_at as canonical and drop the rest.
--
-- Run the preview block first to sanity-check what's about to be deleted.
-- Run the delete block once you're satisfied. The script is idempotent.

-- ─── Preview ────────────────────────────────────────────────────────────────
-- Uncomment to inspect before deleting:
--
-- select lower(author) as author, lower(name) as name, count(*) as cnt,
--        array_agg(slug order by created_at) as slugs
-- from public.skills
-- where coalesce(author, '') <> '' and coalesce(name, '') <> ''
-- group by lower(author), lower(name)
-- having count(*) > 1
-- order by cnt desc;

-- ─── Cleanup ────────────────────────────────────────────────────────────────
with ranked as (
  select id,
         row_number() over (
           partition by lower(author), lower(name)
           order by created_at asc
         ) as rn
  from public.skills
  where coalesce(author, '') <> ''
    and coalesce(name, '') <> ''
)
delete from public.skills
where id in (select id from ranked where rn > 1);
