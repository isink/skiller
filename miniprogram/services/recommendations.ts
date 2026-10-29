import { fetchFeatured, fetchHotSkills } from "./api";
import type { Skill } from "../types/skill";

export const RECOMMEND_LIMIT = 5;
const MIN_HOT = 3;

export interface Recommendations {
  title: string;
  hot: boolean;
  skills: Skill[];
}

/** Weekly hot skills; featured skills when growth data is too thin to rank. */
export async function fetchRecommendations(limit = RECOMMEND_LIMIT): Promise<Recommendations> {
  try {
    const hot = await fetchHotSkills(limit);
    if (hot.length >= MIN_HOT) return { title: "本周热门技能", hot: true, skills: hot.slice(0, limit) };
  } catch { /* Fall through to featured skills. */ }
  return { title: "精选技能", hot: false, skills: (await fetchFeatured(limit)).slice(0, limit) };
}

/** Shown under "已记录，我们会尽快收录": hot skills when there are enough, otherwise featured ones. */
export function pickEmptySearchRecommendations<T>(hot: T[], featured: T[], limit = RECOMMEND_LIMIT): { recommendTitle: string; recommended: T[] } {
  if (hot.length >= MIN_HOT) return { recommendTitle: "本周热门，先看看这些", recommended: hot.slice(0, limit) };
  return { recommendTitle: "精选技能，先看看这些", recommended: featured.slice(0, limit) };
}
