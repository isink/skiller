/**
 * Checks the WorkBuddy scene collections (miniprogram/services/scenes.ts):
 * every scene has skills, every slug exists in the catalog
 * with a Chinese summary and appears once, and every skill has a short
 * headline and one to three example requests, and each scene is sorted by
 * GitHub stars (high to low), the order the scene page lists them in.
 *
 *   npm run check:scenes
 *
 * Reads the public catalog with the mini program's anon key; exits 1 on any problem.
 */
import "dotenv/config";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../miniprogram/services/config";
import { SCENES } from "../../miniprogram/services/scenes";
import { sceneProblems } from "./lib/scenes-check";

async function main(): Promise<void> {
  const slugs = SCENES.flatMap((scene) => scene.picks.map((pick) => pick.slug));
  const url = `${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/skills?select=slug,description_zh,github_stars&slug=in.(${slugs.join(",")})`;
  const key = process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  const rows = (await response.json()) as Array<{ slug: string; description_zh: string | null; github_stars: number | null }>;
  const problems = sceneProblems(SCENES, rows);
  for (const problem of problems) console.error(`✖ ${problem}`);
  console.log(`${SCENES.length} scenes, ${slugs.length} skills, ${problems.length} problem(s).`);
  if (problems.length) process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
