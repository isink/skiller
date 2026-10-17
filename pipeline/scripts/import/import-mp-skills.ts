/**
 * Find open-source examples of WeChat mini program SKILLs on GitHub and file
 * them under the 「微信小程序 SKILL」 topic (category `mp-skill`).
 *
 *   npm run import:mp-skills               # dry-run: list what would be imported
 *   npm run import:mp-skills -- --apply    # create the category and import
 *
 * A mini program SKILL is a directory holding SKILL.md next to mcp.json (see
 * https://developers.weixin.qq.com/miniprogram/dev/ai/integration.html). The
 * script looks at known example repositories, repository search, and (with a
 * GITHUB_TOKEN) code search for `wx.modelContext.createSkill`, then keeps only
 * SKILL.md files that sit next to an mcp.json. Known repositories also bring
 * their other SKILL.md files.
 *
 * Imported rows have no description_zh: run `npm run enrich:skills` afterwards
 * so the Chinese summary is written from the skill itself, not the README.
 *
 * Flags: --apply  --max-repos N (30)  --min-stars N (3)  --no-code-search
 * Dry-run needs no database; with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set
 * it also marks which skills are already in the catalog.
 */
import "dotenv/config";
import { fetchRepoTree, githubJson, skillItemsFromPaths, sleep, type GitHubSkillItem } from "../lib/github-api";
import { CODE_SEARCH_MIN_INTERVAL_MS, REPO_SEARCH_MIN_INTERVAL_MS } from "../lib/github-discovery";
import { deriveSlug, importDiscoveredSkill } from "../lib/github-discovered-skill";
import { toRepoCandidates, type RepoLike } from "../lib/empty-search";
import { assertNoBatchFailures } from "../lib/batch-failures";
import {
  MP_SKILL_CATEGORY,
  MP_SKILL_CATEGORY_ROW,
  MP_SKILL_CODE_QUERY,
  MP_SKILL_REPO_QUERIES,
  MP_SKILL_SEED_REPOS,
  isExcludedRepo,
  isSeedRepo,
  mpSkillPathsFromTree,
  mpSkillTags,
  parseMpImportArgs,
  selectMpSkillPaths,
} from "../lib/mp-skill";

const token = process.env.GITHUB_TOKEN ?? null;

type Repo = { full_name: string; html_url: string; description: string | null; stargazers_count: number; default_branch: string };

async function loadRepo(fullName: string): Promise<Repo | undefined> {
  const data = await githubJson<RepoLike>(`https://api.github.com/repos/${fullName.split("/").map(encodeURIComponent).join("/")}`, token);
  if (!data || typeof data.full_name !== "string" || typeof data.default_branch !== "string") return undefined;
  return {
    full_name: data.full_name,
    html_url: typeof data.html_url === "string" ? data.html_url : `https://github.com/${data.full_name}`,
    description: typeof data.description === "string" ? data.description : null,
    stargazers_count: typeof data.stargazers_count === "number" ? data.stargazers_count : 0,
    default_branch: data.default_branch,
  };
}

async function findRepos(args: ReturnType<typeof parseMpImportArgs>): Promise<Map<string, Repo>> {
  const repos = new Map<string, Repo>();
  const add = (repo: Repo) => {
    if (isExcludedRepo(repo.full_name)) return;
    if (!repos.has(repo.full_name.toLowerCase())) repos.set(repo.full_name.toLowerCase(), repo);
  };

  for (const seed of MP_SKILL_SEED_REPOS) {
    const repo = await loadRepo(seed);
    if (repo) add(repo);
    else console.warn(`  ⚠ Seed repository not found: ${seed}`);
  }

  for (const query of MP_SKILL_REPO_QUERIES) {
    const result = await githubJson<{ items?: RepoLike[] }>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(`${query} fork:false archived:false`)}&sort=stars&order=desc&per_page=30`,
      token,
    );
    await sleep(REPO_SEARCH_MIN_INTERVAL_MS);
    for (const candidate of toRepoCandidates(result?.items ?? [], args.minStars)) {
      add({ full_name: candidate.fullName, html_url: candidate.url, description: candidate.description, stargazers_count: candidate.stars, default_branch: candidate.defaultBranch });
    }
  }

  if (args.codeSearch && token) {
    try {
      const result = await githubJson<{ items?: Array<{ repository?: { full_name?: string } }> }>(
        `https://api.github.com/search/code?q=${encodeURIComponent(MP_SKILL_CODE_QUERY)}&per_page=50`,
        token,
      );
      await sleep(CODE_SEARCH_MIN_INTERVAL_MS);
      for (const name of new Set((result?.items ?? []).map((item) => item.repository?.full_name).filter((value): value is string => !!value))) {
        if (repos.has(name.toLowerCase())) continue;
        const repo = await loadRepo(name);
        if (repo && (repo.stargazers_count >= args.minStars || isSeedRepo(repo.full_name))) add(repo);
      }
    } catch (error) {
      console.warn(`  ⚠ Code search skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (args.codeSearch) {
    console.warn("  ⚠ No GITHUB_TOKEN: code search skipped (it requires authentication).");
  }
  return repos;
}

type Planned = { item: GitHubSkillItem; example: boolean };

async function main(): Promise<void> {
  const args = parseMpImportArgs(process.argv.slice(2));
  const hasDatabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (args.apply && !hasDatabase) throw new Error("--apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  console.log(`→ ${args.apply ? "Importing" : "Dry-run: looking for"} mini program SKILL examples (category ${MP_SKILL_CATEGORY})`);
  const repos = [...(await findRepos(args)).values()]
    .sort((left, right) => Number(isSeedRepo(right.full_name)) - Number(isSeedRepo(left.full_name)) || right.stargazers_count - left.stargazers_count)
    .slice(0, args.maxRepos);
  console.log(`✓ ${repos.length} candidate repositories`);

  const planned: Planned[] = [];
  for (const repo of repos) {
    const tree = await fetchRepoTree(repo, token);
    if (!tree) continue;
    const selected = selectMpSkillPaths(repo.full_name, mpSkillPathsFromTree(tree));
    if (selected.length === 0) continue;
    const items = skillItemsFromPaths(repo, selected.map((entry) => entry.path));
    items.forEach((item, index) => planned.push({ item, example: selected[index].example }));
  }

  const existing = hasDatabase ? await (await import("./lib/upsert")).loadExistingSlugs() : undefined;
  console.log(`✓ ${planned.length} SKILL.md files in ${new Set(planned.map((entry) => entry.item.repository.full_name)).size} repositories`);
  for (const { item, example } of planned) {
    const slug = deriveSlug(item.repository.full_name, item.path);
    const state = existing ? (existing.has(slug) ? "已收录" : "新增") : "未核对";
    console.log(`  ${state.padEnd(4)} ${example ? "范例" : "辅助"}  ${item.repository.full_name}/${item.path}  ★${item.repository.stargazers_count ?? 0}`);
  }

  if (!args.apply) {
    console.log("\nDry-run only; nothing was written. Re-run with --apply to import.");
    return;
  }

  const { db } = await import("./lib/supabase");
  const { loadPlacements } = await import("./lib/upsert");
  const { createDiscoveredImportDeps } = await import("./lib/discovered-deps");
  // DO NOTHING on conflict: migration 026 owns the display name.
  const { error } = await db.from("categories").upsert(MP_SKILL_CATEGORY_ROW, { onConflict: "slug", ignoreDuplicates: true });
  if (error) throw new Error(`ensure category: ${error.message}`);

  const deps = createDiscoveredImportDeps(existing ?? new Set<string>(), await loadPlacements([MP_SKILL_CATEGORY]));
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  for (const { item, example } of planned) {
    const outcome = await importDiscoveredSkill(item, deps, { category: MP_SKILL_CATEGORY, extraTags: mpSkillTags(example) });
    if (outcome === "imported") imported++;
    else if (outcome === "skipped") skipped++;
    else failed++;
  }
  console.log(`\n✅ Done. Imported ${imported} skills, skipped ${skipped}, failed ${failed}. Run \`npm run enrich:skills\` for Chinese summaries.`);
  assertNoBatchFailures("mini program skill upsert", failed);
}

main().catch((error) => {
  console.error("\n✖ Import failed:");
  console.error(error);
  process.exit(1);
});
