/**
 * Discover skills scattered across GitHub by searching for SKILL.md files.
 *
 * GitHub's code search API finds every public SKILL.md, regardless of which
 * repo it lives in. We skip repos already covered by other importers, parse
 * each file's frontmatter, and upsert into Supabase.
 *
 *   npm run import:discover
 *
 * Optional environment:
 *   IMPORT_NEW_ONLY=1       insert unseen skills only; existing rows are not
 *                           fetched or written.
 *   DISCOVER_RECENT_DAYS=N  also scan repositories pushed in the last N days
 *                           (repository search by topic), which finds new
 *                           skills that the capped, undated code search misses.
 *   DISCOVER_MAX_REPOS=N    cap on repositories scanned that way (default 150).
 *
 * Rate limits (docs.github.com/en/rest/search/search):
 *   - Code search: 10 req/min (authentication required)
 *   - Repository search: 30 req/min; every search returns at most 1,000 results
 *   - Core API (contents, trees): 60 req/hr unauthenticated / 5000 req/hr with a token
 *
 * Set GITHUB_TOKEN in .env to avoid hitting limits.
 */

import { env } from "./lib/env";
import { assertNoBatchFailures } from "../lib/batch-failures";
import { assertCompleteGitHubSearch } from "../lib/github-search";
import { boundedRetryDelayMs } from "../lib/rate-limit";
import { parseOptionalPositiveInteger } from "../lib/env-number";
import {
  CODE_SEARCH_MIN_INTERVAL_MS,
  REPO_SEARCH_MIN_INTERVAL_MS,
  recentRepoQueries,
} from "../lib/github-discovery";
import {
  discoverRepoSkillItems,
  githubHeaders,
  githubJson as githubJsonRequest,
  sleep,
  type GitHubSkillItem,
} from "../lib/github-api";
import { deriveSlug, importDiscoveredSkill } from "../lib/github-discovered-skill";
import { MP_SKILL_CATEGORY } from "../lib/mp-skill";
import { createDiscoveredImportDeps } from "./lib/discovered-deps";
import { importNewOnly, loadPlacements, loadExistingSlugs } from "./lib/upsert";

// Repos already handled by dedicated importers — skip them.
const SKIP_REPOS = new Set([
  "anthropics/skills",
  "sickn33/antigravity-awesome-skills",
]);

// GitHub Search API returns at most 1000 results (10 pages × 100).
const MAX_PAGES = 10;
const PER_PAGE = 100;

// Code search allows 10 requests/minute; pace below that instead of relying on 403 retries.
const SEARCH_DELAY_MS = CODE_SEARCH_MIN_INTERVAL_MS;
const RECENT_DAYS = parseOptionalPositiveInteger("DISCOVER_RECENT_DAYS", process.env.DISCOVER_RECENT_DAYS);
const MAX_RECENT_REPOS = parseOptionalPositiveInteger("DISCOVER_MAX_REPOS", process.env.DISCOVER_MAX_REPOS) ?? 150;
const REPO_SEARCH_PAGES = 3;

type SearchItem = GitHubSkillItem;

type SearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: SearchItem[];
};

const authHeaders = () => githubHeaders(env.githubToken);

/** Fetch one page of code search results for filename:SKILL.md */
async function searchPage(page: number, attempt = 0): Promise<SearchResponse> {
  const url =
    `https://api.github.com/search/code` +
    `?q=filename:SKILL.md+extension:md` +
    `&per_page=${PER_PAGE}&page=${page}`;
  try {
    const res = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(30000) });

    if (res.status === 403 || res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 60) * 1000;
      const delayMs = boundedRetryDelayMs(attempt, retryAfter);
      if (delayMs === undefined) {
        throw new Error(`Search API ${res.status} after ${attempt + 1} attempts`);
      }
      console.warn(`  ⚠ Rate limited — waiting ${Math.ceil(delayMs / 1000)}s`);
      await sleep(delayMs);
      return searchPage(page, attempt + 1);
    }
    if (res.status >= 500 || res.status === 408) {
      throw new Error(`Search API ${res.status} ${res.statusText}`);
    }
    if (!res.ok) {
      throw new Error(`Search API ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as SearchResponse;
  } catch (err) {
    if (attempt < 3) {
      const wait = (attempt + 1) * 10000;
      console.warn(`  ⚠ Page ${page} failed (${(err as Error).message}) — retry in ${wait / 1000}s`);
      await sleep(wait);
      return searchPage(page, attempt + 1);
    }
    throw err;
  }
}

type RepoSearchItem = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  default_branch: string;
  archived?: boolean;
};

const githubJson = <T>(url: string) => githubJsonRequest<T>(url, env.githubToken);

/** Skills in repositories pushed recently, found through topic search + git trees. */
async function discoverRecentItems(days: number, skipRepos: Set<string>): Promise<SearchItem[]> {
  const repos = new Map<string, RepoSearchItem>();
  for (const q of recentRepoQueries(days)) {
    for (let page = 1; page <= REPO_SEARCH_PAGES; page++) {
      const url =
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}` +
        `&sort=updated&order=desc&per_page=100&page=${page}`;
      const result = await githubJson<{ incomplete_results: boolean; items: RepoSearchItem[] }>(url);
      await sleep(REPO_SEARCH_MIN_INTERVAL_MS);
      if (!result) break;
      if (result.incomplete_results) console.warn(`  ⚠ Incomplete repository search for "${q}"`);
      for (const repo of result.items) {
        if (!repo.archived && !skipRepos.has(repo.full_name)) repos.set(repo.full_name, repo);
      }
      if (result.items.length < 100) break;
    }
  }

  const selected = [...repos.values()]
    .sort((left, right) => right.stargazers_count - left.stargazers_count)
    .slice(0, MAX_RECENT_REPOS);
  console.log(`✓ ${repos.size} recently active skill repos found; scanning ${selected.length}`);

  const items: SearchItem[] = [];
  for (const repo of selected) {
    items.push(...await discoverRepoSkillItems(repo, env.githubToken));
  }
  return items;
}

async function main() {
  if (!env.githubToken) {
    console.warn(
      "⚠ No GITHUB_TOKEN set — search rate limit is 10 req/min and may be hit quickly.\n" +
      "  Add GITHUB_TOKEN=... to .env for best results.\n"
    );
  }

  console.log("→ Searching GitHub for SKILL.md files...");

  // Collect all search results across pages.
  const allItems: SearchItem[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    process.stdout.write(`  ↳ page ${page}/${MAX_PAGES}...\r`);
    const result = await searchPage(page);
    assertCompleteGitHubSearch(result.incomplete_results);

    if (page === 1) {
      console.log(`\n✓ Total matches on GitHub: ${result.total_count}`);
    }

    allItems.push(...result.items);

    if (result.items.length < PER_PAGE) break;

    page++;
    if (page <= MAX_PAGES) await sleep(SEARCH_DELAY_MS);
  }

  process.stdout.write("\n");

  if (RECENT_DAYS !== undefined) {
    console.log(`→ Scanning repositories pushed in the last ${RECENT_DAYS} day(s)...`);
    const known = new Set(allItems.map((item) => item.url));
    for (const item of await discoverRecentItems(RECENT_DAYS, SKIP_REPOS)) {
      if (!known.has(item.url)) allItems.push(item);
    }
  }

  const existingSlugs = await loadExistingSlugs();
  console.log(`✓ ${existingSlugs.size} skills already in the catalog${importNewOnly ? " (new-only mode)" : ""}`);

  // Filter out known repos and, in new-only mode, skills we already have.
  const filtered = allItems.filter(
    (item) => !SKIP_REPOS.has(item.repository.full_name)
      && !(importNewOnly && existingSlugs.has(deriveSlug(item.repository.full_name, item.path)))
  );

  // Deduplicate: if a repo has multiple SKILL.md files, keep all of them
  // (each becomes a separate skill entry).
  console.log(
    `✓ ${filtered.length} SKILL.md files in ${new Set(filtered.map((i) => i.repository.full_name)).size} repos after filtering known sources`
  );

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  // Skills filed under the mini program topic keep their category and tags on re-import.
  const placements = await loadPlacements([MP_SKILL_CATEGORY]);
  const deps = createDiscoveredImportDeps(existingSlugs, placements);

  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    process.stdout.write(
      `  ↳ [${i + 1}/${filtered.length}] ${item.repository.full_name}/${item.path}\r`
    );
    const outcome = await importDiscoveredSkill(item, deps);
    if (outcome === "imported") imported++;
    else if (outcome === "skipped") skipped++;
    else failed++;
  }

  process.stdout.write("\n");
  console.log(`\n✅ Done. Imported ${imported} skills, skipped ${skipped}, failed ${failed}.`);
  assertNoBatchFailures("skill upsert", failed);
}

main().catch((err) => {
  console.error("\n✖ Import failed:");
  console.error(err);
  process.exit(1);
});
