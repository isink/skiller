-- Disposable database only: source refresh must invalidate obsolete translations.
begin;

insert into public.categories (slug, name) values ('source-enrichment-test', '翻译测试');
insert into public.skills (
  id, slug, name, description, category, skill_md_content,
  description_zh, use_cases, use_cases_en, skill_md_summary_zh,
  rank, score, featured, updated_at
) values (
  '00000000-0000-4000-8000-000000000909', 'source-enrichment-test',
  'Original name', 'Original description', 'source-enrichment-test', '# Original content',
  repeat('旧', 60), array['代码审查', '文档生成', '数据分析'],
  array['Code Review', 'Docs', 'Data Analysis'], repeat('旧', 170),
  8, 7, true, '2000-01-01 00:00:00+00'
);

do $$
begin
  if has_function_privilege('anon', 'public.invalidate_changed_skill_enrichment()', 'execute')
    or has_function_privilege('authenticated', 'public.invalidate_changed_skill_enrichment()', 'execute')
    or has_function_privilege('service_role', 'public.invalidate_changed_skill_enrichment()', 'execute') then
    raise exception 'invalidation trigger must not be exposed as an RPC';
  end if;
end;
$$;

-- The application service can still invoke the installed trigger through UPDATE.
set local role service_role;
do $$
declare
  skill_id uuid := '00000000-0000-4000-8000-000000000909';
  original public.skills%rowtype;
  current_skill public.skills%rowtype;
  source_field text;
  current_version timestamptz;
begin
  select * into original from public.skills where id = skill_id;
  update public.skills set github_stars = 100, github_stars_checked_at = now(),
    source_updated_at = now(), source_checked_at = now(), rank = 9
  where id = skill_id;
  select * into current_skill from public.skills where id = skill_id;
  if current_skill.description_zh is distinct from original.description_zh
    or current_skill.use_cases is distinct from original.use_cases
    or current_skill.use_cases_en is distinct from original.use_cases_en
    or current_skill.skill_md_summary_zh is distinct from original.skill_md_summary_zh
    or current_skill.updated_at is distinct from original.updated_at then
    raise exception 'metadata-only refresh invalidated valid Chinese text or source version';
  end if;

  update public.skills set name = original.name, description = original.description,
    skill_md_content = original.skill_md_content where id = skill_id;
  select * into current_skill from public.skills where id = skill_id;
  if current_skill.description_zh is distinct from original.description_zh
    or current_skill.updated_at is distinct from original.updated_at then
    raise exception 'identical re-import invalidated valid Chinese text or source version';
  end if;

  foreach source_field in array array['name', 'description', 'skill_md_content'] loop
    -- Use an explicit old version because now() is constant inside a transaction.
    update public.skills set updated_at = '2000-01-01 00:00:00+00' where id = skill_id;
    execute format('update public.skills set %I = $1 where id = $2', source_field)
      using 'Changed ' || source_field, skill_id;
    select * into current_skill from public.skills where id = skill_id;
    if current_skill.description_zh is not null
      or current_skill.skill_md_summary_zh is not null
      or current_skill.use_cases <> '{}'::text[]
      or current_skill.use_cases_en <> '{}'::text[] then
      raise exception 'source % changed but obsolete enrichment survived', source_field;
    end if;
    if current_skill.rank <> 9 or current_skill.score <> 7 or not current_skill.featured
      or current_skill.category <> 'source-enrichment-test'
      or current_skill.github_stars <> 100 then
      raise exception 'source invalidation changed unrelated fields';
    end if;
    if current_skill.updated_at = '2000-01-01 00:00:00+00'::timestamptz then
      raise exception 'source invalidation failed to advance the stale-write guard';
    end if;

    if public.fill_skill_enrichment(skill_id, '2000-01-01 00:00:00+00',
      repeat('过', 60), array['代码审查', '文档生成', '数据分析'],
      array['Code Review', 'Docs', 'Data Analysis'], repeat('过', 170)) then
      raise exception 'enrichment generated before the source change was accepted';
    end if;
    current_version := current_skill.updated_at;
    if not public.fill_skill_enrichment(skill_id, current_version,
      repeat('新', 60), array['代码审查', '文档生成', '数据分析'],
      array['Code Review', 'Docs', 'Data Analysis'], repeat('新', 170)) then
      raise exception 'current source enrichment was rejected';
    end if;
    select * into current_skill from public.skills where id = skill_id;
    if current_skill.description_zh <> repeat('新', 60)
      or current_skill.skill_md_summary_zh <> repeat('新', 170)
      or cardinality(current_skill.use_cases) <> 3
      or cardinality(current_skill.use_cases_en) <> 3 then
      raise exception 'new enrichment was cleared or failed to replace obsolete content';
    end if;
  end loop;

  -- NULL transitions count as changes to model input too.
  update public.skills set skill_md_content = null where id = skill_id;
  select * into current_skill from public.skills where id = skill_id;
  if current_skill.description_zh is not null or current_skill.skill_md_summary_zh is not null then
    raise exception 'NULL source transition did not invalidate Chinese text';
  end if;
end;
$$;

rollback;
