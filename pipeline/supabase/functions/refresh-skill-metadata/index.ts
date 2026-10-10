/** Short, resumable Supabase Edge batch for public GitHub source metadata. */
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const githubToken = Deno.env.get("SKILLER_GITHUB_TOKEN");
if (!supabaseUrl || !serviceKey || !githubToken) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SKILLER_GITHUB_TOKEN are required");
}

const maxGithubRequests = 60;
// 36 repositories per invocation leaves room for file checks and missed runs.
const maxRepos = 36;
const stopAtMs = 105_000;
class BatchPause extends Error {}
const githubHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "skiller-metadata-refresh",
  Authorization: `Bearer ${githubToken}`,
};
type RepoDue = { repo_key: string; github_url: string };
type FileDue = {
  id: string;
  github_url: string;
  default_branch: string;
  pushed_at: string | null;
};
type Source = { owner: string; repo: string; ref: string; path: string };
type GithubResult = { status: number; body: unknown };

async function database(
  path: string, method: string, body: unknown, token: string = serviceKey,
): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

function rpc(name: string, args: Record<string, unknown>, token: string = serviceKey): Promise<unknown> {
  return database(`rpc/${name}`, "POST", args, token);
}

function repository(url: string): { owner: string; repo: string } {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com" || parts.length < 2) {
    throw new Error("Invalid skill repository URL");
  }
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
}

function sourceFrom(url: string, defaultBranch: string): Source | null {
  try {
    const repo = repository(url);
    const parts = new URL(url).pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const kind = parts[2];
    if (kind !== "tree" && kind !== "blob") return null;
    const rest = parts.slice(3);
    const branchParts = defaultBranch.split("/");
    const onDefault = branchParts.every((part, index) => rest[index] === part);
    const placeholder = rest[0] === "HEAD" || rest[0] === "undefined";
    const explicitMain = rest[0] === "main" || rest[0] === "master";
    const ref = placeholder || onDefault ? defaultBranch : explicitMain ? rest[0] : "";
    const pathParts = rest.slice(placeholder || (explicitMain && !onDefault) ? 1 : branchParts.length);
    if (!ref || !pathParts.length || pathParts.some((part) => part === "." || part === "..")) return null;
    const path = kind === "tree" ? `${pathParts.join("/")}/SKILL.md` : pathParts.join("/");
    if (path.split("/").at(-1)?.toLowerCase() !== "skill.md") return null;
    return { ...repo, ref, path };
  } catch {
    return null;
  }
}

function canonicalUrl(original: string, source: Source): string {
  if (new URL(original).pathname.split("/").filter(Boolean)[3] !== "undefined") return original;
  const ref = source.ref.split("/").map(encodeURIComponent).join("/");
  const path = source.path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/blob/${ref}/${path}`;
}

function commitDate(payload: unknown): string | null {
  if (!Array.isArray(payload) || !payload.length) return null;
  const first = payload[0] as { commit?: { committer?: { date?: unknown }; author?: { date?: unknown } } };
  const value = first?.commit?.committer?.date ?? first?.commit?.author?.date;
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

async function run(callerToken: string): Promise<Record<string, number | boolean>> {
  const holder = crypto.randomUUID();
  // The RPC is granted only to service_role. PostgREST verifies the caller's
  // token before any privileged work, even if the runtime uses a different key.
  const claimed = await rpc("claim_skill_metadata_refresh", { p_holder: holder }, callerToken);
  if (claimed !== true) return { skipped: true, githubRequests: 0 };

  const started = Date.now();
  let githubRequests = 0;
  let lastGithubRequest = 0;
  let checkedRepos = 0;
  let missingRepos = 0;
  let failedRepos = 0;
  let checkedFiles = 0;
  let missingFiles = 0;
  let failedFiles = 0;
  let unresolvedFiles = 0;

  async function github(url: string): Promise<GithubResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (githubRequests >= maxGithubRequests || Date.now() - started >= stopAtMs) {
        throw new BatchPause("Batch request or time budget exhausted");
      }
      const delay = Math.max(0, 1000 - (Date.now() - lastGithubRequest));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      lastGithubRequest = Date.now();
      githubRequests++;
      let response: Response;
      try {
        response = await fetch(url, { headers: githubHeaders, signal: AbortSignal.timeout(20_000) });
      } catch (error) {
        if (attempt === 0) continue;
        throw error;
      }
      if (response.status === 404) return { status: 404, body: null };
      if (response.status === 403 || response.status === 429) {
        throw new BatchPause(`GitHub rate limited (${response.status}); batch will resume on the next invocation`);
      }
      if (!response.ok) throw new Error(`GitHub ${response.status} for public API request`);
      return { status: response.status, body: await response.json() };
    }
    throw new Error("GitHub request failed");
  }

  try {
    const repos = await rpc("skill_metadata_repos_due", { p_limit: maxRepos }) as RepoDue[];
    for (const row of repos) {
      if (Date.now() - started >= stopAtMs) break;
      try {
        const { owner, repo } = repository(row.github_url);
        const result = await github(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
        if (result.status === 404) {
          await rpc("apply_skill_repo_metadata", {
            p_repo_key: row.repo_key, p_found: false, p_stars: null,
            p_default_branch: "", p_pushed_at: null,
          });
          missingRepos++;
          continue;
        }
        const body = result.body as { default_branch?: unknown; stargazers_count?: unknown; pushed_at?: unknown };
        if (typeof body?.default_branch !== "string" || !body.default_branch
          || !Number.isInteger(body.stargazers_count) || (body.stargazers_count as number) < 0
          || (body.pushed_at !== null && (typeof body.pushed_at !== "string"
            || !Number.isFinite(Date.parse(body.pushed_at))))) {
          throw new Error(`Invalid GitHub repository metadata for ${row.repo_key}`);
        }
        await rpc("apply_skill_repo_metadata", {
          p_repo_key: row.repo_key, p_found: true, p_stars: body.stargazers_count,
          p_default_branch: body.default_branch, p_pushed_at: body.pushed_at,
        });
        checkedRepos++;
      } catch (error) {
        if (error instanceof BatchPause) break;
        failedRepos++;
        console.warn(`Repository refresh failed for ${row.repo_key}: ${error}`);
      }
    }

    const fileLimit = Math.floor((maxGithubRequests - githubRequests) / 2);
    const files = await rpc("skill_metadata_files_due", { p_limit: fileLimit }) as FileDue[];
    for (const row of files) {
      if (Date.now() - started >= stopAtMs || githubRequests + 2 > maxGithubRequests) break;
      try {
        const source = sourceFrom(row.github_url, row.default_branch);
        let updatedAt: string | null = null;
        let missing = false;
        if (source) {
          const base = `https://api.github.com/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`;
          const filePath = source.path.split("/").map(encodeURIComponent).join("/");
          const file = await github(`${base}/contents/${filePath}?ref=${encodeURIComponent(source.ref)}`);
          if (file.status === 404) {
            missing = true;
          } else {
            const info = file.body as { type?: unknown; name?: unknown };
            if (info?.type !== "file" || typeof info.name !== "string" || info.name.toLowerCase() !== "skill.md") {
              missing = true;
            } else {
              const query = new URLSearchParams({ path: source.path, sha: source.ref, per_page: "1" });
              const commits = await github(`${base}/commits?${query}`);
              updatedAt = commits.status === 404 ? null : commitDate(commits.body);
            }
          }
        } else {
          unresolvedFiles++;
        }
        const checkedUrl = source ? canonicalUrl(row.github_url, source) : row.github_url;
        await database(`skills?id=eq.${encodeURIComponent(row.id)}`, "PATCH", {
          github_url: checkedUrl,
          source_updated_at: updatedAt,
          source_checked_at: new Date().toISOString(),
          source_repo_pushed_at: row.pushed_at,
          source_url_checked: checkedUrl,
        });
        checkedFiles++;
        if (missing) missingFiles++;
      } catch (error) {
        if (error instanceof BatchPause) break;
        failedFiles++;
        console.warn(`Skill file refresh failed for ${row.id}: ${error}`);
      }
    }
    return { skipped: false, checkedRepos, missingRepos, failedRepos, checkedFiles,
      missingFiles, failedFiles, unresolvedFiles, githubRequests };
  } finally {
    await rpc("release_skill_metadata_refresh", { p_holder: holder });
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // JWT verification stays enabled at the gateway; the first RPC also checks
  // service_role against database permissions before starting the refresh.
  const callerToken = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!callerToken) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await run(callerToken);
    console.log(JSON.stringify(result));
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Refresh failed" }, { status: 500 });
  }
});
