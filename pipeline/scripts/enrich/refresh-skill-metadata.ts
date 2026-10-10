/** Daily repository stars and per-SKILL.md commit dates. All progress is stored in Supabase. */
import "dotenv/config";
import { db } from "../import/lib/supabase";
import { parseGitHubRepositoryURL } from "../lib/github-url";
import { canonicalSkillSourceURL, fetchSkillFileDate, needsSourceCheck, resolveSkillSource } from "../lib/skill-source";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required for daily metadata refresh");

const maxRequests = Number(process.env.MAX_GITHUB_REQUESTS || 4500);
if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 10000) {
  throw new Error("MAX_GITHUB_REQUESTS must be an integer from 1 to 10000");
}

type SkillRow = {
  id: string;
  github_url: string;
  source_checked_at: string | null;
  source_repo_pushed_at: string | null;
  source_url_checked: string | null;
};
type RepoState = {
  repo_key: string;
  default_branch: string;
  stars: number | null;
  pushed_at: string | null;
  checked_at: string;
};
type RepoMetadata = { default_branch: string; stargazers_count: number; pushed_at: string | null };
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

async function updateSkills(ids: string[], patch: Record<string, unknown>): Promise<void> {
  for (let index = 0; index < ids.length; index += 100) {
    const { error } = await db.from("skills").update(patch).in("id", ids.slice(index, index + 100));
    if (error) throw error;
  }
}

async function main(): Promise<void> {
  const [skills, states] = await Promise.all([
    allRows<SkillRow>("skills", "id,github_url,source_checked_at,source_repo_pushed_at,source_url_checked"),
    allRows<RepoState>("github_repo_refresh_state", "repo_key,default_branch,stars,pushed_at,checked_at"),
  ]);
  const stateByRepo = new Map(states.map((state) => [state.repo_key, state]));
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
  const metadata = new Map<string, RepoState>();
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
    const previous = stateByRepo.get(key);
    if (previous?.checked_at.slice(0, 10) === today) {
      metadata.set(key, previous);
      continue;
    }
    if (requests >= repoBudget) { pendingRepos++; continue; }
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(group.owner)}/${encodeURIComponent(group.repo)}`;
    const result = await github(endpoint);
    const now = new Date().toISOString();
    if (result.status === 404) {
      await updateSkills(group.skills.map((skill) => skill.id), {
        github_stars: null,
        github_stars_checked_at: now,
        source_updated_at: null,
        source_checked_at: now,
        source_repo_pushed_at: null,
        source_url_checked: null,
      });
      const missing: RepoState = { repo_key: key, default_branch: "", stars: null, pushed_at: null, checked_at: now };
      const { error } = await db.from("github_repo_refresh_state").upsert(missing, { onConflict: "repo_key" });
      if (error) throw error;
      metadata.set(key, missing);
      missingRepos++;
      continue;
    }
    const body = result.body as Partial<RepoMetadata>;
    if (!body || typeof body.default_branch !== "string" || !body.default_branch
      || !Number.isInteger(body.stargazers_count) || (body.stargazers_count as number) < 0
      || (body.pushed_at !== null && (typeof body.pushed_at !== "string" || !Number.isFinite(Date.parse(body.pushed_at))))) {
      throw new Error(`Invalid GitHub repository metadata for ${key}`);
    }
    await updateSkills(group.skills.map((skill) => skill.id), {
      github_stars: body.stargazers_count,
      github_stars_checked_at: now,
    });
    const state: RepoState = {
      repo_key: key, default_branch: body.default_branch,
      stars: body.stargazers_count as number, pushed_at: body.pushed_at ?? null, checked_at: now,
    };
    const { error } = await db.from("github_repo_refresh_state").upsert(state, { onConflict: "repo_key" });
    if (error) throw error;
    metadata.set(key, state);
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
