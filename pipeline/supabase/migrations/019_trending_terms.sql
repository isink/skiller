begin;

-- Trending AI terms radar. The base table keeps internal provenance (source,
-- source_url, trends_heat) and is writable only by the service role. The mini
-- program reads the restricted view below with the public anon key.
create table if not exists public.trending_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  summary_zh text,
  score numeric check (score is null or (score >= 0 and score <= 1)),
  heat numeric,
  status text check (status is null or status in ('待观察', '已命中', '未命中', '已转选题')),
  discovered_at date,
  recheck_at date,
  trends_heat numeric,
  source text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trending_terms_discovered_score_idx
  on public.trending_terms (discovered_at desc nulls last, score desc nulls last);

drop trigger if exists trending_terms_set_updated_at on public.trending_terms;
create trigger trending_terms_set_updated_at
before update on public.trending_terms
for each row execute function public.set_updated_at();

alter table public.trending_terms enable row level security;
drop policy if exists "trending_terms select" on public.trending_terms;

revoke all on table public.trending_terms from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.trending_terms to service_role;

-- Owner-run view (no security_invoker) so anon can read these columns without
-- any access to the base table. source and source_url are intentionally absent.
create or replace view public.trending_terms_public as
select term, summary_zh, score, heat, status, discovered_at
from public.trending_terms;

revoke all on table public.trending_terms_public from public, anon, authenticated, service_role;
grant select on table public.trending_terms_public to anon, authenticated, service_role;

commit;
