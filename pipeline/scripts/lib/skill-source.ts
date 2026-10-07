import { parseGitHubRepositoryURL } from "./github-url";

export type SkillSource = { owner: string; repo: string; ref: string; path: string };
type GitHubResponse = { status: number; body: unknown };
export type GitHubReader = (url: string) => Promise<GitHubResponse>;

/** Resolve the file shown by an imported GitHub tree/blob URL. */
export function resolveSkillSource(url: string, defaultBranch: string): SkillSource | null {
  try {
    const repository = parseGitHubRepositoryURL(url);
    if (!repository || !defaultBranch) return null;
    const parts = new URL(url).pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const kind = parts[2];
    if (kind !== "tree" && kind !== "blob") return null;
    const rest = parts.slice(3);
    const branchParts = defaultBranch.split("/");
    const onDefault = branchParts.every((part, index) => rest[index] === part);
    // Older imported blob URLs contain the literal string "undefined" where
    // the branch should be. The file path is still intact, so use the
    // repository's current default branch for those records.
    // Do not guess where a non-default ref with slashes ends and its path begins.
    const placeholderRef = rest[0] === "HEAD" || rest[0] === "undefined";
    const explicitMainRef = rest[0] === "main" || rest[0] === "master";
    const ref = placeholderRef || onDefault ? defaultBranch : explicitMainRef ? rest[0] : "";
    const pathParts = rest.slice(placeholderRef || (explicitMainRef && !onDefault) ? 1 : branchParts.length);
    if (!ref || !pathParts.length || pathParts.some((part) => part === "." || part === "..")) return null;
    const path = kind === "tree" ? `${pathParts.join("/")}/SKILL.md` : pathParts.join("/");
    if (path.split("/").at(-1)?.toLowerCase() !== "skill.md") return null;
    return { ...repository, ref, path };
  } catch {
    return null;
  }
}

export function latestCommitDate(payload: unknown): string | null {
  if (!Array.isArray(payload) || !payload.length) return null;
  const first = payload[0] as { commit?: { committer?: { date?: unknown }; author?: { date?: unknown } } };
  const value = first?.commit?.committer?.date ?? first?.commit?.author?.date;
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

export function needsSourceCheck(
  skill: { github_url: string; source_url_checked: string | null; source_checked_at: string | null; source_repo_pushed_at: string | null },
  pushedAt: string | null,
): boolean {
  return !skill.source_checked_at || skill.source_url_checked !== skill.github_url
    || !skill.source_repo_pushed_at || !pushedAt
    || Date.parse(skill.source_repo_pushed_at) !== Date.parse(pushedAt);
}

export async function fetchSkillFileDate(
  source: SkillSource,
  read: GitHubReader,
): Promise<{ updatedAt: string | null; missing: boolean }> {
  const base = `https://api.github.com/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`;
  const fileUrl = `${base}/contents/${source.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(source.ref)}`;
  const file = await read(fileUrl);
  if (file.status === 404) return { updatedAt: null, missing: true };
  const info = file.body as { type?: unknown; name?: unknown };
  if (info?.type !== "file" || typeof info.name !== "string" || info.name.toLowerCase() !== "skill.md") {
    return { updatedAt: null, missing: true };
  }
  const query = new URLSearchParams({ path: source.path, sha: source.ref, per_page: "1" });
  const commits = await read(`${base}/commits?${query}`);
  return { updatedAt: commits.status === 404 ? null : latestCommitDate(commits.body), missing: false };
}
