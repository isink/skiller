-- Migration: repo grouping for the explore page "全部" (all) tab.
-- Returns one row per owner/repo with stars + skill_count + a representative skill id.
-- Used only by the "全部" view; category-filtered views use a flat list.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_repo_groups(
  p_category text DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  repo text,
  author text,
  stars integer,
  skill_count bigint,
  rep_skill_id uuid
)
LANGUAGE sql STABLE
AS $$
  WITH base AS (
    SELECT
      regexp_replace(github_url, '^https?://github\.com/([^/]+/[^/]+).*$', '\1') AS g_repo,
      author,
      github_stars,
      id,
      featured,
      rank,
      install_count
    FROM skills
    WHERE (p_category IS NULL OR category = p_category)
  ),
  ranked AS (
    SELECT
      g_repo,
      author,
      github_stars,
      id,
      ROW_NUMBER() OVER (
        PARTITION BY g_repo
        ORDER BY featured DESC, rank DESC, install_count DESC NULLS LAST, id
      ) AS rn,
      COUNT(*) OVER (PARTITION BY g_repo) AS cnt
    FROM base
  )
  SELECT g_repo AS repo, author, github_stars AS stars, cnt AS skill_count, id AS rep_skill_id
  FROM ranked
  WHERE rn = 1
  ORDER BY stars DESC NULLS LAST, repo
  OFFSET p_offset LIMIT p_limit;
$$;
