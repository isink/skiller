import type { Skill } from "../types/skill";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
export const NEW_LABEL_MAX_DAYS = 30;

export type SkillFreshness = {
  displayGrowth: string;
  displayAdded: string;
  displayRepoNote: string;
};

function chinaDayIndex(timestamp: number): number {
  return Math.floor((timestamp + CHINA_OFFSET_MS) / DAY_MS);
}

function formatCount(value: number): string {
  return value >= 100000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString("en-US");
}

/** "本周 +N⭐" for repositories that gained stars; empty when there is no growth. */
export function growthLabel(skill: Pick<Skill, "stars_growth">): string {
  const growth = skill.stars_growth;
  return typeof growth === "number" && Number.isFinite(growth) && growth > 0
    ? `本周 +${formatCount(Math.floor(growth))}⭐`
    : "";
}

/** "今天收录" / "N 天前收录" by China calendar day; empty once a skill is older than 30 days. */
export function addedLabel(createdAt: string | null | undefined, now: number = Date.now()): string {
  if (!createdAt) return "";
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return "";
  const days = Math.max(0, chinaDayIndex(now) - chinaDayIndex(created));
  if (days > NEW_LABEL_MAX_DAYS) return "";
  return days === 0 ? "今天收录" : `${days} 天前收录`;
}

export function skillFreshness(
  skill: Pick<Skill, "stars_growth" | "created_at" | "repo_skill_count">,
  now: number = Date.now(),
): SkillFreshness {
  const displayGrowth = growthLabel(skill);
  const count = skill.repo_skill_count;
  return {
    displayGrowth,
    displayAdded: addedLabel(skill.created_at, now),
    displayRepoNote: displayGrowth && typeof count === "number" && count > 1 ? `同仓库 ${count} 个技能` : "",
  };
}

export function repoKeyOf(githubUrl: string | null | undefined): string | null {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/?#]+)/i.exec(githubUrl ?? "");
  return match ? match[1].toLowerCase() : null;
}

/** Keep the first `perRepo` rows of each repository, in order, up to `limit` rows. */
export function limitPerRepo<T extends { id: string; github_url: string }>(
  skills: readonly T[],
  perRepo: number,
  limit: number,
): T[] {
  const taken = new Map<string, number>();
  const result: T[] = [];
  for (const skill of skills) {
    const key = repoKeyOf(skill.github_url) ?? skill.id;
    const count = taken.get(key) ?? 0;
    if (count >= perRepo) continue;
    taken.set(key, count + 1);
    result.push(skill);
    if (result.length >= limit) break;
  }
  return result;
}
