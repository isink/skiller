import assert from "node:assert/strict";
import test from "node:test";

import {
  addedLabel,
  growthLabel,
  limitPerRepo,
  repoKeyOf,
  skillFreshness,
} from "../../../miniprogram/services/freshness";

// 2026-10-11 20:00 UTC is 2026-10-12 04:00 in China.
const NOW = Date.parse("2026-10-11T20:00:00Z");

test("growth label shows the weekly star gain and hides non-positive values", () => {
  assert.equal(growthLabel({ stars_growth: 128 }), "本周 +128⭐");
  assert.equal(growthLabel({ stars_growth: 1234 }), "本周 +1,234⭐");
  assert.equal(growthLabel({ stars_growth: 123456 }), "本周 +12.3万⭐");
  assert.equal(growthLabel({ stars_growth: 0 }), "");
  assert.equal(growthLabel({ stars_growth: -4 }), "");
  assert.equal(growthLabel({ stars_growth: null }), "");
  assert.equal(growthLabel({}), "");
});

test("added label counts China calendar days, not 24-hour spans", () => {
  assert.equal(addedLabel("2026-10-11T17:00:00Z", NOW), "今天收录");
  assert.equal(addedLabel("2026-10-11T15:00:00Z", NOW), "1 天前收录");
  assert.equal(addedLabel("2026-10-09T10:00:00Z", NOW), "3 天前收录");
  assert.equal(addedLabel("2026-09-12T00:00:00Z", NOW), "30 天前收录");
  assert.equal(addedLabel("2026-09-11T00:00:00Z", NOW), "");
  assert.equal(addedLabel("2026-10-12T10:00:00Z", NOW), "今天收录");
  assert.equal(addedLabel("not a date", NOW), "");
  assert.equal(addedLabel(null, NOW), "");
});

test("freshness combines both labels and a repository note only for growing repos", () => {
  assert.deepEqual(
    skillFreshness({ stars_growth: 50, created_at: "2026-10-09T10:00:00Z", repo_skill_count: 12 }, NOW),
    { displayGrowth: "本周 +50⭐", displayAdded: "3 天前收录", displayRepoNote: "同仓库 12 个技能" },
  );
  assert.deepEqual(
    skillFreshness({ created_at: "2026-10-11T19:00:00Z", repo_skill_count: 12 }, NOW),
    { displayGrowth: "", displayAdded: "今天收录", displayRepoNote: "" },
  );
  assert.equal(
    skillFreshness({ stars_growth: 5, created_at: "2000-01-01T00:00:00Z", repo_skill_count: 1 }, NOW).displayRepoNote,
    "",
  );
});

test("repository keys are case-insensitive and ignore the skill path", () => {
  assert.equal(repoKeyOf("https://github.com/Owner/Repo/tree/main/a"), "owner/repo");
  assert.equal(repoKeyOf("https://github.com/owner/repo?x=1"), "owner/repo");
  assert.equal(repoKeyOf("https://example.com/owner/repo"), null);
  assert.equal(repoKeyOf(""), null);
});

test("per-repository limiting keeps order, caps each repo and the total", () => {
  const rows = [
    { id: "1", github_url: "https://github.com/a/mono/tree/main/1" },
    { id: "2", github_url: "https://github.com/A/mono/tree/main/2" },
    { id: "3", github_url: "https://github.com/a/mono/tree/main/3" },
    { id: "4", github_url: "https://github.com/b/solo/tree/main/4" },
    { id: "5", github_url: "" },
    { id: "6", github_url: "" },
    { id: "7", github_url: "https://github.com/c/last/tree/main/7" },
  ];
  assert.deepEqual(limitPerRepo(rows, 2, 10).map((row) => row.id), ["1", "2", "4", "5", "6", "7"]);
  assert.deepEqual(limitPerRepo(rows, 2, 3).map((row) => row.id), ["1", "2", "4"]);
});
