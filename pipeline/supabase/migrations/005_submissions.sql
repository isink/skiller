-- 005_submissions.sql
-- UGC submissions: anyone can paste a GitHub URL of a skill they want indexed.
-- Reviewer (you) reads pending rows in Supabase Studio, then runs the import
-- pipeline manually and flips the row to approved/rejected.

create table if not exists public.submissions (
  id              uuid primary key default uuid_generate_v4(),
  github_url      text not null,
  submitter_email text,
  note            text,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  reviewer_note   text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);

create index if not exists submissions_status_idx
  on public.submissions (status, created_at desc);

alter table public.submissions enable row level security;

-- Anonymous clients can insert (the submission form), but cannot read or modify.
-- Reviewer reads/updates via the service role in Supabase Studio.
drop policy if exists "submissions insert anon" on public.submissions;
create policy "submissions insert anon" on public.submissions
  for insert with check (true);
