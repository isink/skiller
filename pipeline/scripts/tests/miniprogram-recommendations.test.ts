import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { fetchHotTool, fetchRecommendations } from "../../../miniprogram/services/recommendations";
import type { Skill } from "../../../miniprogram/types/skill";

type RadarPage = {
  data: { recommendTitle: string; recommended: Array<Skill & { displayDescription: string }> };
  onLoad(): void;
  loadRecommendations(): Promise<void>;
  openSkill(event: { currentTarget: { dataset: { id: string } } }): void;
  openExplore(): void;
  setData(patch: Partial<RadarPage["data"]>): void;
};

const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: Omit<RadarPage, "setData">;
const originalPage = globals.Page;
globals.Page = (page: typeof definition) => { definition = page; };
require("../../../miniprogram/pages/radar/index");
globals.Page = originalPage;

function makeSkill(index: number): Skill {
  const id = `0000000${index}-0000-0000-0000-00000000000${index}`;
  return {
    id, slug: id, name: `Skill ${index}`, description: "Source", description_zh: "中文简介",
    category: "code", tags: [], use_cases: [], author: "owner", github_url: "https://github.com/owner/repo",
    github_stars: 1, rank: 0, score: 0, featured: true, created_at: "2026-10-01T00:00:00Z", published_at: null,
  };
}

const skills = [1, 2, 3, 4, 5, 6].map(makeSkill);

function mockApi(t: TestContext, hot: Skill[] | "error") {
  const original = globals.wx;
  const paths: string[] = [];
  const navigations: string[] = [];
  const storage = new Map<string, unknown>();
  globals.wx = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    showShareMenu() {},
    navigateTo: ({ url }: { url: string }) => { navigations.push(url); },
    request(options: { url: string; success(response: { statusCode: number; data: unknown }): void; fail(error: { errMsg: string }): void }) {
      const url = new URL(options.url);
      paths.push(url.pathname);
      if (url.pathname.endsWith("/get_hot_skills")) {
        if (hot === "error") options.fail({ errMsg: "request:fail" });
        else options.success({ statusCode: 200, data: hot });
        return;
      }
      options.success({ statusCode: 200, data: skills.slice(0, Number(url.searchParams.get("limit"))) });
    },
  };
  t.after(() => { globals.wx = original; });
  return { paths, navigations };
}

test("three or more hot skills become the recommendations", async (t) => {
  const { paths } = mockApi(t, skills.slice(0, 4));
  const result = await fetchRecommendations(5);
  assert.equal(result.title, "本周热门技能");
  assert.equal(result.hot, true);
  assert.equal(result.skills.length, 4);
  assert.deepEqual(paths, ["/rest/v1/rpc/get_hot_skills"]);
});

test("thin hot data and hot failures fall back to featured skills", async (t) => {
  mockApi(t, skills.slice(0, 2));
  const thin = await fetchRecommendations(5);
  assert.equal(thin.title, "精选技能");
  assert.equal(thin.skills.length, 5);

  mockApi(t, "error");
  assert.equal((await fetchRecommendations(3)).skills.length, 3);
});

test("the landing hot tool is the first hot skill, or the first featured one as a fallback", async (t) => {
  mockApi(t, skills.slice(2, 6));
  assert.deepEqual(await fetchHotTool(), { skill: skills[2], hot: true });

  mockApi(t, skills.slice(0, 2));
  assert.deepEqual(await fetchHotTool(), { skill: skills[0], hot: false });

  mockApi(t, []);
  const picked = await fetchHotTool();
  assert.equal(picked?.hot, false);
});

test("radar loads recommendations at the bottom and opens skill details and explore", async (t) => {
  const { navigations } = mockApi(t, skills.slice(0, 3));
  const page: RadarPage = {
    ...definition,
    data: { recommendTitle: "", recommended: [] },
    setData(patch) { Object.assign(this.data, patch); },
  };
  await page.loadRecommendations();
  assert.equal(page.data.recommendTitle, "本周热门技能");
  assert.deepEqual(page.data.recommended.map((skill) => skill.id), skills.slice(0, 3).map((skill) => skill.id));
  assert.equal(page.data.recommended[0].displayDescription, "中文简介");

  page.openSkill({ currentTarget: { dataset: { id: skills[0].id } } });
  page.openExplore();
  assert.deepEqual(navigations, [`/pages/detail/index?id=${skills[0].id}`, "/pages/explore/index"]);
});

test("a failed recommendation load leaves the page without a recommendation block", async (t) => {
  const original = globals.wx;
  t.after(() => { globals.wx = original; });
  globals.wx = {
    getStorageSync: () => "",
    setStorageSync() {},
    request: (options: { fail(error: { errMsg: string }): void }) => options.fail({ errMsg: "request:fail" }),
  };
  const page: RadarPage = {
    ...definition,
    data: { recommendTitle: "", recommended: [] },
    setData(patch) { Object.assign(this.data, patch); },
  };
  await assert.doesNotReject(page.loadRecommendations());
  assert.deepEqual(page.data.recommended, []);
});
