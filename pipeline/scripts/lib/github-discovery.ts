/**
 * Pure helpers for finding recently active skill repositories.
 *
 * GitHub code search cannot be filtered by date and returns at most 1,000
 * results, so a daily run needs repository search with a pushed-date window.
 * Search limits (docs.github.com/en/rest/search/search): 30 requests/minute for
 * repository search, 10 requests/minute for code search, 1,000 results per query.
 */

export const CODE_SEARCH_MIN_INTERVAL_MS = 6_500;
export const REPO_SEARCH_MIN_INTERVAL_MS = 2_500;

const DISCOVERY_TOPICS = [
  "agent-skills",
  "agent-skill",
  "claude-skills",
  "claude-code-skills",
  "anthropic-skills",
  "skill-md",
] as const;

export function utcDateDaysAgo(days: number, now: Date = new Date()): string {
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("Discovery window must be an integer from 1 to 90 days");
  }
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export function recentRepoQueries(days: number, now: Date = new Date()): string[] {
  const since = utcDateDaysAgo(days, now);
  return DISCOVERY_TOPICS.map((topic) => `topic:${topic} pushed:>=${since} fork:false`);
}

export type TreeEntry = { path?: unknown; type?: unknown };

/** SKILL.md files in a git tree, shallowest first, capped per repository. */
export function skillPathsFromTree(entries: readonly TreeEntry[], limit = 25): string[] {
  const paths = entries
    .filter((entry): entry is { path: string; type: string } =>
      entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => entry.path)
    .filter((path) => {
      const segments = path.split("/");
      return segments[segments.length - 1].toLowerCase() === "skill.md"
        && !segments.some((segment) => segment === "node_modules" || segment === ".git");
    });
  paths.sort((left, right) =>
    left.split("/").length - right.split("/").length
    || (left < right ? -1 : left > right ? 1 : 0));
  return paths.slice(0, Math.max(0, limit));
}

export function contentsApiUrl(fullName: string, path: string, ref: string): string {
  const repository = fullName.split("/").map(encodeURIComponent).join("/");
  const file = path.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${repository}/contents/${file}?ref=${encodeURIComponent(ref)}`;
}
