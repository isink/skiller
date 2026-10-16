/** Daily repository stars and per-SKILL.md commit dates. All progress is stored in Supabase. */
import "dotenv/config";
import { db } from "../import/lib/supabase";
import { canonicalRepositoryURL, parseGitHubRepositoryURL, renamedRepoSlug } from "../lib/github-url";
import { canonicalSkillSourceURL, fetchSkillFileDate, needsSourceCheck, resolveSkillSource } from "../lib/skill-source";
import { applyRepositoryMetadata, type RepoRefreshState } from "../lib/repo-metadata-write";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required for daily metadata refresh");

const maxRequests = Number(process.env.MAX_GITHUB_REQUESTS || 4500);
if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 10000) {
  throw new Error("MAX_GITHUB_REQUESTS must be an integer from 1 to 10000");
}

type SkillRow = {
  id: string;
  slug: string;
  github_url: string;
  source_checked_at: string | null;
  source_repo_pushed_at: string | null;
  source_url_checked: string | null;
};
type RepoGroup = { owner: string; repo: string; skills: SkillRow[] };

let requests = 0;
let lastRequestAt = 0;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "skiller-metadata-refresh",
  Authorization: `Bearer ${token}`,
};

async function github(url: string): Promise<{ status: number; body: unknown }> {
  if (requests >= maxRequests) throw new Error("GitHub request budget exhausted");
  // Stay below GitHub's secondary request-rate ceiling as well as the hourly quota.
  const delay = Math.max(0, 1000 - (Date.now() - lastRequestAt));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  lastRequestAt = Date.now();
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  requests++;
  if (response.status === 404) return { status: 404, body: null };
  if (response.status === 403 || response.status === 429) {
    throw new Error(`GitHub rate limited (${response.status}); ${response.headers.get("x-ratelimit-remaining") ?? "?"} requests remain. Completed rows are saved for the next run.`);
  }
  if (!response.ok) throw new Error(`GitHub ${response.status} for ${url}`);
  return { status: response.status, body: await response.json() };
}

async function allRows<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await db.from(table).select(columns)
      .order(table === "skills" ? "id" : "repo_key", { ascending: true })
      .range(offset, offset + size - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < size) return rows;
  }
}

/**
 * GitHub redirects a renamed repository. Move its skills to the canonical
 * owner/repo first so metadata and star snapshots are stored under one key.
 */
async function moveToCanonicalRepo(
  group: RepoGroup, key: string, fullName: string, slugs: Set<string>, groups: Map<string, RepoGroup>,
): Promise<string> {
  const canonicalKey = fullName.toLowerCase();
  console.warn(`${key} was renamed to ${fullName}; refreshing under ${fullName}`);
  const [owner, repo] = fullName.split("/");
  const target = groups.get(canonicalKey) ?? { owner, repo, skills: [] };
  for (const skill of group.skills) {
    const slug = renamedRepoSlug(skill.slug, key, canonicalKey);
    if (slug !== skill.slug && slugs.has(slug)) {
      console.warn(`  ${skill.slug}: ${slug} already exists, left under ${key}`);
      continue;
    }
    const patch = { slug, github_url: canonicalRepositoryURL(skill.github_url, fullName) };
    const { error } = await db.from("skills").update(patch).eq("id", skill.id);
    if (error) throw error;
    slugs.delete(skill.slug);
    slugs.add(slug);
    Object.assign(skill, patch);
    target.skills.push(skill);
  }
  groups.delete(key);
  groups.set(canonicalKey, target);
  return canonicalKey;
}

async function main(): Promise<void> {
  const [skills, states] = await Promise.all([
    allRows<SkillRow>("skills", "id,slug,github_url,source_checked_at,source_repo_pushed_at,source_url_checked"),
    allRows<RepoRefreshState>("github_repo_refresh_state", "repo_key,default_branch,stars,pushed_at,checked_at"),
  ]);
  const stateByRepo = new Map(states.map((state) => [state.repo_key, state]));
  const slugs = new Set(skills.map((skill) => skill.slug));
  const groups = new Map<string, RepoGroup>();
  let invalidUrls = 0;
  for (const skill of skills) {
    let repository;
    try { repository = parseGitHubRepositoryURL(skill.github_url); }
    catch { invalidUrls++; continue; }
    if (!repository) { invalidUrls++; continue; }
    const key = `${repository.owner}/${repository.repo}`.toLowerCase();
    const group = groups.get(key) ?? { ...repository, skills: [] };
    group.skills.push(skill);
    groups.set(key, group);
  }

  const today = new Date().toISOString().slice(0, 10);
  const metadata = new Map<string, RepoRefreshState>();
  let checkedRepos = 0;
  let missingRepos = 0;
  let pendingRepos = 0;
  // Leave part of each run's request budget for SKILL.md checks. Should the
  // catalog grow beyond one day's budget, oldest repo checks run first.
  const repoBudget = Math.max(1, Math.floor(maxRequests * 0.75));
  const orderedGroups = [...groups].sort(([left], [right]) => {
    const leftChecked = stateByRepo.get(left)?.checked_at ?? "";
    const rightChecked = stateByRepo.get(right)?.checked_at ?? "";
    return leftChecked.localeCompare(rightChecked) || left.localeCompare(right);
  });
  // Refresh repository stars first, including rows that already have a count.
  for (const [key, group] of orderedGroups) {
    if (metadata.has(key)) continue;
    const previous = stateByRepo.get(key);
    if (previous?.checked_at.slice(0, 10) === today) {
      metadata.set(key, previous);
      continue;
    }
    if (requests >= repoBudget) { pendingRepos++; continue; }
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(group.owner)}/${encodeURIComponent(group.repo)}`;
    const result = await github(endpoint);
    const fullName = (result.body as { full_name?: unknown } | null)?.full_name;
    const canonicalKey = typeof fullName === "string" && fullName.toLowerCase() !== key
      ? await moveToCanonicalRepo(group, key, fullName, slugs, groups)
      : key;
    const state = await applyRepositoryMetadata(db, canonicalKey, result);
    metadata.set(canonicalKey, state);
    if (result.status === 404) {
      missingRepos++;
      continue;
    }
    checkedRepos++;
    if (checkedRepos % 100 === 0) console.log(`Repository stars: ${checkedRepos}/${groups.size}; GitHub requests: ${requests}`);
  }

  let checkedFiles = 0;
  let missingFiles = 0;
  let unresolved = 0;
  let pendingFiles = 0;
  for (const [key, group] of groups) {
    const state = metadata.get(key);
    if (!state?.default_branch) continue;
    for (const skill of group.skills) {
      if (!needsSourceCheck(skill, state.pushed_at)) continue;
      if (maxRequests - requests < 2) { pendingFiles++; continue; }
      const source = resolveSkillSource(skill.github_url, state.default_branch);
      if (!source) { unresolved++; continue; }
      const { updatedAt, missing } = await fetchSkillFileDate(source, github);
      if (missing) missingFiles++;
      const canonicalUrl = canonicalSkillSourceURL(skill.github_url, source);
      const patch: Record<string, unknown> = {
        source_updated_at: updatedAt,
        source_checked_at: new Date().toISOString(),
        source_repo_pushed_at: state.pushed_at,
        source_url_checked: canonicalUrl,
      };
      if (canonicalUrl !== skill.github_url) patch.github_url = canonicalUrl;
      const { error } = await db.from("skills").update(patch).eq("id", skill.id);
      if (error) throw error;
      checkedFiles++;
      if (checkedFiles % 100 === 0) console.log(`SKILL.md dates: ${checkedFiles}; GitHub requests: ${requests}/${maxRequests}`);
    }
  }
  console.log(JSON.stringify({
    totalSkills: skills.length, repositories: groups.size, checkedRepos, missingRepos, pendingRepos,
    checkedFiles, missingFiles, unresolved, pendingFiles, invalidUrls, githubRequests: requests,
  }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
