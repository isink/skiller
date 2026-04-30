-- 006_submissions_user.sql
-- Link submissions to the authenticated GitHub user when one is signed in.
-- Anonymous submissions are still allowed (legacy paste flow), so the column
-- is nullable and the policy permits null user_id.

alter table public.submissions
  add column if not exists submitter_user_id uuid references auth.users(id) on delete set null;

create index if not exists submissions_user_idx
  on public.submissions (submitter_user_id, created_at desc);

-- Replace the permissive anon insert policy with one that prevents users from
-- impersonating other auth.uid() values. Null is still allowed for anonymous.
drop policy if exists "submissions insert anon" on public.submissions;
drop policy if exists "submissions insert" on public.submissions;
create policy "submissions insert" on public.submissions
  for insert with check (
    submitter_user_id is null
    or submitter_user_id = auth.uid()
  );

-- Logged-in users can read back their own submissions (e.g. "我的提交" list).
drop policy if exists "submissions select own" on public.submissions;
create policy "submissions select own" on public.submissions
  for select using (
    submitter_user_id is not null
    and submitter_user_id = auth.uid()
  );
