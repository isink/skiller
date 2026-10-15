import type { TrendingTerm } from "../types/trending-term";

const RADAR_FAVORITES_KEY = "skiller.miniprogram.radar-favorites.v1";
const MAX_RADAR_FAVORITES = 500;

export type RadarFavorite = TrendingTerm & { saved_at: string };
export type RadarFavoriteResult = {
  ok: boolean;
  isFavorite: boolean;
  favorites: RadarFavorite[];
  error?: string;
};

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Store source fields only. Display labels and the live board's popularity
// freshness are rebuilt by their own pages rather than frozen in local storage.
function snapshot(term: TrendingTerm, savedAt: string): RadarFavorite {
  return {
    term: term.term,
    summary_zh: optionalText(term.summary_zh),
    score: optionalNumber(term.score),
    heat: optionalNumber(term.heat),
    status: optionalText(term.status),
    discovered_at: optionalText(term.discovered_at),
    popularity_platform: term.popularity_platform === "github" || term.popularity_platform === "huggingface" ? term.popularity_platform : null,
    popularity_count: optionalNumber(term.popularity_count),
    popularity_checked_at: optionalText(term.popularity_checked_at),
    popularity_status: ["pending", "ok", "error", "missing"].includes(term.popularity_status || "") ? term.popularity_status : null,
    saved_at: savedAt,
  };
}

function readFavorites(): RadarFavorite[] {
  const value: unknown = wx.getStorageSync(RADAR_FAVORITES_KEY);
  if (value === undefined || value === null || value === "") return [];
  // A malformed value must not be silently overwritten by the next toggle.
  if (!Array.isArray(value)) throw new Error("Invalid radar favorites storage");
  const seen = new Set<string>();
  const favorites: RadarFavorite[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.term !== "string" || !item.term.trim()) continue;
    if (seen.has(item.term)) continue;
    seen.add(item.term);
    favorites.push(snapshot(item, typeof item.saved_at === "string" ? item.saved_at : ""));
  }
  return favorites;
}

export function getRadarFavorites(): RadarFavorite[] {
  try { return readFavorites(); }
  catch { return []; }
}

export function getRadarFavoriteNames(): string[] {
  return getRadarFavorites().map((item) => item.term);
}

function updateFavorite(term: TrendingTerm, removeOnly: boolean): RadarFavoriteResult {
  let current: RadarFavorite[];
  try { current = readFavorites(); }
  catch { return { ok: false, isFavorite: false, favorites: [], error: "收藏读取失败，请稍后重试" }; }
  const isFavorite = current.some((item) => item.term === term.term);
  if (typeof term.term !== "string" || !term.term.trim()) {
    return { ok: false, isFavorite, favorites: current, error: "新词信息不完整，暂时无法收藏" };
  }
  if (removeOnly && !isFavorite) return { ok: true, isFavorite: false, favorites: current };
  if (!isFavorite && current.length >= MAX_RADAR_FAVORITES) {
    return { ok: false, isFavorite, favorites: current, error: "最多收藏 500 个新词，请先整理收藏" };
  }
  const next = isFavorite
    ? current.filter((item) => item.term !== term.term)
    : [snapshot(term, new Date().toISOString()), ...current];
  try { wx.setStorageSync(RADAR_FAVORITES_KEY, next); }
  catch { return { ok: false, isFavorite, favorites: current, error: "收藏保存失败，请稍后重试" }; }
  return { ok: true, isFavorite: !isFavorite, favorites: next };
}

export function toggleRadarFavorite(term: TrendingTerm): RadarFavoriteResult {
  return updateFavorite(term, false);
}

export function removeRadarFavorite(term: TrendingTerm): RadarFavoriteResult {
  return updateFavorite(term, true);
}
