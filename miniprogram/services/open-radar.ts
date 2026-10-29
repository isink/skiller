import { REQUEST_TIMEOUT_MS, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** One open-source radar entry; optional content fields stay empty until an editor fills them. */
export interface OpenRadarItem {
  id: string;
  titleZh: string;
  summary: string;
  pitfalls: string[];
  installCommand: string;
  articleUrl: string;
  packageUrl: string;
}

export type OpenRadarSummary = Pick<OpenRadarItem, "id" | "titleZh" | "summary">;

export const OPEN_RADAR_TITLE = "开源雷达";
export const OPEN_RADAR_LIST_LIMIT = 50;

/** Row of the public `open_radar_published` view: published entries only, no source fields. */
interface PublishedRow {
  id?: unknown;
  title_zh?: unknown;
  summary?: unknown;
  pitfalls?: unknown;
  install_command?: unknown;
  article_url?: unknown;
  package_url?: unknown;
}

type ApiError = Error & { code?: string; statusCode?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_COLUMNS = "id,title_zh,summary";
const DETAIL_COLUMNS = "id,title_zh,summary,pitfalls,install_command,article_url,package_url";

function request(query: Record<string, string | number>): Promise<unknown> {
  const params = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${SUPABASE_URL}/rest/v1/open_radar_published?${params}`,
      method: "GET",
      timeout: REQUEST_TIMEOUT_MS,
      header: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      success(response: { statusCode: number; data: unknown }) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
          return;
        }
        const body = (response.data ?? {}) as { message?: string; code?: string };
        const error: ApiError = new Error(body.message || `请求失败 (${response.statusCode})`);
        error.code = body.code;
        error.statusCode = response.statusCode;
        reject(error);
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(error.errMsg || "网络请求失败"));
      },
    });
  });
}

/** The view is created by a database migration; before it exists the radar simply has no entries. */
function isViewMissing(error: unknown): boolean {
  const value = error as ApiError;
  return value?.code === "PGRST205" || value?.code === "42P01" || value?.statusCode === 404;
}

async function fetchRows(query: Record<string, string | number>): Promise<PublishedRow[]> {
  try {
    const data = await request(query);
    return Array.isArray(data) ? (data as PublishedRow[]) : [];
  } catch (error) {
    if (isViewMissing(error)) return [];
    throw error;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toItem(row: PublishedRow | null): OpenRadarItem | null {
  if (!row || typeof row !== "object") return null;
  const id = text(row.id);
  const titleZh = text(row.title_zh);
  if (!UUID.test(id) || !titleZh) return null;
  return {
    id,
    titleZh,
    summary: text(row.summary),
    pitfalls: Array.isArray(row.pitfalls) ? row.pitfalls.map(text).filter(Boolean) : [],
    installCommand: text(row.install_command),
    articleUrl: text(row.article_url),
    packageUrl: text(row.package_url),
  };
}

/** Published entries, newest first. Empty until an editor publishes the first draft. */
export async function fetchOpenRadarList(): Promise<OpenRadarSummary[]> {
  const rows = await fetchRows({ select: LIST_COLUMNS, order: "published_at.desc.nullslast,id.asc", limit: OPEN_RADAR_LIST_LIMIT });
  const items: OpenRadarSummary[] = [];
  for (const row of rows) {
    const item = toItem(row);
    if (item) items.push({ id: item.id, titleZh: item.titleZh, summary: item.summary });
  }
  return items;
}

export async function fetchOpenRadarItem(id: string): Promise<OpenRadarItem | null> {
  if (!UUID.test(id)) return null;
  const rows = await fetchRows({ select: DETAIL_COLUMNS, id: `eq.${id}`, limit: 1 });
  return rows.length ? toItem(rows[0]) : null;
}

export function openRadarDetailUrl(id: string): string {
  return `/pages/open-radar-detail/index?id=${encodeURIComponent(id)}`;
}
