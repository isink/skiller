import assert from "node:assert/strict";
import test from "node:test";

import { parseFlag, planCuratedUpsert, withoutCuration } from "../lib/curation";

const row = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug,
  name: slug,
  rank: 0,
  score: 0,
  featured: false,
  ...extra,
});

test("existing skills are updated without rank, score or featured", () => {
  const plan = planCuratedUpsert(
    [row("known", { description: "new text" }), row("fresh", { rank: 80, score: 95, featured: true })],
    new Set(["known"]),
  );

  assert.deepEqual(plan.update, [{ slug: "known", name: "known", description: "new text" }]);
  assert.deepEqual(plan.insert, [row("fresh", { rank: 80, score: 95, featured: true })]);
  for (const key of ["rank", "score", "featured"]) {
    assert.equal(key in plan.update[0], false);
  }
});

test("new-only mode never writes existing skills", () => {
  const plan = planCuratedUpsert([row("known"), row("fresh")], new Set(["known"]), { newOnly: true });
  assert.deepEqual(plan.update, []);
  assert.deepEqual(plan.insert.map((item) => item.slug), ["fresh"]);
});

test("duplicate slugs in one batch are written once", () => {
  const plan = planCuratedUpsert([row("same"), row("same", { name: "later" })], new Set());
  assert.equal(plan.insert.length, 1);
  assert.equal(plan.insert[0].name, "same");
});

test("rows without a slug are rejected", () => {
  assert.throws(() => planCuratedUpsert([row("")], new Set()), /no slug/);
});

test("withoutCuration leaves the input untouched", () => {
  const input = row("a");
  const output = withoutCuration(input);
  assert.equal(input.rank, 0);
  assert.deepEqual(output, { slug: "a", name: "a" });
});

test("flags accept only explicit values", () => {
  assert.equal(parseFlag("X", undefined), false);
  assert.equal(parseFlag("X", ""), false);
  assert.equal(parseFlag("X", "0"), false);
  assert.equal(parseFlag("X", "1"), true);
  assert.equal(parseFlag("X", "true"), true);
  assert.throws(() => parseFlag("X", "yes"), /X must be/);
});
