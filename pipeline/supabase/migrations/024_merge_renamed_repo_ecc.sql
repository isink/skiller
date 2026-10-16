-- 024: merge renamed repo affaan-m/everything-claude-code into canonical affaan-m/ECC.
-- GitHub redirects the old name, so the importer stored both and 本周热门 counted the repo twice.
-- Run this whole file once in the Supabase SQL Editor. Idempotent: a second run changes nothing.
begin;

-- 1. Old-key skills whose ECC twin (same path after the branch) already exists:
--    move favorites to the twin, then delete the old row (favorites cascade otherwise).
create temp table ecc_dupes on commit drop as
select old.id as old_id, keep.id as keep_id
from public.skills as old
join public.skills as keep
  on keep.repo_key = 'affaan-m/ecc'
 and regexp_replace(keep.github_url, '^https://github[.]com/[^/]+/[^/]+/blob/[^/]+/', '')
   = regexp_replace(old.github_url,  '^https://github[.]com/[^/]+/[^/]+/blob/[^/]+/', '')
where old.repo_key = 'affaan-m/everything-claude-code';

insert into public.favorites (user_id, skill_id)
select f.user_id, d.keep_id
from public.favorites as f join ecc_dupes as d on d.old_id = f.skill_id
on conflict do nothing;

delete from public.skills where id in (select old_id from ecc_dupes);

-- 2. Remaining old-key skills: repoint to ECC. repo_key is generated from github_url.
--    Slug is renamed to what the importer now generates, so the next import updates
--    this row instead of inserting a second copy (skipped if that slug is taken).
update public.skills as s
set github_url = regexp_replace(s.github_url,
      '^https://github[.]com/affaan-m/everything-claude-code/', 'https://github.com/affaan-m/ECC/', 'i'),
    slug = case
      when not exists (select 1 from public.skills t
        where t.slug = replace(s.slug, 'affaan-m-everything-claude-code-', 'affaan-m-ecc-'))
      then replace(s.slug, 'affaan-m-everything-claude-code-', 'affaan-m-ecc-')
      else s.slug end
where s.repo_key = 'affaan-m/everything-claude-code';

-- 3. Drop the old repo's star history and refresh state (ECC has identical snapshots).
delete from public.github_repo_star_snapshots where repo_key = 'affaan-m/everything-claude-code';
delete from public.github_repo_refresh_state  where repo_key = 'affaan-m/everything-claude-code';

commit;

-- Verify (expect only affaan-m/ecc rows, and 0 old snapshots):
-- select repo_key, count(*) skills from public.skills where repo_key like 'affaan-m/%' group by 1;
-- select count(*) old_snapshots from public.github_repo_star_snapshots where repo_key = 'affaan-m/everything-claude-code';
-- select slug, name from public.get_hot_skills(7, 30, 3) where github_url ilike '%affaan-m/%';
