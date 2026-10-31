import { MUST_COUNT, scenePicks, type Scene } from "../../../miniprogram/services/scenes";

const MAX_HEADLINE = 20;
const MAX_NAME = 10;
const MAX_INTRO = 60;
const MAX_PREPARE = 20;
const within = (text: string | undefined, max: number) => Boolean(text?.trim()) && Array.from(text as string).length <= max;

/** Human-readable problems with the scene collections; empty when everything checks out. */
export function sceneProblems(scenes: Scene[], catalog: Array<{ slug: string; description_zh: string | null; github_stars?: number | null }>): string[] {
  const problems: string[] = [];
  const known = new Map(catalog.map((row) => [row.slug, row]));
  const seen = new Set<string>();
  const sceneSlugs = new Set<string>();
  for (const scene of scenes) {
    if (sceneSlugs.has(scene.slug)) problems.push(`scene ${scene.slug} is listed twice`);
    sceneSlugs.add(scene.slug);
    if (scene.must.length !== MUST_COUNT) problems.push(`scene ${scene.slug} needs exactly ${MUST_COUNT} must-have skills`);
    for (const pick of scene.must) {
      if (!within(pick.nameZh, MAX_NAME)) problems.push(`${scene.slug}/${pick.slug} needs a Chinese name of 1-${MAX_NAME} characters`);
      if (!within(pick.intro, MAX_INTRO)) problems.push(`${scene.slug}/${pick.slug} needs an intro of 1-${MAX_INTRO} characters`);
      if (!within(pick.prepare, MAX_PREPARE)) problems.push(`${scene.slug}/${pick.slug} needs a prepare line of 1-${MAX_PREPARE} characters`);
    }
    for (const pick of scenePicks(scene)) {
      if (seen.has(pick.slug)) problems.push(`${pick.slug} appears in more than one place`);
      seen.add(pick.slug);
      const row = known.get(pick.slug);
      if (!row) problems.push(`${scene.slug}/${pick.slug} is not in the catalog`);
      else if (!row.description_zh?.trim()) problems.push(`${scene.slug}/${pick.slug} has no Chinese summary`);
      if (!pick.headline.trim() || Array.from(pick.headline).length > MAX_HEADLINE) problems.push(`${scene.slug}/${pick.slug} needs a headline of 1-${MAX_HEADLINE} characters`);
      if (pick.say.length < 1 || pick.say.length > 3) problems.push(`${scene.slug}/${pick.slug} needs one to three example requests`);
      if (pick.example && (!pick.example.input.trim() || !pick.example.output.trim())) problems.push(`${scene.slug}/${pick.slug} has an incomplete example`);
    }
    // Must-haves first, then more, both by stars high to low; ties keep the listed order.
    const stars = (slug: string) => known.get(slug)?.github_stars ?? 0;
    const ordered = scenePicks(scene);
    for (let index = 1; index < ordered.length; index++) {
      const [above, below] = [ordered[index - 1].slug, ordered[index].slug];
      if (stars(below) > stars(above)) problems.push(`scene ${scene.slug} is not sorted by stars: ${below} (${stars(below)}) should come before ${above} (${stars(above)})`);
    }
  }
  return problems;
}
