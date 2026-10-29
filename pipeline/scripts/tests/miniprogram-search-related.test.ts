/// <reference path="../../../miniprogram/types/wx.d.ts" />
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { searchRelatedSkills, searchSkills } from "../../../miniprogram/services/api";
import {
  INTENT_GROUPS,
  MAX_RELATED_TERMS,
  mergeRelated,
  relatedQueriesFor,
} from "../../../miniprogram/services/search-expansion";
import type { Skill } from "../../../miniprogram/types/skill";

type HomeSkill = Skill & { displayDescription: string };
type HomePage = {
  data: {
    query: string; results: HomeSkill[]; related: HomeSkill[]; searching: boolean; error: string;
    recommended: HomeSkill[]; recommendTitle: string;
  };
  onSearchInput(event: { detail: { value: string } }): void;
  clearSearch(): void;
  setData(patch: Partial<HomePage["data"]>): void;
};

const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: Omit<HomePage, "setData">;
const originalPage = globals.Page;
globals.Page = (page: typeof definition) => { definition = page; };
require("../../../miniprogram/pages/home/index");
globals.Page = originalPage;

let counter = 0;
function makeSkill(name: string, descriptionZh: string | null, description = ""): Skill {
  const id = `00000000-0000-0000-0000-${String(++counter).padStart(12, "0")}`;
  return {
    id, slug: name.toLowerCase().replace(/\s+/g, "-"), name, description, description_zh: descriptionZh,
    category: "ai", tags: [], use_cases: [], author: "owner", github_url: `https://github.com/owner/repo-${counter}`,
    github_stars: 100, rank: 0, score: 0, featured: false, created_at: "2026-10-01T00:00:00Z", published_at: null,
  };
}

// Shaped like the live catalog: no skill mentions 武打, 武术, 格斗 or 功夫.
const catalog: Skill[] = [
  makeSkill("Viral Video Teardown Remake", "拆解爆款短视频的钩子与节奏，重建分镜、节拍帧与旁白"),
  makeSkill("short-drama-storyboard", null, "Storyboard generator for short drama episodes"),
  makeSkill("ai-video-gen", "一站式视频生成工具，支持文生视频与图生视频"),
  makeSkill("motion-pipeline", "纯 CPU 的游戏动画动作数据处理管线，支持 BVH 导入与动作混合"),
  makeSkill("Makepad 2 0 Events", "提供 Makepad 2.0 事件与动作系统的开发指导"),
  makeSkill("short-drama-produce", "短剧制作流水线，从剧本到成片"),
  makeSkill("Animejs Animation", "基于 Anime.js 的网页动画生成技能"),
  makeSkill("pdf-toolkit", "读取、合并和拆分 PDF 文件"),
];
const hotSkills = [makeSkill("Hot A", "热门一"), makeSkill("Hot B", "热门二"), makeSkill("Hot C", "热门三")];

interface Recorded { skillQueries: string[]; events: Array<Record<string, unknown>>; log: string[] }

/** Fake PostgREST: `or=(col.ilike.%q%,...)` over the fixture catalog, plus the mp_events sink. */
function mockBackend(t: TestContext, options: { rows?: Skill[]; failTerms?: string[]; failAll?: boolean } = {}): Recorded {
  const original = globals.wx;
  const rows = options.rows ?? catalog;
  const recorded: Recorded = { skillQueries: [], events: [], log: [] };
  globals.wx = {
    getStorageSync: () => "",
    setStorageSync() {},
    request(request: {
      url: string; method: string; data?: Record<string, unknown>;
      success(response: { statusCode: number; data?: unknown }): void; fail(error: { errMsg: string }): void;
    }) {
      const url = new URL(request.url);
      if (request.method === "POST") {
        recorded.events.push(request.data ?? {});
        recorded.log.push(`event:${request.data?.event}:${request.data?.query ?? ""}`);
        request.success({ statusCode: 201 });
        return;
      }
      const filter = url.searchParams.get("or") ?? "";
      const term = /name\.ilike\.%(.*?)%,description\./.exec(filter)?.[1] ?? "";
      recorded.skillQueries.push(term);
      recorded.log.push(`skills:${term}`);
      if (options.failAll || options.failTerms?.includes(term)) { request.fail({ errMsg: "request:fail" }); return; }
      const needle = term.toLowerCase();
      const limit = Number(url.searchParams.get("limit") || rows.length);
      const hits = rows.filter((row) => [row.name, row.description, row.description_zh, row.author]
        .some((value) => (value ?? "").toLowerCase().includes(needle)));
      request.success({ statusCode: 200, data: hits.slice(0, limit) });
    },
  };
  t.after(() => { globals.wx = original; });
  return recorded;
}

function newHomePage(): HomePage {
  return {
    ...definition,
    data: { query: "", results: [], related: [], searching: false, error: "", recommended: hotSkills as HomeSkill[], recommendTitle: "本周热门，先看看这些" },
    setData(patch) { Object.assign(this.data, patch); },
  };
}

async function search(t: TestContext, page: HomePage, query: string): Promise<void> {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  page.onSearchInput({ detail: { value: query } });
  t.mock.timers.tick(300);
  for (let attempt = 0; attempt < 50 && page.data.searching; attempt++) await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.reset();
}

const emptyEvents = (recorded: Recorded) => recorded.events.filter((event) => event.event === "search_empty");

test("武打, 武打动作, 武术, 格斗 and 功夫 all expand to bounded, catalog-backed terms", () => {
  for (const query of ["武打", "武打动作", "武术", "格斗", "功夫", " 武 打 ", "Kung Fu", "martial arts"]) {
    const terms = relatedQueriesFor(query);
    assert.ok(terms.length > 0 && terms.length <= MAX_RELATED_TERMS, `${query} -> ${terms}`);
    assert.ok(terms.includes("分镜") && terms.includes("视频生成"), query);
  }
  assert.deepEqual(relatedQueriesFor("武打动作"), relatedQueriesFor("武打"));
  assert.deepEqual(relatedQueriesFor("武打动"), relatedQueriesFor("武打"));
});

test("expansion ignores unknown or blank queries and never echoes the query itself", () => {
  assert.deepEqual(relatedQueriesFor(""), []);
  assert.deepEqual(relatedQueriesFor("   "), []);
  assert.deepEqual(relatedQueriesFor("zzqqxx"), []);
  assert.deepEqual(relatedQueriesFor("武打", 0), []);
  assert.ok(!relatedQueriesFor("anime").includes("anime"));
  for (const group of INTENT_GROUPS) {
    for (const trigger of group.triggers) assert.ok(!relatedQueriesFor(trigger).includes(trigger), trigger);
  }
});

test("mergeRelated interleaves terms, drops duplicate ids and respects the limit", () => {
  const item = (id: string) => ({ id });
  const merged = mergeRelated([[item("a"), item("b"), item("c")], [item("a"), item("d")], [], [item("e")]], 10);
  assert.deepEqual(merged.map((row) => row.id), ["a", "e", "b", "d", "c"]);
  assert.equal(mergeRelated([[item("a"), item("b")], [item("c")]], 2).length, 2);
  assert.deepEqual(mergeRelated([], 5), []);
});

test("searchRelatedSkills queries every related term in parallel and tolerates a failing term", async (t) => {
  const recorded = mockBackend(t, { failTerms: ["视频生成"] });
  const related = await searchRelatedSkills("武打");
  assert.deepEqual(recorded.skillQueries, relatedQueriesFor("武打"));
  assert.ok(related.length > 0);
  assert.ok(related.some((skill) => skill.name === "Viral Video Teardown Remake"));
  assert.ok(!related.some((skill) => skill.name === "ai-video-gen"));
  assert.equal(new Set(related.map((skill) => skill.id)).size, related.length);

  const none = mockBackend(t, { failAll: true });
  assert.deepEqual(await searchRelatedSkills("武打"), []);
  assert.ok(none.skillQueries.length > 0);

  const unrelated = mockBackend(t);
  assert.deepEqual(await searchRelatedSkills("zzqqxx"), []);
  assert.deepEqual(unrelated.skillQueries, []);
});

test("the primary searchSkills request is unchanged by the expansion", async (t) => {
  const recorded = mockBackend(t);
  assert.deepEqual(await searchSkills("武打"), []);
  assert.deepEqual(recorded.skillQueries, ["武打"]);
});

test("home 武打: no primary hit shows related skills and still records search_empty for 武打", async (t) => {
  const recorded = mockBackend(t);
  const page = newHomePage();
  await search(t, page, "武打");

  assert.equal(page.data.searching, false);
  assert.equal(page.data.error, "");
  assert.deepEqual(page.data.results, []);
  assert.ok(page.data.related.length > 0);
  assert.ok(page.data.related.every((skill) => typeof skill.displayDescription === "string"));
  assert.ok(page.data.related.some((skill) => skill.name === "Viral Video Teardown Remake"));
  assert.ok(page.data.related.some((skill) => skill.name === "short-drama-produce"));

  assert.equal(recorded.skillQueries[0], "武打");
  const [empty] = emptyEvents(recorded);
  assert.equal(emptyEvents(recorded).length, 1);
  assert.equal(empty.query, "武打");
  assert.equal(empty.result_count, 0);
  assert.equal(empty.page, "pages/home/index");
  const search_ = recorded.events.find((event) => event.event === "search");
  assert.equal(search_?.query, "武打");
  assert.equal(search_?.result_count, 0);
  assert.ok(recorded.log.indexOf("event:search_empty:武打") < recorded.log.indexOf(`skills:${relatedQueriesFor("武打")[0]}`),
    "the content-gap event must not wait for the related lookup");
});

test("home 武打动作 behaves the same way", async (t) => {
  const recorded = mockBackend(t);
  const page = newHomePage();
  await search(t, page, "武打动作");
  assert.ok(page.data.related.length > 0);
  assert.deepEqual(emptyEvents(recorded).map((event) => event.query), ["武打动作"]);
});

test("home: a primary hit is unchanged, with no related lookup and no search_empty", async (t) => {
  const recorded = mockBackend(t);
  const page = newHomePage();
  await search(t, page, "pdf");
  assert.deepEqual(page.data.results.map((skill) => skill.name), ["pdf-toolkit"]);
  assert.deepEqual(page.data.related, []);
  assert.deepEqual(recorded.skillQueries, ["pdf"]);
  assert.deepEqual(emptyEvents(recorded), []);
  assert.equal(recorded.events.find((event) => event.event === "search")?.result_count, 1);
});

test("home: related expansion that finds nothing keeps the empty state with recommendations", async (t) => {
  const recorded = mockBackend(t, { rows: [catalog[catalog.length - 1]] });
  const page = newHomePage();
  await search(t, page, "武术");
  assert.deepEqual(page.data.results, []);
  assert.deepEqual(page.data.related, []);
  assert.equal(page.data.recommended.length, 3);
  assert.equal(page.data.error, "");
  assert.deepEqual(emptyEvents(recorded).map((event) => event.query), ["武术"]);
});

test("home: a query outside every intent group goes straight to the empty state", async (t) => {
  const recorded = mockBackend(t);
  const page = newHomePage();
  await search(t, page, "量子纠缠烹饪");
  assert.deepEqual(page.data.related, []);
  assert.deepEqual(recorded.skillQueries, ["量子纠缠烹饪"]);
  assert.deepEqual(emptyEvents(recorded).map((event) => event.query), ["量子纠缠烹饪"]);
});

test("home: failing related requests fall back to the empty state without an error", async (t) => {
  const related = new Set(relatedQueriesFor("功夫"));
  const recorded = mockBackend(t, { failTerms: [...related] });
  const page = newHomePage();
  await search(t, page, "功夫");
  assert.deepEqual(page.data.related, []);
  assert.equal(page.data.error, "");
  assert.equal(page.data.searching, false);
  assert.deepEqual(emptyEvents(recorded).map((event) => event.query), ["功夫"]);
});

test("home: a failing primary search still reports an error and skips the related lookup", async (t) => {
  const recorded = mockBackend(t, { failTerms: ["格斗"] });
  const page = newHomePage();
  await search(t, page, "格斗");
  assert.equal(page.data.error, "搜索失败，请稍后重试。");
  assert.deepEqual(page.data.related, []);
  assert.deepEqual(recorded.skillQueries, ["格斗"]);
});

test("home: typing again or clearing drops stale related results", async (t) => {
  mockBackend(t);
  const page = newHomePage();
  await search(t, page, "武打");
  assert.ok(page.data.related.length > 0);
  page.onSearchInput({ detail: { value: "武打动作" } });
  assert.deepEqual(page.data.related, []);
  page.clearSearch();
  assert.deepEqual(page.data.related, []);
  assert.equal(page.data.query, "");
});
