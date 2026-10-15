import type { Skill } from "../types/skill";
import { skillDescriptionZh } from "./description-zh";

export type ShareResult = {
  title: string;
  path: string;
  imageUrl?: string;
};

/**
 * Detail page: share with skill name and Chinese description
 */
export function shareSkillDetail(skill: Skill): ShareResult {
  const chineseDesc = skillDescriptionZh(skill);
  const title = chineseDesc ? `${skill.name} - ${chineseDesc}` : skill.name;
  return {
    title,
    path: `/pages/detail/index?id=${encodeURIComponent(skill.id)}`,
  };
}

/**
 * Home page: share the mini program opening to home
 */
export function shareHome(): ShareResult {
  return {
    title: "头山 AI 工具箱 - 发现优质 AI 技能",
    path: "/pages/home/index",
  };
}

/**
 * Radar page: share the mini program opening to radar
 */
export function shareRadar(): ShareResult {
  return {
    title: "头山 AI 工具箱 - 新词雷达",
    path: "/pages/radar/index",
  };
}

/**
 * Favorites page: share the mini program opening to favorites
 */
export function shareFavorites(): ShareResult {
  return {
    title: "头山 AI 工具箱 - 我的收藏",
    path: "/pages/favorites/index",
  };
}

/**
 * Explore page: share current category or all skills
 */
export function shareExplore(categorySlug?: string, categoryName?: string): ShareResult {
  if (categorySlug && categoryName) {
    return {
      title: `头山 AI 工具箱 - ${categoryName}分类`,
      path: `/pages/explore/index?category=${encodeURIComponent(categorySlug)}`,
    };
  }
  return {
    title: "头山 AI 工具箱 - 探索技能分类",
    path: "/pages/explore/index",
  };
}

/**
 * Landing page: share the mini program opening to landing (flows to home)
 */
export function shareLanding(): ShareResult {
  return {
    title: "头山 AI 工具箱 - 发现优质 AI 技能",
    path: "/pages/landing/index",
  };
}
