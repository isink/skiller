import assert from "node:assert/strict";
import { test } from "node:test";
import { skillMetadata } from "../../../miniprogram/services/skill-meta";
import type { Skill } from "../../../miniprogram/types/skill";

test("repository stars and the precise skill date have distinct Chinese labels", () => {
  const skill = {
    github_stars: 1234,
    github_stars_checked_at: "2026-10-06T20:00:00Z",
    source_updated_at: "2026-09-30T20:00:00Z",
  } as Skill;
  assert.deepEqual(skillMetadata(skill), {
    displayStars: "来源仓库 Star 1,234 · 2026-10-07 核对",
    displayUpdated: "技能更新于 2026-10-01",
  });
});

test("older cached rows do not claim a verified date", () => {
  const skill = { github_stars: 42 } as Skill;
  assert.deepEqual(skillMetadata(skill), {
    displayStars: "来源仓库 Star 42 · 核对时间未知",
    displayUpdated: "更新时间未知",
  });
});

test("a missing repository still shows when its absence was checked", () => {
  const skill = { github_stars: null, github_stars_checked_at: "2026-10-07T00:00:00Z" } as Skill;
  assert.deepEqual(skillMetadata(skill), {
    displayStars: "来源仓库 Star 暂无数据 · 2026-10-07 核对",
    displayUpdated: "更新时间未知",
  });
});
