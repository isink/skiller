export type RepoRefreshState = {
  repo_key: string;
  default_branch: string;
  stars: number | null;
  pushed_at: string | null;
  checked_at: string;
};

type RepoMetadata = {
  default_branch: string;
  stargazers_count: number;
  pushed_at: string | null;
};

type RepoMetadataArgs = {
  p_repo_key: string;
  p_found: boolean;
  p_stars: number | null;
  p_default_branch: string;
  p_pushed_at: string | null;
};

type RepoMetadataClient = {
  rpc(
    name: "apply_skill_repo_metadata",
    args: RepoMetadataArgs,
  ): PromiseLike<{ error: { message: string } | null }>;
};

/**
 * Use the same transaction as the scheduled Edge refresh: skills, repository
 * progress and the UTC day's star snapshot succeed or fail together. Only an
 * explicit GitHub 404 denotes a missing repository; a malformed 200 does not.
 */
export async function applyRepositoryMetadata(
  client: RepoMetadataClient,
  repoKey: string,
  result: { status: number; body: unknown },
): Promise<RepoRefreshState> {
  if (result.status !== 200 && result.status !== 404) {
    throw new Error(`Unexpected GitHub repository status ${result.status} for ${repoKey}`);
  }
  const found = result.status === 200;
  const body = (found ? result.body : null) as Partial<RepoMetadata> | null;
  if (found && (!body || typeof body.default_branch !== "string" || !body.default_branch
    || !Number.isInteger(body.stargazers_count) || (body.stargazers_count as number) < 0
    || (body.pushed_at !== null && (typeof body.pushed_at !== "string"
      || !Number.isFinite(Date.parse(body.pushed_at)))))) {
    throw new Error(`Invalid GitHub repository metadata for ${repoKey}`);
  }

  const args: RepoMetadataArgs = {
    p_repo_key: repoKey,
    p_found: found,
    p_stars: body?.stargazers_count ?? null,
    p_default_branch: body?.default_branch ?? "",
    p_pushed_at: body?.pushed_at ?? null,
  };
  const { error } = await client.rpc("apply_skill_repo_metadata", args);
  if (error) throw new Error(`apply repository metadata: ${error.message}`);

  // Publish in-memory progress only after the database transaction committed.
  // The persisted checked_at and snapshot date are assigned by PostgreSQL.
  return {
    repo_key: repoKey,
    default_branch: args.p_default_branch,
    stars: args.p_stars,
    pushed_at: args.p_pushed_at,
    checked_at: new Date().toISOString(),
  };
}
