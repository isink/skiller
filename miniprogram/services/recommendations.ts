import { fetchFeatured, fetchHotSkills, fetchSkillsBySlugs } from "./api";
import { dailyPick } from "./scenes";
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

/** The single hottest skill for the landing card; `hot` is false when it is only a featured fallback. */
export async function fetchHotTool(): Promise<{ skill: Skill; hot: boolean } | null> {
  const { hot, skills } = await fetchRecommendations();
  return skills.length > 0 ? { skill: skills[0], hot } : null;
}

/** Today's curated WorkBuddy pick for the landing card; null when that skill cannot be loaded. */
export async function fetchDailyPick(now: Date = new Date()): Promise<{ skill: Skill; sceneTitle: string } | null> {
  const { scene, pick } = dailyPick(now);
  const [skill] = await fetchSkillsBySlugs([pick.slug]);
  return skill ? { skill, sceneTitle: scene.title } : null;
}

/** Shown under "已记录，我们会尽快收录": hot skills when there are enough, otherwise featured ones. */
export function pickEmptySearchRecommendations<T>(hot: T[], featured: T[], limit = RECOMMEND_LIMIT): { recommendTitle: string; recommended: T[] } {
  if (hot.length >= MIN_HOT) return { recommendTitle: "本周热门，先看看这些", recommended: hot.slice(0, limit) };
  return { recommendTitle: "精选技能，先看看这些", recommended: featured.slice(0, limit) };
}
