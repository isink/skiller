-- RPC: get new skill counts per category since a given timestamp
CREATE OR REPLACE FUNCTION get_new_counts_by_category(since timestamptz)
RETURNS TABLE(category text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT category, COUNT(*) AS count
  FROM skills
  WHERE created_at > since
  GROUP BY category;
$$;

-- RPC: increment install_count for a skill
CREATE OR REPLACE FUNCTION increment_install_count(skill_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE skills SET install_count = COALESCE(install_count, 0) + 1 WHERE id = skill_id;
$$;
