import { boundedRetryDelayMs } from "./rate-limit";
import type { OpenRadarCandidate } from "./open-radar";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function toCount(text: string | undefined): number | null {
  if (!text) return null;
  const digits = text.replace(/[,\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** 解析 trending 页面 HTML；结构缺失的条目会被跳过而不是抛错。 */
export function parseGithubTrending(html: string): OpenRadarCandidate[] {
  const candidates: OpenRadarCandidate[] = [];
  const articles = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) ?? [];
  for (const article of articles) {
    const heading = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(article)?.[1];
    const href = heading && /<a\b[^>]*\bhref="\/([^"/?#\s]+\/[^"/?#\s]+)"/i.exec(heading)?.[1];
    if (!href) continue;
    const fullName = decodeEntities(href);
    const repo = fullName.split("/")[1];

    const description = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(article)?.[1];
    const language = /itemprop="programmingLanguage"[^>]*>([\s\S]*?)</i.exec(article)?.[1];
    const total = /href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/i.exec(article)?.[1];
    const today = /([\d,]+)\s+stars?\s+today/i.exec(plainText(article))?.[1];

    candidates.push({
      source: "github_trending",
      sourceId: fullName.toLowerCase(),
      sourceUrl: `https://github.com/${fullName}`,
      fullName,
      title: repo,
      summary: description ? plainText(description) || null : null,
      language: language ? plainText(language) || null : null,
      topics: [],
      starsToday: toCount(today),
      starsTotal: toCount(total ? plainText(total) : undefined),
      votesCount: null,
    });
  }
  return candidates;
}

export type GithubTrendingOptions = {
  since?: "daily" | "weekly" | "monthly";
  language?: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
};

export function trendingUrl(since: string, language?: string): string {
  const path = language ? `/${encodeURIComponent(language.trim().toLowerCase())}` : "";
  return `https://github.com/trending${path}?since=${encodeURIComponent(since)}`;
}

export async function fetchGithubTrending(options: GithubTrendingOptions = {}): Promise<OpenRadarCandidate[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const url = trendingUrl(options.since ?? "daily", options.language);
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, {
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; skiller-open-radar)" },
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429 || res.status >= 500) {
      const delayMs = boundedRetryDelayMs(attempt, Number(res.headers.get("retry-after") ?? 5) * 1000);
      if (delayMs === undefined) throw new Error(`Trending page ${res.status} after ${attempt + 1} attempts`);
      await sleepImpl(delayMs);
      continue;
    }
    if (!res.ok) throw new Error(`Trending page ${res.status} ${res.statusText}`);
    const candidates = parseGithubTrending(await res.text());
    if (candidates.length === 0) throw new Error("Trending page parsed to zero repositories; the page layout may have changed");
    return candidates;
  }
}
