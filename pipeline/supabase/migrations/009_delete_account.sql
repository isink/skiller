-- 009_delete_account.sql
-- Required by App Store Review Guideline 5.1.1(v): apps that allow account
-- creation must let users delete their account from inside the app.
--
-- This RPC runs as security definer so it can reach into auth.users with the
-- elevated service role, but it gates on auth.uid() to ensure callers can
-- only delete themselves. The on-delete-set-null FK on submissions keeps
-- submission history intact (orphaned, anonymized) for audit purposes.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
