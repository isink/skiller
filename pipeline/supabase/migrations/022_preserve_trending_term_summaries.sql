-- 022: preserve existing radar summaries during repeated external imports.
-- Run only this migration on an existing project. No rows are rewritten.
begin;

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

commit;
