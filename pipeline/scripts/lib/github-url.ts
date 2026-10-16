import { toSlug } from "../import/lib/slugify";

export type GitHubRepository = { owner: string; repo: string };

export function parseGitHubRepositoryURL(
  value: string | null,
): GitHubRepository | undefined {
  if (value === null || !value.trim()) return undefined;

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:"
      || url.hostname.toLowerCase() !== "github.com"
      || segments.length < 2) {
      throw new Error();
    }
    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/, "");
    if (!owner || !repo) throw new Error();
    return { owner, repo };
  } catch {
    throw new Error(`Invalid GitHub repository URL: ${value}`);
  }
}

/** Point a stored GitHub URL at the repository's canonical owner/repo, keeping the rest verbatim. */
export function canonicalRepositoryURL(url: string, canonicalFullName: string): string {
  return url.replace(/^(https:\/\/github\.com\/)[^/?#]+\/[^/?#]+/i, (_, host: string) => host + canonicalFullName);
}

/**
 * Importer slugs start with the slugified owner/repo (`owner-repo-path`).
 * Rename that prefix after a repository rename; other slugs stay untouched.
 */
export function renamedRepoSlug(slug: string, fromFullName: string, toFullName: string): string {
  const prefix = `${toSlug(fromFullName)}-`;
  return slug.startsWith(prefix) ? `${toSlug(toFullName)}-${slug.slice(prefix.length)}`.slice(0, 80) : slug;
}
