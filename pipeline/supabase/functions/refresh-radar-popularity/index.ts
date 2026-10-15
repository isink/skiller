/** Bounded popularity refresh. Editorial scores and summaries are never written. */
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const githubToken = Deno.env.get("SKILLER_GITHUB_TOKEN");
if (!supabaseUrl || !serviceKey || !githubToken) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SKILLER_GITHUB_TOKEN are required");
}

type Source = { source_key: string; platform: "github" | "huggingface"; source_id: string };
type Result = { status: "ok" | "missing" | "error"; count: number | null; retryAfter?: number; limited?: boolean };
const maxSources = 40;
const workBudgetMs = 85_000; // Leave five seconds for releasing the lease.

async function rpc(name: string, args: Record<string, unknown>, token: string, timeoutMs: number): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: serviceKey!, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
  });
  if (!response.ok) throw new Error(`Popularity database request failed (${response.status})`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

function retryDelay(response: Response): number | undefined {
  const retry = response.headers.get("retry-after");
  const reset = response.headers.get("x-ratelimit-reset");
  let seconds = retry && /^\d+$/.test(retry) ? Number(retry)
    : retry ? Math.ceil((Date.parse(retry) - Date.now()) / 1000) : 0;
  if ((!Number.isFinite(seconds) || seconds <= 0) && reset && /^\d+$/.test(reset)) {
    seconds = Number(reset) - Math.floor(Date.now() / 1000);
  }
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.ceil(seconds), 2147483647) : undefined;
}

async function popularity(source: Source, timeoutMs: number): Promise<Result> {
  const parts = source.source_id.split("/");
  if (parts.length !== 2 || parts.some((part) => !/^[a-z0-9_.-]+$/i.test(part) || part === "." || part === "..")) {
    return { status: "error", count: null };
  }
  const id = parts.map(encodeURIComponent).join("/");
  const isGithub = source.platform === "github";
  if (!isGithub && source.platform !== "huggingface") return { status: "error", count: null };
  const response = await fetch(isGithub ? `https://api.github.com/repos/${id}` : `https://huggingface.co/api/models/${id}`, {
    headers: isGithub ? {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "skiller-radar-popularity",
      Authorization: `Bearer ${githubToken}`,
    } : { Accept: "application/json", "User-Agent": "skiller-radar-popularity" },
    signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
    redirect: "error", // Do not forward credentials to redirects or unrecognized hosts.
  });
  if (response.status === 404) return { status: "missing", count: null };
  if (response.status === 403 || response.status === 429) {
    return { status: "error", count: null, limited: true, retryAfter: retryDelay(response) };
  }
  if (!response.ok) return { status: "error", count: null };
  const body = await response.json() as { stargazers_count?: unknown; downloads?: unknown };
  const count = isGithub ? body.stargazers_count : body.downloads;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) return { status: "error", count: null };
  return { status: "ok", count };
}

async function run(callerToken: string): Promise<Record<string, number | boolean>> {
  const holder = crypto.randomUUID();
  const deadline = Date.now() + workBudgetMs;
  const timeLeft = () => Math.max(1, deadline - Date.now());
  // PostgREST checks the caller's role against this service_role-only RPC.
  const claimed = await rpc("claim_radar_popularity_refresh", { p_holder: holder }, callerToken, Math.min(10_000, timeLeft()));
  if (claimed !== true) return { skipped: true, requests: 0 };
  let requests = 0;
  let checked = 0;
  let missing = 0;
  let failed = 0;
  let lastRequestAt = 0;
  const blockedPlatforms = new Set<string>();
  try {
    const sources = await rpc("radar_popularity_sources_due", { p_holder: holder, p_limit: maxSources }, serviceKey!, Math.min(10_000, timeLeft())) as Source[];
    for (const source of sources.slice(0, maxSources)) {
      if (timeLeft() < 6000) break;
      if (blockedPlatforms.has(source.platform)) continue;
      const delay = Math.max(0, 1000 - (Date.now() - lastRequestAt));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (timeLeft() < 6000) break;
      requests++;
      lastRequestAt = Date.now();
      let result: Result;
      try {
        // Reserve time to persist progress even if the external request stalls.
        result = await popularity(source, Math.min(12_000, timeLeft() - 4000));
      } catch {
        result = { status: "error", count: null };
      }
      await rpc("apply_radar_popularity", {
        p_holder: holder, p_source_key: source.source_key, p_status: result.status,
        p_count: result.count, p_retry_after_seconds: result.retryAfter ?? null,
        p_platform_limited: result.limited === true,
      }, serviceKey!, Math.min(4000, timeLeft()));
      if (result.status === "ok") checked++;
      else if (result.status === "missing") missing++;
      else failed++;
      if (result.limited) blockedPlatforms.add(source.platform);
    }
    return { skipped: false, requests, checked, missing, failed };
  } finally {
    // If release fails, the short database lease expires and the next batch can resume.
    try { await rpc("release_radar_popularity_refresh", { p_holder: holder }, serviceKey!, 5000); }
    catch { console.warn("Radar lease release failed; it will expire automatically"); }
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const callerToken = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!callerToken) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await run(callerToken);
    console.log(JSON.stringify(result));
    return Response.json(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Radar refresh failed");
    return Response.json({ error: "Radar refresh failed" }, { status: 500 });
  }
});
