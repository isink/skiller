/** 「微信小程序 SKILL」分类 slug：技能仍可收录，但不再作为分类入口展示。 */
export const MP_SKILL_CATEGORY = "mp-skill";

/** Categories shown to users; the mini program SKILL category has no entry point for now. */
export function visibleCategories<T extends { slug: string }>(categories: T[]): T[] {
  return categories.filter((category) => category.slug !== MP_SKILL_CATEGORY);
}
