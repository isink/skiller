import { db } from "./supabase";
import { collectExistingSlugs, type SlugRow } from "../../lib/existing-slugs";
import { planCuratedUpsert, parseFlag } from "../../lib/curation";

/** IMPORT_NEW_ONLY=1 makes an importer insert unseen skills and touch nothing else. */
export const importNewOnly = parseFlag("IMPORT_NEW_ONLY", process.env.IMPORT_NEW_ONLY);

export async function loadExistingSlugs(): Promise<Set<string>> {
  return collectExistingSlugs(async (after, size): Promise<SlugRow[]> => {
    let query = db.from("skills").select("id, slug").order("id").limit(size);
    if (after !== undefined) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(`load existing slugs: ${error.message}`);
    return (data ?? []) as SlugRow[];
  });
}

export type UpsertSummary = { inserted: number; updated: number };

/**
 * Upsert importer rows without clobbering curation. New slugs keep the seed
 * rank/score/featured on the row; existing slugs are written without them, so
 * sources.json overrides and manual curation survive every re-import.
 */
export async function upsertSkillsPreservingCuration<T extends { slug: string }>(
  rows: readonly T[],
  existingSlugs: Set<string>,
  options: { newOnly?: boolean; batchSize?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<UpsertSummary> {
  const plan = planCuratedUpsert(rows, existingSlugs, { newOnly: options.newOnly ?? importNewOnly });
  const batchSize = options.batchSize ?? 200;
  const total = plan.insert.length + plan.update.length;
  let done = 0;

  for (const group of [plan.insert, plan.update] as Array<Array<Record<string, unknown>>>) {
    for (let index = 0; index < group.length; index += batchSize) {
      const slice = group.slice(index, index + batchSize);
      const { error } = await db.from("skills").upsert(slice, { onConflict: "slug" });
      if (error) throw new Error(`skill upsert: ${error.message}`);
      done += slice.length;
      options.onProgress?.(done, total);
    }
  }
  for (const row of plan.insert) existingSlugs.add(row.slug);
  return { inserted: plan.insert.length, updated: plan.update.length };
}
