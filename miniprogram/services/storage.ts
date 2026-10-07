import type { Skill } from "../types/skill";

const FAVORITES_KEY = "skiller.miniprogram.favorites.v1";
const CACHE_PREFIX = "skiller.miniprogram.cache.v1.";

export function readCache<T>(key: string): T | null {
  try { return (wx.getStorageSync(`${CACHE_PREFIX}${key}`) as T) ?? null; }
  catch { return null; }
}

export function writeCache<T>(key: string, value: T): void {
  try { wx.setStorageSync(`${CACHE_PREFIX}${key}`, value); }
  catch { /* Cache is best-effort; the network remains the source of truth. */ }
}

export function getFavoriteIds(): string[] {
  try {
    const value = wx.getStorageSync(FAVORITES_KEY);
    return Array.isArray(value) ? value.filter((id: unknown) => typeof id === "string") : [];
  } catch { return []; }
}

export function toggleFavorite(id: string): string[] {
  const current = getFavoriteIds();
  const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];
  try { wx.setStorageSync(FAVORITES_KEY, next); }
  catch { wx.showToast({ title: "收藏保存失败", icon: "none" }); }
  return next;
}

export function cachedSkill(id: string): Skill | null {
  return readCache<Skill>(`skill:${id}`);
}

export function cacheSkill(skill: Skill): void {
  const existing = cachedSkill(skill.id);
  const value = existing?.skill_md_content && !skill.skill_md_content
    ? { ...skill, skill_md_content: existing.skill_md_content }
    : skill;
  writeCache(`skill:${skill.id}`, value);
}
