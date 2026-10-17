begin;

-- 「微信小程序 SKILL」专题 category. Skills are assigned to it by
-- scripts/import/import-mp-skills.ts (dry-run by default); nothing is moved here.
insert into public.categories (slug, name, icon)
values ('mp-skill', '微信小程序 SKILL', 'sparkles')
on conflict (slug) do update
  set name = excluded.name,
      icon = excluded.icon;

commit;
