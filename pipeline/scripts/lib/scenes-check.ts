import type { Scene } from "../../../miniprogram/services/scenes";

/** Human-readable problems with the scene collections; empty when everything checks out. */
export function sceneProblems(scenes: Scene[], catalog: Array<{ slug: string; description_zh: string | null }>): string[] {
  const problems: string[] = [];
  const known = new Map(catalog.map((row) => [row.slug, row]));
  const seen = new Set<string>();
  const sceneSlugs = new Set<string>();
  for (const scene of scenes) {
    if (sceneSlugs.has(scene.slug)) problems.push(`scene ${scene.slug} is listed twice`);
    sceneSlugs.add(scene.slug);
    if (scene.picks.length === 0) problems.push(`scene ${scene.slug} has no skills`);
    for (const pick of scene.picks) {
      if (seen.has(pick.slug)) problems.push(`${pick.slug} appears in more than one place`);
      seen.add(pick.slug);
      const row = known.get(pick.slug);
      if (!row) problems.push(`${scene.slug}/${pick.slug} is not in the catalog`);
      else if (!row.description_zh?.trim()) problems.push(`${scene.slug}/${pick.slug} has no Chinese summary`);
      if (pick.say.length < 1 || pick.say.length > 3) problems.push(`${scene.slug}/${pick.slug} needs one to three example requests`);
    }
  }
  return problems;
}
