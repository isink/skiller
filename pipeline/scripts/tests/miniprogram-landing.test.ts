import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

type Share = { title: string; path: string };
type LandingPage = {
  data?: Record<string, unknown>;
  onLoad(options: Record<string, string>): void;
  onShow(): void;
  navigateToSkills(): void;
  navigateToOpenRadar(): void;
  onShareAppMessage(): Share;
  onShareTimeline(): { title: string; query: string };
};

const root = join(__dirname, "../../../miniprogram/pages/landing");
const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: LandingPage;
const originalPage = globals.Page;
globals.Page = (page: LandingPage) => { definition = page; };
require("../../../miniprogram/pages/landing/index");
globals.Page = originalPage;

const LEGACY_SEEN_KEY = "skiller.miniprogram.landing-seen.v1";

type HarnessOptions = { legacySeen?: boolean; scene?: number };

function harness(t: TestContext, options: HarnessOptions = {}) {
  const original = globals.wx;
  const storage = new Map<string, unknown>();
  if (options.legacySeen) storage.set(LEGACY_SEEN_KEY, true);
  const redirects: string[] = [];
  const navigations: string[] = [];
  const requests: Array<{ url: string; data: { event: string; page?: string; meta?: Record<string, unknown> } }> = [];
  const events = () => requests.filter((request) => request.url.endsWith("/rest/v1/mp_events")).map((request) => request.data);
  globals.wx = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    getEnterOptionsSync: () => ({ scene: options.scene ?? 1001 }),
    showShareMenu() {},
    redirectTo: ({ url }: { url: string }) => { redirects.push(url); },
    navigateTo: ({ url }: { url: string }) => { navigations.push(url); },
    request(request: { url: string; data: { event: string }; success(r: { statusCode: number; data?: unknown }): void }) {
      requests.push(request);
      request.success({ statusCode: 201 });
    },
  };
  t.after(() => { globals.wx = original; });
  return { storage, redirects, navigations, requests, events, page: definition };
}

test("a fresh install stays on the landing page and does not write a seen marker", (t) => {
  const { page, storage, redirects } = harness(t);
  page.onLoad({});
  page.onShow();
  assert.deepEqual(redirects, []);
  assert.equal(storage.has(LEGACY_SEEN_KEY), false);
});

test("a leftover landing-seen marker no longer skips the landing page", (t) => {
  const { page, redirects } = harness(t, { legacySeen: true });
  page.onLoad({});
  page.onShow();
  assert.deepEqual(redirects, []);
});

test("every cold start stays on the landing page regardless of scene or query", (t) => {
  for (const scene of [1001, 1007, 1008, 1044, 1155]) {
    for (const query of [{} as Record<string, string>, { id: "00000000-0000-0000-0000-000000000001" }]) {
      const { page, redirects } = harness(t, { legacySeen: true, scene });
      page.onLoad(query);
      assert.deepEqual(redirects, []);
    }
  }
});

test("the landing page has no today's-pick tool card and loads no skills", async (t) => {
  const wxml = readFileSync(join(root, "index.wxml"), "utf8");
  const wxss = readFileSync(join(root, "index.wxss"), "utf8");
  for (const text of ["今日推荐", "今日热门", "hot-card", "hotTool", "share-canvas"]) {
    assert.ok(!wxml.includes(text), text);
    assert.ok(!wxss.includes(text), text);
  }

  const { page, requests } = harness(t);
  page.onLoad({ id: "00000000-0000-0000-0000-000000000001" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requests.filter((request) => !request.url.endsWith("/rest/v1/mp_events")), []);
});

test("the landing page shares itself and reports the share", (t) => {
  const { page, events } = harness(t);
  page.onLoad({});
  const share = page.onShareAppMessage();
  assert.equal(share.title, "头山 AI 工具箱：探索 AI 技能与趋势");
  assert.equal(share.path, "/pages/landing/index");
  const timeline = page.onShareTimeline();
  assert.equal(timeline.title, "头山 AI 工具箱：探索 AI 技能与趋势");
  assert.equal(timeline.query, "");
  const shares = events().filter((row) => row.event === "share");
  assert.deepEqual(shares.map((row) => [row.page, row.meta?.channel, row.meta?.id]), [
    ["pages/landing/index", "menu", undefined],
    ["pages/landing/index", "timeline", undefined],
  ]);
});

test("the two tool tiles open the skill library and the open radar", (t) => {
  const { page, navigations } = harness(t);
  page.navigateToSkills();
  page.navigateToOpenRadar();
  assert.deepEqual(navigations, ["/pages/home/index", "/pages/open-radar/index"]);
});
