export type GitHubRepoMetadata = {
  defaultBranch: string;
  stars: number;
  starsCheckedAt: string;
};

/**
 * Code-search repository objects omit fields such as stargazers_count. Resolve
 * both the branch and stars from the repository API once per import instead.
 * Failed lookups are also shared so many files in one repository do not each
 * repeat the same exhausted request retries.
 */
export function createGitHubRepoMetadataResolver(
  loadRepository: (fullName: string) => Promise<unknown>,
  now: () => Date = () => new Date(),
): (fullName: string) => Promise<GitHubRepoMetadata> {
  const repositories = new Map<string, Promise<GitHubRepoMetadata>>();

  return (fullName) => {
    const key = fullName.toLowerCase();
    const cached = repositories.get(key);
    if (cached) return cached;

    const pending = (async () => {
      const response = await loadRepository(fullName);
      const data = response as { default_branch?: unknown; stargazers_count?: unknown } | undefined;
      if (typeof data?.default_branch !== "string" || !data.default_branch.trim()) {
        throw new Error(`Repository API returned no default branch: ${fullName}`);
      }
      const stars = data.stargazers_count;
      if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 0) {
        throw new Error(`Repository API returned no valid star count: ${fullName}`);
      }
      return {
        defaultBranch: data.default_branch,
        stars,
        starsCheckedAt: now().toISOString(),
      };
    })();
    repositories.set(key, pending);
    return pending;
  };
}

export function checkedRepoStarsPatch(metadata: GitHubRepoMetadata): {
  github_stars: number;
  github_stars_checked_at: string;
} {
  return {
    github_stars: metadata.stars,
    github_stars_checked_at: metadata.starsCheckedAt,
  };
}
