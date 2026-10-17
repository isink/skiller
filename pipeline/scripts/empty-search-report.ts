/**
 * Weekly report of what mini program users searched for and did not find.
 *
 *   npm run report:empty-search                 # report only (default)
 *   npm run report:empty-search -- --import     # also import the repositories found
 *
 * Reads `search_empty` rows of public.mp_events (last 7 days by default) with
 * SUPABASE_SERVICE_ROLE_KEY, groups them by query, searches GitHub for skill
 * repositories matching each term, and prints a Markdown report. Nothing is
 * written to the database unless --import is given; imports reuse the importer
 * behind `npm run import:discover`, so rows still await `npm run enrich:skills`.
 *
 * Flags: --days N (7) --limit N (20 terms) --min-count N (1) --per-term N (2 repos)
 *        --min-stars N (3) --no-github --no-verify --import --out FILE
 * Needs GITHUB_TOKEN for a usable GitHub rate limit.
 */
import { writeFileSync } from "node:fs";
import { env } from "./import/lib/env";
import { db } from "./import/lib/supabase";
import { loadPlacements, loadExistingSlugs } from "./import/lib/upsert";
import { createDiscoveredImportDeps } from "./import/lib/discovered-deps";
import { discoverRepoSkillItems, fetchRepoTree, githubJson, sleep } from "./lib/github-api";
import { REPO_SEARCH_MIN_INTERVAL_MS, skillPathsFromTree } from "./lib/github-discovery";
import { importDiscoveredSkill } from "./lib/github-discovered-skill";
import { MP_SKILL_CATEGORY } from "./lib/mp-skill";
import {
  buildEmptySearchReport,
  catalogUrlPattern,
  formatReport,
  parseReportArgs,
  type EmptySearchEvent,
  type ReportDeps,
  type RepoLike,
} from "./lib/empty-search";

const PAGE_SIZE = 1000;

async function fetchEvents(since: Date): Promise<EmptySearchEvent[]> {
  const rows: EmptySearchEvent[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("mp_events")
      .select("query, anon_id, created_at")
      .eq("event", "search_empty")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`read mp_events: ${error.message}`);
    const page = (data ?? []) as EmptySearchEvent[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function countCatalogMatches(term: string): Promise<number> {
  const filter = ["name", "description", "description_zh", "author"].map((column) => `${column}.ilike.%${term}%`).join(",");
  const { count, error } = await db.from("skills").select("id", { count: "exact", head: true }).or(filter);
  if (error) throw new Error(`search catalog: ${error.message}`);
  return count ?? 0;
}

async function repoInCatalog(fullName: string): Promise<boolean> {
  const { count, error } = await db
    .from("skills")
    .select("id", { count: "exact", head: true })
    .ilike("github_url", catalogUrlPattern(fullName));
  if (error) throw new Error(`check catalog: ${error.message}`);
  return (count ?? 0) > 0;
}

async function main(): Promise<void> {
  const args = parseReportArgs(process.argv.slice(2));
  if (args.github && !env.githubToken) {
    console.warn("⚠ No GITHUB_TOKEN set — GitHub search is limited to a few requests per minute.");
  }

  const existingSlugs = args.importRepos ? await loadExistingSlugs() : new Set<string>();
  const importDeps = args.importRepos
    ? createDiscoveredImportDeps(existingSlugs, await loadPlacements([MP_SKILL_CATEGORY]))
    : undefined;

  const deps: ReportDeps = {
    fetchEvents,
    countCatalogMatches,
    repoInCatalog,
    async searchRepos(query) {
      const result = await githubJson<{ items?: RepoLike[] }>(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=20`,
        env.githubToken,
      );
      await sleep(REPO_SEARCH_MIN_INTERVAL_MS);
      return result?.items ?? [];
    },
    async countSkillFiles(candidate) {
      const tree = await fetchRepoTree({ full_name: candidate.fullName, default_branch: candidate.defaultBranch }, env.githubToken);
      return tree ? skillPathsFromTree(tree).length : 0;
    },
    async importRepo(candidate) {
      if (!importDeps) return 0;
      const items = await discoverRepoSkillItems({
        full_name: candidate.fullName,
        html_url: candidate.url,
        description: candidate.description,
        stargazers_count: candidate.stars,
        default_branch: candidate.defaultBranch,
      }, env.githubToken);
      let imported = 0;
      for (const item of items) {
        if (await importDiscoveredSkill(item, importDeps) === "imported") imported++;
      }
      return imported;
    },
    log: (message) => console.error(message),
  };

  const { terms, meta } = await buildEmptySearchReport(args, deps);
  const report = formatReport(terms, meta);
  if (args.out) {
    writeFileSync(args.out, report);
    console.error(`✓ Report written to ${args.out}`);
  } else {
    console.log(report);
  }
  if (args.importRepos) {
    const total = terms.reduce((sum, term) => sum + term.imported, 0);
    console.error(`✓ Imported ${total} skills. Run \`npm run enrich:skills\` to add Chinese summaries.`);
  }
}

main().catch((error) => {
  console.error("\n✖ Report failed:");
  console.error(error);
  process.exit(1);
});
