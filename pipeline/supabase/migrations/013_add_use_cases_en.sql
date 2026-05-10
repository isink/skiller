-- Migration: add English use_cases column for international users.
-- The existing use_cases column holds Chinese tags; this adds an English
-- counterpart so the iOS app can show locale-appropriate chips.
--
-- Run once in the Supabase SQL Editor.

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS use_cases_en text[] NOT NULL DEFAULT '{}';
