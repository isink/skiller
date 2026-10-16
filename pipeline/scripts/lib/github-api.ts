import { boundedRetryDelayMs } from "./rate-limit";
import { contentsApiUrl, skillPathsFromTree, type TreeEntry } from "./github-discovery";

export type GitHubRepoSummary = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count?: number;
  default_branch?: string;
  archived?: boolean;
};

/** One SKILL.md file inside a repository, as returned by code search or a git tree. */
export type GitHubSkillItem = {
  name: string;
  path: string;
  repository: GitHubRepoSummary;
  /** Contents API URL of the file. */
  url: string;
};

export function githubHeaders(token: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "skiller-importer",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GET a GitHub API URL. 404/409 resolve to undefined; rate limits are retried a bounded number of times. */
export async function githubJson<T>(url: string, token: string | null | undefined): Promise<T | undefined> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: githubHeaders(token), signal: AbortSignal.timeout(30000) });
    if (res.status === 404 || res.status === 409) return undefined;
    if (res.status === 403 || res.status === 429) {
      const delayMs = boundedRetryDelayMs(attempt, Number(res.headers.get("retry-after") ?? 60) * 1000);
      if (delayMs === undefined) throw new Error(`GitHub ${res.status} after ${attempt + 1} attempts: ${url}`);
      console.warn(`  ⚠ Rate limited — waiting ${Math.ceil(delayMs / 1000)}s`);
      await sleep(delayMs);
      continue;
    }
    if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText}: ${url}`);
    return (await res.json()) as T;
  }
}

/** Fetch raw SKILL.md content via the contents API URL from search results. */
export async function fetchSkillMdFromContentsUrl(contentsUrl: string, token: string | null | undefined): Promise<string | undefined> {
  const res = await fetch(contentsUrl, { headers: githubHeaders(token) });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(`Contents API ${res.status} ${res.statusText}: ${contentsUrl}`);
  }
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") {
    throw new Error(`Contents API returned no base64 content: ${contentsUrl}`);
  }
  // Node's atob doesn't handle multi-line base64; strip newlines first.
  const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  return decoded.replace(/\u0000/g, "");
}

/** Recursive git tree of the default branch; undefined when the repository is empty or gone. */
export async function fetchRepoTree(
  repo: { full_name: string; default_branch: string },
  token: string | null | undefined,
): Promise<TreeEntry[] | undefined> {
  const tree = await githubJson<{ tree?: TreeEntry[]; truncated?: boolean }>(
    `https://api.github.com/repos/${repo.full_name.split("/").map(encodeURIComponent).join("/")}` +
      `/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
    token,
  );
  if (!tree?.tree) return undefined;
  if (tree.truncated) console.warn(`  ⚠ Tree truncated for ${repo.full_name}; some skills may be missed`);
  return tree.tree;
}

export function skillItemsFromPaths(
  repo: GitHubRepoSummary & { default_branch: string },
  paths: readonly string[],
): GitHubSkillItem[] {
  return paths.map((path) => ({
    name: path.split("/").pop() ?? "SKILL.md",
    path,
    repository: repo,
    url: contentsApiUrl(repo.full_name, path, repo.default_branch),
  }));
}

/** SKILL.md files of one repository (shallowest 25), found through its default-branch git tree. */
export async function discoverRepoSkillItems(
  repo: GitHubRepoSummary & { default_branch: string },
  token: string | null | undefined,
): Promise<GitHubSkillItem[]> {
  const tree = await fetchRepoTree(repo, token);
  return tree ? skillItemsFromPaths(repo, skillPathsFromTree(tree)) : [];
}
