import assert from "node:assert/strict";
import test from "node:test";

import { collectExistingSlugs, type SlugRow } from "../lib/existing-slugs";
import { collectKeysetPages } from "../lib/pagination";

const rows: SlugRow[] = [
  { id: "0a000000-0000-4000-8000-000000000001", slug: "ab" },
  { id: "1b000000-0000-4000-8000-000000000002", slug: "a-b" },
  { id: "2c000000-0000-4000-8000-000000000003", slug: "Zeta" },
  { id: "3d000000-0000-4000-8000-000000000004", slug: "alpha" },
  { id: "4e000000-0000-4000-8000-000000000005", slug: "anthropics-skills-pdf" },
];

// Postgres sorts text with the database collation, which is not JavaScript's
// code-unit order: it ignores case and punctuation on the first pass.
function collationKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

test("slug keyset paging breaks under a collation that disagrees with JS ordering", async () => {
  const bySlug = [...rows].sort((a, b) => collationKey(a.slug).localeCompare(collationKey(b.slug)));
  await assert.rejects(
    collectKeysetPages(
      10,
      async (after) => bySlug.filter((row) => after === undefined || collationKey(row.slug) > collationKey(after)),
      (row) => row.slug,
    ),
    /strictly ordered after its cursor/,
  );
});

test("existing slugs are paged by uuid so collation cannot break the cursor", async () => {
  const sizes: number[] = [];
  const slugs = await collectExistingSlugs(async (after, size) => {
    sizes.push(size);
    return rows.filter((row) => after === undefined || row.id > after).slice(0, size);
  }, 2);

  assert.deepEqual([...slugs].sort(), rows.map((row) => row.slug).sort());
  assert.deepEqual(sizes, [2, 2, 2]);
});

test("existing slugs reports an empty catalog", async () => {
  const slugs = await collectExistingSlugs(async () => []);
  assert.equal(slugs.size, 0);
});
