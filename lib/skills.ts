import { isSupabaseConfigured, supabase } from "./supabase";
import { SAMPLE_CATEGORIES, SAMPLE_SKILLS } from "./sample-data";
import type { Category, Skill, SkillListItem } from "@/types/skill";

const SKILL_LIST_COLUMNS =
  "id, slug, name, description, description_zh, category, tags, use_cases, author, rank, score, install_count, featured";

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
  limit = 50,
): Promise<SkillListItem[]> {
  if (!isSupabaseConfigured) {
    return SAMPLE_SKILLS.filter((s) => s.category === category).slice(0, limit);
  }
  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_LIST_COLUMNS)
    .eq("category", category)
    .order("rank", { ascending: false })
    .limit(limit);
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
    .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
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

export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) {
    return SAMPLE_CATEGORIES;
  }
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, icon")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}
