import type { Skill } from "../types/skill";

function chinaDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function skillMetadata(skill: Skill): { displayStars: string; displayUpdated: string } {
  const starsChecked = chinaDate(skill.github_stars_checked_at);
  const sourceUpdated = chinaDate(skill.source_updated_at);
  const countLabel = skill.github_stars === null || skill.github_stars === undefined
    ? "来源仓库 Star 暂无数据"
    : `来源仓库 Star ${skill.github_stars.toLocaleString()}`;
  return {
    displayStars: `${countLabel} · ${starsChecked ? `${starsChecked} 核对` : "核对时间未知"}`,
    displayUpdated: sourceUpdated ? `技能更新于 ${sourceUpdated}` : "更新时间未知",
  };
}
