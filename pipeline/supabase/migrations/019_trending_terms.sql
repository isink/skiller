begin;

-- Trending AI terms radar: store and expose trending AI terminology to the mini program.
-- Base table holds all fields including sources; anon reads only the public view.

create table public.trending_terms (
  id uuid primary key default gen_random_uuid(),
  term text unique not null,
  summary_zh text,
  score numeric check (score >= 0 and score <= 1),
  heat numeric,
  status text check (status in ('待观察', '已命中', '未命中', '已转选题')),
  discovered_at date,
  recheck_at date,
  trends_heat numeric,
  source text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trending_terms_set_updated_at
  before update on public.trending_terms
  for each row
  execute function public.set_updated_at();

-- Enable RLS but provide no direct anon access to the base table.
alter table public.trending_terms enable row level security;

-- Grant service_role full access for the import script.
grant select, insert, update, delete on table public.trending_terms to service_role;

-- Public view exposes only user-facing fields; hides source and source_url.
create view public.trending_terms_public as
  select
    term,
    summary_zh,
    score,
    heat,
    status,
    discovered_at
  from public.trending_terms
  order by discovered_at desc nulls last, score desc nulls last;

-- Grant anon read-only access to the public view.
grant select on public.trending_terms_public to anon, authenticated;

commit;
