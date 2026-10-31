import assert from "node:assert/strict";
import test from "node:test";
import { SCENES, dailyPick, sceneBySlug, scenePick, scenePicks } from "../../../miniprogram/services/scenes";
import { workbuddyBundlePrompt } from "../../../miniprogram/services/skill-install";
import { sceneProblems } from "../lib/scenes-check";

const catalogFor = (slugs: string[]) => slugs.map((slug) => ({ slug, description_zh: "中文简介" }));
const allSlugs = SCENES.flatMap((scene) => scenePicks(scene).map((pick) => pick.slug));
const mustSlugs = SCENES.flatMap((scene) => scene.must.map((pick) => pick.slug));

test("the curated collections are well formed", () => {
  assert.equal(SCENES.length, 8);
  assert.deepEqual(sceneProblems(SCENES, catalogFor(allSlugs)), []);
  for (const scene of SCENES) {
    assert.match(scene.shareTitle, /WorkBuddy/, scene.slug);
    assert.equal(scene.must.length, 3, scene.slug);
    for (const pick of scenePicks(scene)) for (const say of pick.say) assert.ok(Array.from(say).length <= 40, say);
  }
});

test("the checker reports missing skills, empty summaries, duplicates and bad copy", () => {
  const pick = (slug: string, extra: Record<string, unknown> = {}) => ({ slug, headline: "一句话", say: ["做点事"], ...extra });
  const scenes = [
    { slug: "a", title: "A", tagline: "", shareTitle: "", must: [pick("x"), pick("y", { say: [] }), pick("w", { headline: "" })], more: [] },
    { slug: "a", title: "B", tagline: "", shareTitle: "", must: [pick("x")], more: [pick("z", { example: { input: "说", output: " " } })] },
  ];
  const catalog = [{ slug: "x", description_zh: "简介" }, { slug: "y", description_zh: " " }, { slug: "w", description_zh: "简介" }];
  assert.deepEqual(sceneProblems(scenes, catalog), [
    "a/y has no Chinese summary",
    "a/y needs one to three example requests",
    "a/w needs a headline of 1-20 characters",
    "scene a is listed twice",
    "scene a needs exactly 3 must-have skills",
    "x appears in more than one place",
    "a/z is not in the catalog",
    "a/z has an incomplete example",
  ]);
});

test("lookups find a scene by slug and a skill's scene and examples", () => {
  assert.equal(sceneBySlug("finance")?.title, "财务与税务");
  assert.equal(sceneBySlug("nope"), null);
  assert.equal(sceneBySlug(undefined), null);
  const found = scenePick("meeting-notes");
  assert.equal(found?.scene.slug, "docs");
  assert.equal(found?.must, true);
  assert.equal(found?.pick.say.length, 2);
  assert.equal(scenePick("pdf-official")?.must, false);
  assert.equal(scenePick("not-curated"), null);
});

test("the daily pick changes at Beijing midnight and cycles through every must-have", () => {
  const before = dailyPick(new Date("2026-10-30T15:59:59Z"));
  const after = dailyPick(new Date("2026-10-30T16:00:00Z"));
  assert.notEqual(before.pick.slug, after.pick.slug);
  assert.equal(dailyPick(new Date("2026-10-30T16:00:00Z")).pick.slug, dailyPick(new Date("2026-10-31T15:00:00Z")).pick.slug);
  const seen = new Set<string>();
  for (let day = 0; day < mustSlugs.length; day++) seen.add(dailyPick(new Date(Date.UTC(2026, 0, 1) + day * 86400000)).pick.slug);
  assert.deepEqual([...seen].sort(), [...mustSlugs].sort());
});

test("the bundle request lists every installable skill in order and skips unusable sources", () => {
  const prompt = workbuddyBundlePrompt("财务与税务", [
    { name: "reconciliation", github_url: "https://github.com/acme/fin/tree/main/skills/rec" },
    { name: "broken", github_url: "https://example.com/x" },
    { name: "tax\n register", github_url: "https://github.com/acme/tax" },
  ]);
  assert.equal(prompt, [
    "请帮我安装「财务与税务」这 2 个 Skill：",
    "1. reconciliation：https://github.com/acme/fin/tree/main/skills/rec",
    "2. tax register：https://github.com/acme/tax",
    "逐个装进你的技能里，全部装好后列一张表，用一句话说明每个能做什么。",
  ].join("\n"));
  assert.equal(workbuddyBundlePrompt("空", [{ name: "x", github_url: null }]), "");
});
