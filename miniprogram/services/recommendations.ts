import { fetchFeatured, fetchHotSkills } from "./api";
import type { Skill } from "../types/skill";

export const RECOMMEND_LIMIT = 5;
const MIN_HOT = 3;

export interface Recommendations {
  title: string;
  skills: Skill[];
}

/** Weekly hot skills; featured skills when growth data is too thin to rank. */
export async function fetchRecommendations(limit = RECOMMEND_LIMIT): Promise<Recommendations> {
  try {
    const hot = await fetchHotSkills(limit);
    if (hot.length >= MIN_HOT) return { title: "本周热门技能", skills: hot.slice(0, limit) };
  } catch { /* Fall through to featured skills. */ }
  return { title: "精选技能", skills: (await fetchFeatured(limit)).slice(0, limit) };
}
