-- Migration: add github_stars column
-- Run in Supabase SQL Editor

alter table public.skills
  add column if not exists github_stars integer;
