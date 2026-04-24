/**
 * Backfill github_stars for skills where it's NULL.
 *
 * These are mostly community skills imported via `import:discover` that later
 * fell out of GitHub's top-1000 search results, so their stars never got
 * refreshed through the normal sync path.
 *
 * Usage (needs proxy for GitHub access):
 *   https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 npm run backfill:stars
 *
 * Env:
 *   GITHUB_TOKEN (optional, recommended) — lifts rate limit 60/h → 5000/h
 *   LIMIT                                 — cap rows to process (for testing)
 */

import "dotenv/config";
import { db } from "../import/lib/supabase";

const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
const token = process.env.GITHUB_TOKEN;

type Row = { id: string; github_url: string | null };

function parseOwnerRepo(url: string | null): { owner: string; repo: string } | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

async function fetchStars(owner: string, repo: string): Promise<number | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("x-ratelimit-reset");
    const waitMs = reset
      ? Math.max(0, parseInt(reset, 10) * 1000 - Date.now()) + 1000
      : 60_000;
    console.warn(`  ⚠ rate limited, sleeping ${Math.ceil(waitMs / 1000)}s`);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchStars(owner, repo);
  }
  if (!res.ok) {
    console.warn(`  ⚠ ${owner}/${repo}: HTTP ${res.status}`);
    return null;
  }
  const data = (await res.json()) as { stargazers_count?: number };
  return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
}

async function main() {
  const rows: Row[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from("skills")
      .select("id, github_url")
      .is("github_stars", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    if (LIMIT && rows.length >= LIMIT) {
      rows.length = LIMIT;
      break;
    }
    offset += PAGE;
  }
  console.log(`→ Found ${rows.length} skills with NULL github_stars`);

  // Group by owner/repo — many skills share one repo
  const groups = new Map<string, { key: { owner: string; repo: string }; ids: string[] }>();
  const unparsed: string[] = [];
  for (const r of rows) {
    const k = parseOwnerRepo(r.github_url);
    if (!k) {
      unparsed.push(r.id);
      continue;
    }
    const key = `${k.owner}/${k.repo}`;
    const g = groups.get(key) ?? { key: k, ids: [] };
    g.ids.push(r.id);
    groups.set(key, g);
  }
  console.log(`→ ${groups.size} unique repos to fetch (${unparsed.length} rows had no parseable URL)`);

  const starsCache = new Map<string, number | null>();
  let done = 0;
  let updated = 0;
  let missing = 0;

  for (const [key, { key: { owner, repo }, ids }] of groups) {
    done++;
    process.stdout.write(`  ↳ ${done}/${groups.size} ${key}\r`);
    const stars = await fetchStars(owner, repo);
    starsCache.set(key, stars);

    if (stars === null) {
      missing++;
      continue;
    }

    const { error: updErr } = await db
      .from("skills")
      .update({ github_stars: stars })
      .in("id", ids);
    if (updErr) {
      console.error(`\n  ✖ update ${key}: ${updErr.message}`);
      continue;
    }
    updated += ids.length;

    if (!token) await new Promise((r) => setTimeout(r, 1200));
  }

  process.stdout.write("\n");
  console.log(`✅ Done. Updated ${updated} rows across ${groups.size - missing} repos (${missing} repos unreachable/deleted)`);
}

main().catch((err) => {
  console.error("✖ Backfill failed:", err);
  process.exit(1);
});
