begin;

-- The mini program now reports `copy_install` (install command or link copied)
-- and `share` (detail page shared). Extend the event whitelist from 024.
-- Rows still carry meta.action, so existing queries on page_view/search are unaffected.
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
    'copy_install', 'share'
  ));

commit;
