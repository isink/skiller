begin;

-- The mini program now reports `feedback`: a reader says whether a skill worked
-- for them (meta.vote = 'up' | 'down', meta.id, meta.slug). Extends the whitelist from 025.
do $$
declare
  existing record;
begin
  if to_regclass('public.mp_events') is null then
    raise exception 'public.mp_events is missing; run 024_mp_events.sql first';
  end if;

  for existing in
    select conname
    from pg_constraint
    where conrelid = 'public.mp_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%page_view%'
  loop
    execute format('alter table public.mp_events drop constraint %I', existing.conname);
  end loop;
end;
$$;

alter table public.mp_events
  add constraint mp_events_event_check
  check (event in (
    'page_view', 'search', 'search_empty', 'js_error', 'perf',
    'copy_install', 'share', 'feedback'
  ));

commit;

-- Votes per skill (run as postgres in the SQL Editor):
-- select meta->>'slug' as slug,
--        count(*) filter (where meta->>'vote' = 'up') as up,
--        count(*) filter (where meta->>'vote' = 'down') as down
-- from public.mp_events
-- where event = 'feedback' and meta->>'env' = 'release'
-- group by 1 order by down desc, up desc;
