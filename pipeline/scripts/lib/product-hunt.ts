import type { OpenRadarCandidate } from "./open-radar";

export const PRODUCT_HUNT_API = "https://api.producthunt.com/v2/api/graphql";

export const POSTS_QUERY = `query OpenRadarPosts($after: DateTime!, $first: Int!) {
  posts(order: VOTES, postedAfter: $after, first: $first) {
    edges {
      node {
        id
        name
        tagline
        slug
        url
        votesCount
        createdAt
        topics(first: 6) { edges { node { name } } }
      }
    }
  }
}`;

type PostNode = {
  id?: unknown;
  name?: unknown;
  tagline?: unknown;
  slug?: unknown;
  url?: unknown;
  votesCount?: unknown;
  topics?: { edges?: Array<{ node?: { name?: unknown } }> };
};

const text = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

function pageUrl(node: PostNode): string {
  const slug = text(node.slug);
  if (slug) return `https://www.producthunt.com/posts/${encodeURIComponent(slug)}`;
  const raw = text(node.url);
  try {
    const url = new URL(raw);
    return url.hostname.endsWith("producthunt.com") ? `${url.origin}${url.pathname}` : "";
  } catch {
    return "";
  }
}

/** 解析 GraphQL 响应；错误响应抛错，缺字段的帖子被跳过。 */
export function parseProductHuntResponse(body: unknown): OpenRadarCandidate[] {
  const response = body as { errors?: Array<{ message?: string }>; data?: { posts?: { edges?: Array<{ node?: PostNode }> } } };
  if (response?.errors?.length) {
    throw new Error(`Product Hunt API error: ${response.errors.map((e) => e.message ?? "unknown").join("; ")}`);
  }
  const edges = response?.data?.posts?.edges;
  if (!Array.isArray(edges)) throw new Error("Product Hunt API returned no posts");

  const candidates: OpenRadarCandidate[] = [];
  for (const edge of edges) {
    const node = edge?.node;
    if (!node) continue;
    const id = text(node.id);
    const name = text(node.name);
    const sourceUrl = pageUrl(node);
    if (!id || !name || !sourceUrl) continue;
    const votes = typeof node.votesCount === "number" && Number.isFinite(node.votesCount) ? Math.max(0, Math.floor(node.votesCount)) : null;
    candidates.push({
      source: "product_hunt",
      sourceId: id,
      sourceUrl,
      fullName: null,
      title: name,
      summary: text(node.tagline) || null,
      language: null,
      topics: (node.topics?.edges ?? []).map((topic) => text(topic?.node?.name)).filter(Boolean),
      starsToday: null,
      starsTotal: null,
      votesCount: votes,
    });
  }
  return candidates;
}

export type ProductHuntOptions = {
  token: string;
  windowHours?: number;
  first?: number;
  now?: Date;
  fetchImpl?: typeof fetch;
};

export async function fetchProductHuntPosts(options: ProductHuntOptions): Promise<OpenRadarCandidate[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const after = new Date(now.getTime() - (options.windowHours ?? 48) * 3_600_000).toISOString();
  const res = await fetchImpl(PRODUCT_HUNT_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${options.token}`,
      "User-Agent": "skiller-open-radar",
    },
    body: JSON.stringify({ query: POSTS_QUERY, variables: { after, first: Math.min(100, Math.max(1, options.first ?? 50)) } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Product Hunt API ${res.status} ${res.statusText}`);
  return parseProductHuntResponse(await res.json());
}
