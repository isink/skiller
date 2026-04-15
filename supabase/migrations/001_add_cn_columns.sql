-- Migration: add Chinese enrichment columns + install_count RPC
-- Run this once in the Supabase SQL Editor (https://supabase.com/dashboard/project/gphynosbfjcyexhkgctf/sql)

alter table public.skills
  add column if not exists description_zh text,
  add column if not exists use_cases      text[] not null default '{}';

create or replace function public.increment_install_count(skill_id uuid)
returns void
language sql
security definer
as $$
  update public.skills set install_count = install_count + 1 where id = skill_id;
$$;

grant execute on function public.increment_install_count(uuid) to anon;
