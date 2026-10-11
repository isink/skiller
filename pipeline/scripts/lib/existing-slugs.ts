import { collectKeysetPages } from "./pagination";

export type SlugRow = { id: string; slug: string };

/**
 * Collect every existing skill slug.
 *
 * Pages are keyed by the uuid primary key, not by slug. Postgres orders text
 * with the database collation (for example en_US.UTF-8, which ignores
 * punctuation and case on the first pass), while the keyset guard compares keys
 * with JavaScript's code-unit order. The two disagree for slugs such as
 * "a-b" vs "ab", which made the strict-ordering guard throw. uuid values sort
 * identically in Postgres and as lowercase hex strings.
 */
export async function collectExistingSlugs(
  fetchPage: (after: string | undefined, size: number) => Promise<SlugRow[]>,
  pageSize = 1_000,
): Promise<Set<string>> {
  const rows = await collectKeysetPages(pageSize, fetchPage, (row) => row.id);
  return new Set(rows.map((row) => row.slug));
}
