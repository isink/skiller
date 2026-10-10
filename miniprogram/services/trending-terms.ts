import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import type { TrendingTerm, TrendingTermDisplay } from "../types/trending-term";

export const TRENDING_PAGE_SIZE = 30;

type Query = Record<string, string | number | boolean | undefined>;

function request<T>(path: string, query: Query = {}): Promise<T> {
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  const url = `${SUPABASE_URL}${path}${params ? `?${params}` : ""}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: "GET",
      header: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      success(response: { statusCode: number; data: T | { message?: string } }) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
        } else {
          const body = response.data as { message?: string };
          reject(new Error(body?.message || `Supabase 请求失败 (${response.statusCode})`));
        }
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(error.errMsg || "网络请求失败"));
      },
    });
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "未知";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return "未知";
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

function formatScore(score: number | null): string {
  if (score === null || score === undefined) return "-";
  return `${Math.round(score * 100)}分`;
}

function formatHeat(heat: number | null): string {
  if (heat === null || heat === undefined) return "-";
  if (heat >= 10000) return `${(heat / 10000).toFixed(1)}万`;
  if (heat >= 1000) return `${(heat / 1000).toFixed(1)}k`;
  return String(heat);
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case "已命中": return "#4a9c6d";
    case "已转选题": return "#d97757";
    case "未命中": return "#6b6b75";
    case "待观察": return "#8a8a94";
    default: return "#6b6b75";
  }
}

function present(term: TrendingTerm): TrendingTermDisplay {
  return {
    ...term,
    displaySummary: term.summary_zh || "暂无简介",
    displayScore: formatScore(term.score),
    displayHeat: formatHeat(term.heat),
    displayDate: formatDate(term.discovered_at),
    displayStatus: term.status || "待观察",
    statusColor: getStatusColor(term.status),
  };
}

export async function fetchTrendingTerms(options: { offset?: number; limit?: number } = {}): Promise<TrendingTermDisplay[]> {
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(50, Math.max(1, options.limit ?? TRENDING_PAGE_SIZE));
  
  const rows = await request<TrendingTerm[]>("/rest/v1/trending_terms_public", {
    select: "term,summary_zh,score,heat,status,discovered_at",
    order: "discovered_at.desc.nullslast,score.desc.nullslast,term.asc",
    offset,
    limit,
  });

  return rows.map(present);
}
