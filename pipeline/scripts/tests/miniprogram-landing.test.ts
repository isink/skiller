import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { hasEntryParams, shouldSkipLanding } from "../../../miniprogram/services/landing";

type Share = { title: string; path: string };
type LandingPage = {
  _redirected: boolean;
  onLoad(options: Record<string, string>): void;
  onShow(): void;
  markLandingEntered(): void;
  onShareAppMessage(): Share;
  onShareTimeline(): { title: string; query: string };
};

const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: LandingPage;
const originalPage = globals.Page;
globals.Page = (page: LandingPage) => { definition = page; };
require("../../../miniprogram/pages/landing/index");
globals.Page = originalPage;

const SEEN_KEY = "skiller.miniprogram.landing-seen.v1";

function harness(t: TestContext, options: { seen?: boolean; scene?: number } = {}) {
  const original = globals.wx;
  const storage = new Map<string, unknown>();
  if (options.seen) storage.set(SEEN_KEY, true);
  const launches: string[] = [];
  const events: string[] = [];
  globals.wx = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    getEnterOptionsSync: () => ({ scene: options.scene ?? 1001 }),
    showShareMenu() {},
    reLaunch: ({ url }: { url: string }) => { launches.push(url); },
    request: ({ data, success }: { data: { event: string }; success(r: { statusCode: number }): void }) => {
      events.push(data.event);
      success({ statusCode: 201 });
    },
  };
  t.after(() => { globals.wx = original; });
  return { page: { ...definition }, storage, launches, events };
}

test("first visit is only marked after an entry is chosen", (t) => {
  const { page, storage, launches } = harness(t);
  page.onLoad({});
  assert.deepEqual(launches, []);
  assert.equal(storage.get(SEEN_KEY), undefined);
  page.markLandingEntered();
  assert.equal(storage.get(SEEN_KEY), true);
});

test("a returning visitor relaunches the skill home page", (t) => {
  const { page, launches } = harness(t, { seen: true });
  page.onLoad({});
  assert.deepEqual(launches, ["/pages/home/index"]);
});

test("query parameters and share scenes keep visitors on the landing page", (t) => {
  const query = harness(t, { seen: true });
  query.page.onLoad({ from: "share" });
  assert.deepEqual(query.launches, []);

  const share = harness(t, { seen: true, scene: 1007 });
  share.page.onLoad({});
  assert.deepEqual(share.launches, []);
});

test("entry parameter detection only covers queries and share scenes", () => {
  assert.equal(hasEntryParams({}, 1001), false);
  assert.equal(hasEntryParams(undefined, undefined), false);
  assert.equal(hasEntryParams({ from: "share" }), true);
  for (const scene of [1007, 1008, 1044, 1155]) assert.equal(hasEntryParams({}, scene), true);
});

test("the simplified landing page shares a generic entry", (t) => {
  const { page } = harness(t);
  page.onLoad({});
  assert.deepEqual(page.onShareAppMessage(), {
    title: "头山 AI 工具箱：探索 AI 技能与趋势",
    path: "/pages/landing/index",
  });
  assert.deepEqual(page.onShareTimeline(), {
    title: "头山 AI 工具箱：探索 AI 技能与趋势",
    query: "",
  });
});

test("an unseen landing page is never skipped", (t) => {
  harness(t);
  assert.equal(shouldSkipLanding({}, 1001), false);
});
