/**
 * Importers own descriptive fields (name, description, SKILL.md, repository
 * stars). Curation fields are owned by sources.json and the override RPC, so an
 * import may only seed them when a skill is first created.
 */
export const CURATION_FIELDS = ["rank", "score", "featured"] as const;

type CurationField = (typeof CURATION_FIELDS)[number];

export type CuratedUpsertPlan<T extends { slug: string }> = {
  /** Brand-new skills, written with their seed curation values. */
  insert: T[];
  /** Skills already in the catalog, written without any curation field. */
  update: Array<Omit<T, CurationField>>;
};

export function withoutCuration<T extends object>(row: T): Omit<T, CurationField> {
  const copy = { ...row } as Record<string, unknown>;
  for (const field of CURATION_FIELDS) delete copy[field];
  return copy as Omit<T, CurationField>;
}

export function parseFlag(name: string, rawValue: string | undefined): boolean {
  if (rawValue === undefined || rawValue === "" || rawValue === "0" || rawValue === "false") {
    return false;
  }
  if (rawValue === "1" || rawValue === "true") return true;
  throw new Error(`${name} must be 1, 0, true or false`);
}

export function planCuratedUpsert<T extends { slug: string }>(
  rows: readonly T[],
  existingSlugs: ReadonlySet<string>,
  options: { newOnly?: boolean } = {},
): CuratedUpsertPlan<T> {
  const seen = new Set<string>();
  const insert: T[] = [];
  const update: Array<Omit<T, CurationField>> = [];
  for (const row of rows) {
    if (!row.slug) throw new Error("Skill row has no slug");
    // A duplicate slug in one batch would make Postgres reject the upsert.
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    if (!existingSlugs.has(row.slug)) insert.push(row);
    else if (!options.newOnly) update.push(withoutCuration(row));
  }
  return { insert, update };
}
