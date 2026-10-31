import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Skill } from "../../../miniprogram/types/skill";
import { sceneBySlug } from "../../../miniprogram/services/scenes";

type Share = { title: string; path: string; imageUrl?: string; promise?: Promise<{ title: string; path: string; imageUrl?: string }> };
type ScenePage = {
  data: Record<string, any>;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  onLoad(options: { slug?: string }): void;
  onShow(): void;
  onCopyBundle(): void;
  onCopySkill(event: { currentTarget: { dataset: { index: number } } }): void;
  openSkill(event: { currentTarget: { dataset: { id: string } } }): void;
  openScene(event: { currentTarget: { dataset: { slug: string } } }): void;
  onShareAppMessage(): Share;
  onShareTimeline(): { title: string; query: string };
};

const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: Omit<ScenePage, "setData">;
const originalPage = globals.Page;
globals.Page = (page: typeof definition) => { definition = page; };
require("../../../miniprogram/pages/scene/index");
globals.Page = originalPage;

const finance = sceneBySlug("finance")!;
let sequence = 0;
function makeSkill(slug: string, overrides: Partial<Skill> = {}): Skill {
  const n = ++sequence;
  return {
    id: `0000000${n}-0000-0000-0000-00000000000${n}`.slice(0, 36),
    slug, name: slug, description: "Source", description_zh: "核对账目。逐笔比对。",
    category: "office", tags: [], use_cases: [], author: "acme",
    github_url: `https://github.com/acme/${slug}`,
    github_stars: 10, rank: 0, score: 0, featured: false, created_at: "2026-10-01T00:00:00Z", published_at: null,
    skill_md_content: null,
    ...overrides,
  };
}

function harness(t: TestContext, options: { rows?: Skill[] | "error" } = {}) {
  const original = globals.wx;
  const storage = new Map<string, unknown>();
  const clipboard: string[] = [];
  const toasts: string[] = [];
  const navigations: string[] = [];
  const redirects: string[] = [];
  const requests: Array<{ url: string; data: Record<string, any> }> = [];
  globals.wx = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    setNavigationBarTitle() {},
    showShareMenu() {},
    showToast: ({ title }: { title: string }) => { toasts.push(title); },
    setClipboardData: ({ data, success }: { data: string; success(): void }) => { clipboard.push(data); success(); },
    navigateTo: ({ url }: { url: string }) => { navigations.push(url); },
    redirectTo: ({ url }: { url: string }) => { redirects.push(url); },
    request(request: { url: string; data: Record<string, any>; success(r: { statusCode: number; data?: unknown }): void; fail(e: { errMsg: string }): void }) {
      requests.push(request);
      if (request.url.includes("/mp_events")) return request.success({ statusCode: 201 });
      if (options.rows === "error") return request.fail({ errMsg: "request:fail" });
      return request.success({ statusCode: 200, data: options.rows ?? [] });
    },
    createSelectorQuery: () => ({ select: () => ({ fields: () => ({ exec: (callback: (r: unknown[]) => void) => callback([{
      node: { width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, measureText: (text: string) => ({ width: text.length * 10 }) }) },
    }]) }) }) }),
    canvasToTempFilePath: ({ success }: { success(r: { tempFilePath: string }): void }) => success({ tempFilePath: "wxfile://scene-card.jpg" }),
  };
  t.after(() => { globals.wx = original; });
  const page: ScenePage = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) { Object.assign(this.data, patch); callback?.(); },
  };
  const events = () => requests.filter((request) => request.url.includes("/mp_events")).map((request) => request.data);
  return { page, storage, clipboard, toasts, navigations, redirects, requests, events };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));
// The catalog answers in its own order; the page must keep the curated one.
const financeRows = () => finance.picks.map((pick) => makeSkill(pick.slug)).reverse();

test("a scene lists every skill in star order with its copy, stars and install button", async (t) => {
  const { page, requests } = harness(t, { rows: financeRows() });
  page.onLoad({ slug: "finance" });
  await settle();
  assert.equal(page.data.scene.title, "财务与税务");
  assert.deepEqual(page.data.skills.map((skill: { name: string }) => skill.name), finance.picks.map((pick) => pick.nameZh));
  assert.deepEqual(page.data.skills.map((skill: { englishName: string }) => skill.englishName), finance.picks.map((pick) => pick.slug));
  assert.equal(page.data.skills[0].prepare, finance.picks[0].prepare);
  assert.equal(page.data.skills[0].stars, "10");
  assert.equal(page.data.skills[0].headline, finance.picks[0].headline);
  assert.equal(page.data.skills[0].say, finance.picks[0].say[0]);
  assert.equal(page.data.skills[0].copyLabel, "复制给 WorkBuddy");
  assert.equal(page.data.bundleReady, true);
  assert.equal(page.data.others.length, 7);
  const query = new URL(requests[0].url).searchParams.get("slug");
  assert.equal(query, `in.(${finance.picks.map((pick) => pick.slug).join(",")})`);
});

test("one tap copies a request that installs the whole scene", async (t) => {
  const { page, clipboard, toasts, events } = harness(t, { rows: financeRows() });
  page.onLoad({ slug: "finance" });
  await settle();
  page.onCopyBundle();
  await settle();
  const lines = clipboard[0].split("\n");
  assert.equal(lines[0], `请帮我安装「财务与税务」这 ${finance.picks.length} 个 Skill：`);
  assert.equal(lines[2], `2. ${finance.picks[1].slug}：https://github.com/acme/${finance.picks[1].slug}`);
  assert.equal(lines.length, finance.picks.length + 2);
  assert.deepEqual(toasts, ["已复制，粘贴给WorkBuddy就能装"]);
  assert.deepEqual(events().find((row) => row.event === "copy_install")?.meta, { action: "copy_install", scene: "finance", kind: "workbuddy", target: "bundle" });
});

test("a single skill copies its own WorkBuddy request", async (t) => {
  const { page, clipboard, events } = harness(t, { rows: financeRows() });
  page.onLoad({ slug: "finance" });
  await settle();
  page.onCopySkill({ currentTarget: { dataset: { index: 1 } } });
  await settle();
  assert.equal(clipboard[0].split("\n")[0], `请帮我安装这个 Skill：${finance.picks[1].slug}`);
  assert.equal(events().find((row) => row.event === "copy_install")?.meta.target, "primary");
});

test("cards open the detail page and other scenes replace this one", async (t) => {
  const { page, navigations, redirects } = harness(t, { rows: financeRows() });
  page.onLoad({ slug: "finance" });
  await settle();
  page.openSkill({ currentTarget: { dataset: { id: page.data.skills[0].id } } });
  page.openScene({ currentTarget: { dataset: { slug: "hr" } } });
  assert.deepEqual(navigations, [`/pages/detail/index?id=${page.data.skills[0].id}`]);
  assert.deepEqual(redirects, ["/pages/scene/index?slug=hr"]);
});

test("sharing a scene uses its share title, its own path and the cover", async (t) => {
  const { page, events } = harness(t, { rows: financeRows() });
  page.onLoad({ slug: "finance" });
  await settle();
  const share = page.onShareAppMessage();
  assert.equal(share.title, finance.shareTitle);
  assert.equal(share.path, "/pages/scene/index?slug=finance");
  assert.equal(share.imageUrl, "wxfile://scene-card.jpg");
  assert.deepEqual(events().find((row) => row.event === "share")?.meta, { action: "share", scene: "finance", channel: "menu", card: true });
  assert.deepEqual(page.onShareTimeline(), { title: finance.shareTitle, query: "slug=finance" });
});

test("a failed load keeps the cached list and says so", async (t) => {
  const first = harness(t, { rows: financeRows() });
  first.page.onLoad({ slug: "finance" });
  await settle();
  const { page } = harness(t, { rows: "error" });
  (globals.wx as { getStorageSync: unknown }).getStorageSync = (key: string) => first.storage.get(key) ?? "";
  page.onLoad({ slug: "finance" });
  await settle();
  assert.equal(page.data.skills.length, finance.picks.length);
  assert.equal(page.data.error, "网络不可用，显示缓存内容。");
});

test("an unknown scene shows the empty state and shares the landing page", (t) => {
  const { page, requests } = harness(t);
  page.onLoad({ slug: "nope" });
  assert.equal(page.data.scene, null);
  assert.equal(page.data.loading, false);
  assert.equal(requests.length, 0);
  assert.equal(page.onShareAppMessage().path, "/pages/landing/index");
});
