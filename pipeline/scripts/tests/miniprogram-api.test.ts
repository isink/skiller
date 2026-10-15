/// <reference path="../../../miniprogram/types/wx.d.ts" />
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { fetchFeatured, fetchLatestSkills, fetchSkills, searchSkills } from "../../../miniprogram/services/api";
import type { Skill } from "../../../miniprogram/types/skill";

const globals = globalThis as typeof globalThis & { wx: unknown };
const rows = Array.from({ length: 95 }, (_, index) => ({
  id: String(index + 1).padStart(3, "0"),
  name: `Skill ${index + 1}`,
  github_url: `https://github.com/owner/repo-${index + 1}`,
  github_stars: 1000,
  rank: 0,
  created_at: "2026-10-12T00:00:00Z",
}) as Skill);

function mockRequests(t: TestContext): URL[] {
  const original = globals.wx;
  const requests: URL[] = [];
  t.after(() => { globals.wx = original; });
  globals.wx = {
    request(options: { url: string; success(response: { statusCode: number; data: Skill[] }): void }) {
      const url = new URL(options.url);
      requests.push(url);
      if (url.pathname.endsWith("/get_latest_skills")) {
        options.success({ statusCode: 200, data: [] });
        return;
      }
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Number(url.searchParams.get("limit") || rows.length);
      // All primary sort values tie. SQL may choose a different tie order for
      // each LIMIT/OFFSET unless the request supplies a unique final key.
      const ordered = url.searchParams.get("order")?.endsWith(",id.asc")
        ? rows
        : [...rows.slice(offset), ...rows.slice(0, offset)];
      options.success({ statusCode: 200, data: ordered.slice(offset, offset + limit) });
    },
  };
  return requests;
}

for (const orderBy of ["github_stars", "created_at"] as const) {
  test(`${orderBy} pagination visits every tied skill exactly once`, async (t) => {
    mockRequests(t);
    const pages: Skill[] = [];
    for (const offset of [0, 30, 60, 90]) {
      pages.push(...await fetchSkills({ category: "code", offset, limit: 30, orderBy }));
    }
    assert.deepEqual(pages.map((skill) => skill.id), rows.map((skill) => skill.id));
    assert.equal(new Set(pages.map((skill) => skill.id)).size, rows.length);
  });
}

test("limited featured, search and latest fallback queries have stable tie ordering", async (t) => {
  const requests = mockRequests(t);
  await fetchFeatured(6);
  await searchSkills("Skill");
  const latest = await fetchLatestSkills(10);
  assert.equal(latest.length, 10);
  assert.deepEqual(
    requests.filter((url) => url.pathname.endsWith("/skills")).map((url) => url.searchParams.get("order")),
    ["rank.desc,id.asc", "rank.desc,id.asc", "created_at.desc,id.asc"],
  );
});
