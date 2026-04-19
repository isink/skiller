import { isSupabaseConfigured, supabase } from "./supabase";
import { SAMPLE_CATEGORIES, SAMPLE_SKILLS } from "./sample-data";
import type { Category, Skill, SkillListItem } from "@/types/skill";

const SKILL_LIST_COLUMNS =
  "id, slug, name, description, description_zh, category, tags, use_cases, author, github_stars, rank, score, featured, created_at, published_at";

export async function fetchCategoryCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured) {
    const counts: Record<string, number> = {};
    for (const s of SAMPLE_SKILLS) counts[s.category] = (counts[s.category] ?? 0) + 1;
    return counts;
  }
  const { data, error } = await supabase.rpc("get_category_counts");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { category: string; count: number }[]) {
    counts[row.category] = Number(row.count);
  }
  return counts;
}

export async function fetchOfficialSkills(offset = 0, limit = 50): Promise<SkillListItem[]> {
  if (!isSupabaseConfigured) {
    return SAMPLE_SKILLS.filter((s) => s.featured).slice(offset, offset + limit);
  }
  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_LIST_COLUMNS)
    .eq("featured", true)
    .order("rank", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as SkillListItem[];
}

export async function fetchAllSkills(offset = 0, limit = 50): Promise<SkillListItem[]> {
  if (!isSupabaseConfigured) return SAMPLE_SKILLS.slice(offset, offset + limit);
  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_LIST_COLUMNS)
    .order("rank", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as SkillListItem[];
}

export async function fetchNewSkills(limit = 10): Promise<SkillListItem[]> {
  if (!isSupabaseConfigured) {
    return SAMPLE_SKILLS.slice(0, limit);
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_LIST_COLUMNS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SkillListItem[];
}

export async function fetchFeaturedSkills(
  limit = 20,
): Promise<SkillListItem[]> {
  if (!isSupabaseConfigured) {
    return SAMPLE_SKILLS.filter((s) => s.featured).slice(0, limit);
  }
  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_LIST_COLUMNS)
    .eq("featured", true)
    .order("rank", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SkillListItem[];
}

export async function fetchSkillsByCategory(
  category: string,
  offset = 0,
  limit = 50,
): Promise<SkillListItem[]> {
  if (!isSupabaseConfigured) {
    return SAMPLE_SKILLS.filter((s) => s.category === category).slice(offset, offset + limit);
  }
  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_LIST_COLUMNS)
    .eq("category", category)
    .order("rank", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as SkillListItem[];
}

export async function searchSkills(query: string): Promise<SkillListItem[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (!isSupabaseConfigured) {
    return SAMPLE_SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_LIST_COLUMNS)
    .or(`name.ilike.%${q}%,description.ilike.%${q}%,description_zh.ilike.%${q}%,author.ilike.%${q}%`)
    .order("rank", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as SkillListItem[];
}

export async function fetchSkillById(id: string): Promise<Skill | null> {
  if (!isSupabaseConfigured) {
    return SAMPLE_SKILLS.find((s) => s.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Skill | null;
}

export type HomeStats = {
  total: number;
  newToday: number;
  lastSyncAt: string | null;
};

export async function fetchHomeStats(): Promise<HomeStats> {
  if (!isSupabaseConfigured) {
    return { total: SAMPLE_SKILLS.length, newToday: 0, lastSyncAt: null };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: total }, { count: newToday }, lastRow] = await Promise.all([
    supabase.from("skills").select("*", { count: "exact", head: true }),
    supabase
      .from("skills")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString()),
    supabase
      .from("skills")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    total: total ?? 0,
    newToday: newToday ?? 0,
    lastSyncAt: lastRow.data?.created_at ?? null,
  };
}

export async function fetchHotSkills(limit = 20): Promise<SkillListItem[]> {
  if (!isSupabaseConfigured) {
    return [...SAMPLE_SKILLS].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0)).slice(0, limit);
  }
  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_LIST_COLUMNS)
    .order("github_stars", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SkillListItem[];
}

export async function fetchNewCountsByCategory(
  since: string,
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured) return {};
  // Use server-side RPC when available, fall back to a lightweight select
  const { data, error } = await supabase.rpc("get_new_counts_by_category", { since });
  if (!error && data) {
    const counts: Record<string, number> = {};
    for (const row of data as { category: string; count: number }[]) {
      counts[row.category] = Number(row.count);
    }
    return counts;
  }
  // Fallback: fetch only the category column (lightweight)
  const { data: rows } = await supabase
    .from("skills")
    .select("category")
    .gt("created_at", since)
    .limit(2000);
  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return counts;
}

export async function incrementInstallCount(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  // Try RPC first (atomic increment); fall back to read-modify-write
  const { error } = await supabase.rpc("increment_install_count", { skill_id: id });
  if (error) {
    const { data } = await supabase.from("skills").select("install_count").eq("id", id).maybeSingle();
    if (data) {
      await supabase.from("skills").update({ install_count: (data.install_count ?? 0) + 1 }).eq("id", id);
    }
  }
}

const CATEGORY_ORDER = [
  "official", "ai", "code", "data", "devops", "security",
  "design", "docs", "office", "research", "misc",
];

export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) {
    return SAMPLE_CATEGORIES;
  }
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, icon");
  if (error) throw error;
  const rows = (data ?? []) as Category[];
  return rows.sort(
    (a, b) =>
      (CATEGORY_ORDER.indexOf(a.slug) + 1 || 999) -
      (CATEGORY_ORDER.indexOf(b.slug) + 1 || 999),
  );
}
