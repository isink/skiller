import assert from "node:assert/strict";
import test from "node:test";

import {
  CODE_SEARCH_MIN_INTERVAL_MS,
  REPO_SEARCH_MIN_INTERVAL_MS,
  contentsApiUrl,
  recentRepoQueries,
  skillPathsFromTree,
  utcDateDaysAgo,
} from "../lib/github-discovery";

test("search pacing stays under the documented per-minute limits", () => {
  assert.ok(60_000 / CODE_SEARCH_MIN_INTERVAL_MS <= 10, "code search is limited to 10/min");
  assert.ok(60_000 / REPO_SEARCH_MIN_INTERVAL_MS <= 30, "repository search is limited to 30/min");
});

test("recent repository queries use a UTC pushed-date window", () => {
  const now = new Date("2026-10-11T23:30:00Z");
  assert.equal(utcDateDaysAgo(3, now), "2026-10-08");
  const queries = recentRepoQueries(3, now);
  assert.ok(queries.length >= 3);
  for (const query of queries) {
    assert.match(query, /^topic:[a-z-]+ pushed:>=2026-10-08 stars:>=3 fork:false$/);
  }
  assert.throws(() => utcDateDaysAgo(0), /1 to 90/);
  assert.throws(() => utcDateDaysAgo(91), /1 to 90/);
});

test("tree scanning keeps only SKILL.md blobs, shallowest first, capped", () => {
  const paths = skillPathsFromTree([
    { path: "skills/b/SKILL.md", type: "blob" },
    { path: "SKILL.md", type: "blob" },
    { path: "skills/a/skill.md", type: "blob" },
    { path: "skills/a", type: "tree" },
    { path: "skills/a/README.md", type: "blob" },
    { path: "node_modules/x/SKILL.md", type: "blob" },
    { path: ".github/skills/SKILL.md", type: "blob" },
    { path: ".git/SKILL.md", type: "blob" },
    { path: "template/SKILL.md", type: "blob" },
    { path: "docs/Templates/x/SKILL.md", type: "blob" },
    { path: 42, type: "blob" },
  ]);
  assert.deepEqual(paths, ["SKILL.md", ".github/skills/SKILL.md", "skills/a/skill.md", "skills/b/SKILL.md"]);
  assert.deepEqual(skillPathsFromTree([
    { path: "a/SKILL.md", type: "blob" }, { path: "b/SKILL.md", type: "blob" },
  ], 1), ["a/SKILL.md"]);
});

test("contents URLs encode repository, path and ref", () => {
  assert.equal(
    contentsApiUrl("o/r", "dir with space/SKILL.md", "feat/x"),
    "https://api.github.com/repos/o/r/contents/dir%20with%20space/SKILL.md?ref=feat%2Fx",
  );
});
