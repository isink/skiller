begin;

-- First-party analytics for the WeChat mini program. Events are anonymous:
-- anon_id is a random id generated on the device, never an openid.
create table if not exists public.mp_events (
  id bigint generated always as identity primary key,
  event text not null
    check (event in ('page_view', 'search', 'search_empty', 'js_error', 'perf')),
  page text check (page is null or char_length(page) <= 200),
  query text check (query is null or char_length(query) <= 200),
  result_count integer check (result_count is null or result_count >= 0),
  error text check (error is null or char_length(error) <= 2000),
  anon_id text check (anon_id is null or char_length(anon_id) <= 64),
  meta jsonb check (meta is null or pg_column_size(meta) <= 4096),
  created_at timestamptz not null default now()
);

create index if not exists mp_events_created_at_idx
  on public.mp_events (created_at);
create index if not exists mp_events_event_created_at_idx
  on public.mp_events (event, created_at);

alter table public.mp_events enable row level security;

-- Anonymous clients may only append rows. Reads go through the service role.
drop policy if exists "mp_events insert anon" on public.mp_events;
create policy "mp_events insert anon" on public.mp_events
  for insert to anon with check (true);

revoke all on table public.mp_events from public, anon, authenticated, service_role;
grant insert on table public.mp_events to anon;
grant all on table public.mp_events to service_role;

commit;
