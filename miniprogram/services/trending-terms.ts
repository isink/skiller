import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { isDateKey } from "./radar-calendar";
import type { TrendingMode, TrendingSnapshot, TrendingTerm, TrendingTermDisplay } from "../types/trending-term";

export const TRENDING_PAGE_SIZE = 30;
export const TRENDING_BOARD_SIZE = 50;
const FRESHNESS_MS = 24 * 60 * 60 * 1000;
const BASE_COLUMNS = "term,summary_zh,score,heat,status,discovered_at";
const POPULARITY_COLUMNS = "popularity_platform,popularity_count,popularity_checked_at,popularity_status";

type Query = Record<string, string | number | boolean | undefined>;
type ApiError = Error & { code?: string; statusCode?: number };
export type TrendingFetchOptions = {
  mode?: TrendingMode;
  offset?: number;
  limit?: number;
  discoveredDate?: string;
};

function latestQuery(discoveredDate: string | undefined, offset: number, limit: number): Query {
  if (discoveredDate && !isDateKey(discoveredDate)) throw new Error("发现日期格式无效");
  return {
    order: "discovered_at.desc.nullslast,score.desc.nullslast,term.asc",
    // discovered_at is PostgreSQL date, so equality avoids timezone boundaries.
    discovered_at: discoveredDate ? `eq.${discoveredDate}` : undefined,
    offset,
    limit,
  };
}

function request<T>(query: Query): Promise<T> {
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${SUPABASE_URL}/rest/v1/trending_terms_public?${params}`,
      method: "GET",
      timeout: 15000,
      header: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      success(response: { statusCode: number; data: T | { message?: string; code?: string } }) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
        } else {
          const body = response.data as { message?: string; code?: string };
          const error: ApiError = new Error(body?.message || `Supabase 请求失败 (${response.statusCode})`);
          error.code = body?.code;
          error.statusCode = response.statusCode;
          reject(error);
        }
      },
      fail(error: { errMsg?: string }) { reject(new Error(error.errMsg || "网络请求失败")); },
    });
  });
}

function isMissingPopularityColumn(error: unknown): boolean {
  const value = error as ApiError;
  return /popularity_(platform|count|checked_at|status)/i.test(value?.message || "") &&
    (value.code === "42703" || value.code === "PGRST204" ||
      (value.statusCode === 400 && /column|schema cache/i.test(value.message)));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "未知";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return "未知";
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

function formatDateGroup(dateStr: string | null): string {
  const match = dateStr && /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return "发现日期未知";
  const year = Number(match[1]);
  const prefix = year === new Date().getFullYear() ? "" : `${year}年`;
  return `${prefix}${Number(match[2])}月${Number(match[3])}日发现`;
}

function formatCheckedAt(value: string | null | undefined): string {
  if (!value) return "尚未核对";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "尚未核对";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear() === new Date().getFullYear() ? "" : `${date.getFullYear()}年`;
  return `${year}${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCount(count: number | null | undefined): string {
  if (typeof count !== "number" || !Number.isFinite(count)) return "-";
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(Math.floor(count));
}

function present(term: TrendingTerm): TrendingTermDisplay {
  const summary = (term.summary_zh || "").trim().replace(/\s+/g, " ");
  const checked = Date.parse(term.popularity_checked_at || "");
  const knownPlatform = term.popularity_platform === "github" || term.popularity_platform === "huggingface";
  const hasPopularity = knownPlatform && typeof term.popularity_count === "number" &&
    Number.isFinite(term.popularity_count) && term.popularity_count >= 0 && Number.isFinite(checked) &&
    (term.popularity_status === "ok" || term.popularity_status === "error");
  return {
    ...term,
    displaySummary: summary || "简介待补充",
    displayScore: typeof term.score === "number" && Number.isFinite(term.score) ? `${Math.round(term.score * 100)}分` : "-",
    displayHeat: formatCount(term.heat),
    displayDate: formatDate(term.discovered_at),
    displayDateGroup: formatDateGroup(term.discovered_at),
    displayStatus: term.status || "待观察",
    hasSummary: summary.length > 0,
    hasScore: typeof term.score === "number" && Number.isFinite(term.score),
    hasHeat: typeof term.heat === "number" && Number.isFinite(term.heat),
    displayPopularity: formatCount(term.popularity_count),
    displayPopularityLabel: term.popularity_platform === "github" ? "GitHub Star" : "HF 近30日下载",
    displayPopularityCheckedAt: formatCheckedAt(term.popularity_checked_at),
    hasPopularity,
    popularityNeedsRetry: term.popularity_status === "error",
    popularityIsStale: !Number.isFinite(checked) || checked < Date.now() - FRESHNESS_MS,
  };
}

export async function fetchTrendingSnapshot(options: TrendingFetchOptions = {}): Promise<TrendingSnapshot> {
  let mode = options.mode || "latest";
  const offset = mode === "latest" ? Math.max(0, options.offset ?? 0) : 0;
  const limit = Math.min(50, Math.max(1, options.limit ?? TRENDING_PAGE_SIZE));
  let boardAvailable = true;
  let rows: TrendingTerm[];
  try {
    rows = await request<TrendingTerm[]>({
      select: `${BASE_COLUMNS},${POPULARITY_COLUMNS}`,
      ...(mode === "latest" ? latestQuery(options.discoveredDate, offset, limit) : {
        popularity_platform: `eq.${mode}`,
        popularity_count: "gte.0",
        popularity_status: "in.(ok,error)",
        popularity_checked_at: `gte.${new Date(Date.now() - FRESHNESS_MS).toISOString()}`,
        order: "popularity_count.desc,term.asc",
        limit: TRENDING_BOARD_SIZE,
      }),
    });
  } catch (error) {
    if (!isMissingPopularityColumn(error)) throw error;
    boardAvailable = false;
    mode = "latest";
    rows = await request<TrendingTerm[]>({ select: BASE_COLUMNS, ...latestQuery(options.discoveredDate, offset, limit) });
  }
  let terms = rows.map(present);
  if (mode !== "latest") {
    terms = terms.filter((term) => term.hasPopularity && !term.popularityIsStale && term.popularity_platform === mode);
  }
  const seen = new Set<string>();
  terms = terms.filter((term) => {
    if (seen.has(term.term)) return false;
    seen.add(term.term);
    return true;
  });
  const checkedDates = terms.map((term) => Date.parse(term.popularity_checked_at || "")).filter(Number.isFinite);
  return {
    terms,
    mode,
    boardAvailable,
    hasMore: mode === "latest" && rows.length >= limit,
    nextOffset: offset + rows.length,
    displayCheckedAt: checkedDates.length ? formatCheckedAt(new Date(Math.max(...checkedDates)).toISOString()) : "",
  };
}

/** Compatibility helper for callers that only need the latest-discovered list. */
export async function fetchTrendingTerms(options: Omit<TrendingFetchOptions, "mode"> = {}): Promise<TrendingTermDisplay[]> {
  return (await fetchTrendingSnapshot({ ...options, mode: "latest" })).terms;
}
