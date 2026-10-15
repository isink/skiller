-- 021: regenerate translations when the source used to produce them changes.
-- Run only this migration on an existing project. Re-running changes no data.
begin;

create or replace function public.invalidate_changed_skill_enrichment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- These are the inputs sent to the enrichment model. Clear the generated
  -- fields together, so valid but obsolete text cannot bypass the repair queue.
  new.description_zh := null;
  new.use_cases := '{}'::text[];
  new.use_cases_en := '{}'::text[];
  new.skill_md_summary_zh := null;
  return new;
end;
$$;

revoke all on function public.invalidate_changed_skill_enrichment()
  from public, anon, authenticated, service_role;

-- PostgreSQL runs BEFORE triggers alphabetically: invalidate before the
-- existing skills_set_updated_at source-version guard. Metadata-only and
-- identical re-imports leave both translations and the content version alone.
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
