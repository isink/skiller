import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { categoryName } from "./presentation";
import type { Category, Skill } from "../types/skill";

export const PAGE_SIZE = 30;

const LIST_COLUMNS = [
  "id", "slug", "name", "description", "description_zh", "category", "tags",
  "use_cases", "author", "github_url", "github_stars", "github_stars_checked_at",
  "source_updated_at", "source_checked_at", "rank", "score",
  "featured", "created_at", "published_at",
].join(",");

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

function listSkills(query: Query): Promise<Skill[]> {
  return request<Skill[]>("/rest/v1/skills", { select: LIST_COLUMNS, ...query });
}

export function fetchFeatured(limit = 20): Promise<Skill[]> {
  return listSkills({ featured: "eq.true", order: "rank.desc", limit });
}

const CATEGORY_ORDER = ["official", "ai", "code", "data", "devops", "security", "design", "docs", "office", "research", "misc"];

export async function fetchCategories(): Promise<Category[]> {
  const rows = await request<Category[]>("/rest/v1/categories", { select: "id,slug,name,icon" });
  return rows
    .map((category) => ({ ...category, name: categoryName(category.slug, category.name) }))
    .sort((a, b) => categoryOrder(a.slug) - categoryOrder(b.slug));
}

function categoryOrder(slug: string): number {
  const index = CATEGORY_ORDER.indexOf(slug);
  return index < 0 ? CATEGORY_ORDER.length : index;
}

export async function fetchCategoryCounts(): Promise<Record<string, number>> {
  const rows = await request<Array<{ category: string; count: number }>>("/rest/v1/rpc/get_category_counts");
  const counts: Record<string, number> = {};
  rows.forEach(({ category, count }) => { counts[category] = Number(count); });
  return counts;
}

export function fetchSkills(options: { category?: string; offset?: number; limit?: number; orderBy?: "github_stars" | "created_at" } = {}): Promise<Skill[]> {
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(50, Math.max(1, options.limit ?? PAGE_SIZE));
  return listSkills({
    ...(options.category ? { category: `eq.${options.category}` } : {}),
    order: options.orderBy === "created_at" ? "created_at.desc" : "github_stars.desc.nullslast,rank.desc",
    offset,
    limit,
  });
}

export function searchSkills(input: string): Promise<Skill[]> {
  const query = input.trim().replace(/[(),.*"%_\\]/g, " ").replace(/\s+/g, " ").slice(0, 80).trim();
  if (!query) return Promise.resolve([]);
  const filter = ["name", "description", "description_zh", "author"]
    .map((column) => `${column}.ilike.%${query}%`).join(",");
  return listSkills({ or: `(${filter})`, order: "rank.desc", limit: 50 });
}

export async function fetchSkill(id: string): Promise<Skill | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await request<Skill[]>("/rest/v1/skills", { select: "*", id: `eq.${id}`, limit: 1 });
  return rows[0] || null;
}

export async function fetchSkillsByIds(ids: string[]): Promise<Skill[]> {
  const validIds = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (!validIds.length) return [];
  const batches: Promise<Skill[]>[] = [];
  for (let index = 0; index < validIds.length; index += 50) {
    batches.push(listSkills({ id: `in.(${validIds.slice(index, index + 50).join(",")})`, limit: 50 }));
  }
  return (await Promise.all(batches)).reduce((all, rows) => all.concat(rows), [] as Skill[]);
}
