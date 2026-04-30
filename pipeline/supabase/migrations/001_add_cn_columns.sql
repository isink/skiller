-- Migration: add Chinese enrichment columns
-- Run this once in the Supabase SQL Editor (https://supabase.com/dashboard/project/gphynosbfjcyexhkgctf/sql)

alter table public.skills
  add column if not exists description_zh text,
  add column if not exists use_cases      text[] not null default '{}';
