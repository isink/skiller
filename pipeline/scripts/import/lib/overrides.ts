import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./supabase";
import type { CuratedCategory } from "./category-map";

type Overrides = {
  featured: string[];
  ranks: Record<string, number>;
  categoryOverrides: Record<string, CuratedCategory>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_PATH = join(__dirname, "..", "sources.json");

export function loadOverrides(): Overrides {
  const raw = readFileSync(OVERRIDES_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return {
    featured: parsed.featured ?? [],
    ranks: parsed.ranks ?? {},
    categoryOverrides: parsed.categoryOverrides ?? {},
  };
}

/**
 * Apply featured flags and rank overrides from sources.json to every skill
 * currently in the catalog. Safe to run multiple times.
 */
export async function applyOverrides(): Promise<void> {
  const overrides = loadOverrides();

  // Reset all featured flags to false before re-applying.
  const { error: resetError } = await db
    .from("skills")
    .update({ featured: false })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (resetError) throw resetError;

  if (overrides.featured.length > 0) {
    const { error } = await db
      .from("skills")
      .update({ featured: true })
      .in("slug", overrides.featured);
    if (error) throw error;
  }

  for (const [slug, rank] of Object.entries(overrides.ranks)) {
    const { error } = await db
      .from("skills")
      .update({ rank })
      .eq("slug", slug);
    if (error) throw error;
  }

  for (const [slug, category] of Object.entries(overrides.categoryOverrides)) {
    const { error } = await db
      .from("skills")
      .update({ category })
      .eq("slug", slug);
    if (error) throw error;
  }

  console.log(
    `✓ Applied overrides: ${overrides.featured.length} featured, ` +
      `${Object.keys(overrides.ranks).length} ranked, ` +
      `${Object.keys(overrides.categoryOverrides).length} recategorized`,
  );
}
