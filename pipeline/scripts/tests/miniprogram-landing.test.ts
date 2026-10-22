import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { hasEntryParams, shouldSkipLanding } from "../../../miniprogram/services/landing";
import type { Skill } from "../../../miniprogram/types/skill";

type Share = { title: string; path: string; imageUrl?: string; promise?: Promise<{ title: string; path: string; imageUrl?: string }> };
type LandingPage = {
  _redirected: boolean;
  data: Record<string, any>;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  onLoad(options: Record<string, string>): void;
  onShow(): void;
  loadHotTool(sharedId?: string): Promise<void>;
  onCopyHotInstall(): Promise<void>;
  openHotTool(): void;
  onShareAppMessage(): Share;
  onShareTimeline(): { title: string; query: string };
};

const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: Omit<LandingPage, "setData">;
const originalPage = globals.Page;
globals.Page = (page: typeof definition) => { definition = page; };
require("../../../miniprogram/pages/landing/index");
globals.Page = originalPage;

const SEEN_KEY = "skiller.miniprogram.landing-seen.v1";

let sequence = 0;
function makeSkill(overrides: Partial<Skill> = {}): Skill {
  const n = ++sequence;
  return {
    id: `0000000${n}-0000-0000-0000-00000000000${n}`.slice(0, 36),
    slug: `skill-${n}`, name: `skill-${n}`, description: "Source",
    description_zh: "读取和处理 PDF 文件。支持合并与拆分。",
    category: "office", tags: [], use_cases: [], author: "acme",
    github_url: "https://github.com/acme/tools/tree/main/skills/pdf",
    github_stars: 1234, rank: 0, score: 0, featured: false, created_at: "2026-10-01T00:00:00Z", published_at: null,
    stars_growth: 42,
    skill_md_content: "---\nname: pdf-reader\n---\n# PDF",
    ...overrides,
  };
}

type HarnessOptions = { seen?: boolean; scene?: number; hot?: Skill[] | "error"; featured?: Skill[]; full?: Skill | "error"; exportFails?: boolean };

function harness(t: TestContext, options: HarnessOptions = {}) {
  const original = globals.wx;
  const storage = new Map<string, unknown>();
  if (options.seen) storage.set(SEEN_KEY, true);
  const redirects: string[] = [];
  const navigations: string[] = [];
  const clipboard: string[] = [];
  const toasts: Array<{ title: string; duration?: number }> = [];
  const calls: string[] = [];
  const requests: Array<{ url: string; data: { event: string; page?: string; meta?: Record<string, any> } }> = [];
  const events = () => requests.filter((request) => request.url.endsWith("/rest/v1/mp_events")).map((request) => request.data);
  globals.wx = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    getEnterOptionsSync: () => ({ scene: options.scene ?? 1001 }),
    showShareMenu() {},
    redirectTo: ({ url }: { url: string }) => { redirects.push(url); },
    navigateTo: ({ url }: { url: string }) => { navigations.push(url); },
    setClipboardData: ({ data, success }: { data: string; success(): void }) => { clipboard.push(data); success(); },
    showToast: (toast: { title: string; duration?: number }) => { calls.push(`toast:${toast.title}`); toasts.push(toast); },
    showLoading: ({ title }: { title: string }) => { calls.push(`loading:${title}`); },
    hideLoading: () => { calls.push("hideLoading"); },
    request(request: { url: string; data: { event: string }; success(r: { statusCode: number; data?: unknown }): void; fail(e: { errMsg: string }): void }) {
      requests.push(request);
      const { pathname, searchParams } = new URL(request.url);
      if (pathname.endsWith("/mp_events")) return request.success({ statusCode: 201 });
      if (pathname.endsWith("/get_hot_skills")) {
        if (options.hot === "error") return request.fail({ errMsg: "request:fail" });
        return request.success({ statusCode: 200, data: options.hot ?? [] });
      }
      if (searchParams.has("featured")) return request.success({ statusCode: 200, data: options.featured ?? [] });
      if (searchParams.has("id")) {
        if (options.full === "error" || !options.full) return request.fail({ errMsg: "request:fail" });
        return request.success({ statusCode: 200, data: [options.full] });
      }
      return request.success({ statusCode: 200, data: [] });
    },
    createSelectorQuery: () => ({
      select: () => ({
        fields: () => ({
          exec: (callback: (result: unknown[]) => void) => callback([{
            node: { width: 0, height: 0, getContext: () => ({
              fillRect() {}, fillText() {}, measureText: (text: string) => ({ width: text.length * 10 }),
            }) },
          }]),
        }),
      }),
    }),
    canvasToTempFilePath: ({ success, fail }: { success(r: { tempFilePath: string }): void; fail(): void }) => {
      if (options.exportFails) fail(); else success({ tempFilePath: "wxfile://landing-card.jpg" });
    },
  };
  t.after(() => { globals.wx = original; });
  const page: LandingPage = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) { Object.assign(this.data, patch); callback?.(); },
  };
  const detailFetches = () => requests.filter((request) => new URL(request.url).searchParams.has("id")).length;
  return { storage, redirects, navigations, clipboard, toasts, calls, requests, events, detailFetches, page };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("first visit shows the landing page and marks it as seen", (t) => {
  const { page, storage, redirects } = harness(t);
  page.onLoad({});
  assert.deepEqual(redirects, []);
  assert.equal(storage.get(SEEN_KEY), true);
});

test("a returning visitor is redirected to home without a landing page view", (t) => {
  const { page, redirects, requests } = harness(t, { seen: true });
  page.onLoad({});
  page.onShow();
  assert.deepEqual(redirects, ["/pages/home/index"]);
  assert.equal(requests.length, 0);
});

test("a returning visitor with query parameters stays on the entry page", (t) => {
  const { page, redirects } = harness(t, { seen: true });
  page.onLoad({ id: "00000000-0000-0000-0000-000000000001" });
  assert.deepEqual(redirects, []);
});

test("a returning visitor arriving from a share card is not redirected", (t) => {
  const { page, redirects } = harness(t, { seen: true, scene: 1007 });
  page.onLoad({});
  assert.deepEqual(redirects, []);
});

test("entry parameter detection covers queries and share scenes only", () => {
  assert.equal(hasEntryParams({}, 1001), false);
  assert.equal(hasEntryParams(undefined, undefined), false);
  assert.equal(hasEntryParams({ from: "share" }), true);
  for (const scene of [1007, 1008, 1044, 1155]) assert.equal(hasEntryParams({}, scene), true);
});

test("an unseen landing page is never skipped", (t) => {
  harness(t);
  assert.equal(shouldSkipLanding({}, 1001), false);
});

const hotSkills = () => [makeSkill({ name: "pdf" }), makeSkill(), makeSkill()];

test("the hot tool card shows the hottest skill with name, one-line description and growth", async (t) => {
  const hot = hotSkills();
  const { page } = harness(t, { hot, full: hot[0] });
  page.onLoad({});
  assert.equal(page.data.hotLoading, true);
  await settle();

  assert.equal(page.data.hotLoading, false);
  assert.equal(page.data.hotLabel, "今日热门工具");
  assert.deepEqual(page.data.hotTool, { id: hot[0].id, name: "pdf", purpose: "读取和处理 PDF 文件", growth: "本周 +42⭐" });
  assert.equal(page.data.hotCopyLabel, "一键复制安装命令");
});

test("without enough hot skills the card falls back to a featured skill and says so", async (t) => {
  const featured = [makeSkill({ name: "docx" })];
  const { page } = harness(t, { hot: [], featured, full: featured[0] });
  page.onLoad({});
  await settle();
  assert.equal(page.data.hotTool?.name, "docx");
  assert.equal(page.data.hotLabel, "今日推荐工具");
  assert.equal(page.data.hotTool?.growth, "");
});

test("a failed load hides the card without breaking the page", async (t) => {
  const { page } = harness(t, { hot: "error", featured: [] });
  page.onLoad({});
  await settle();
  assert.equal(page.data.hotLoading, false);
  assert.equal(page.data.hotTool, null);
});

test("a returning visitor redirected to home does not load the hot tool", (t) => {
  const { page, requests } = harness(t, { seen: true });
  page.onLoad({});
  assert.equal(requests.length, 0);
});

test("the full skill is only fetched when the user taps copy, behind a loading indicator", async (t) => {
  const hot = hotSkills();
  const { page, clipboard, toasts, calls, events, detailFetches } = harness(t, { hot, full: hot[0] });
  page.onLoad({});
  await settle();
  assert.equal(detailFetches(), 0);
  assert.equal(page.data.hotCopyLabel, "一键复制安装命令");

  await page.onCopyHotInstall();
  await settle();

  assert.equal(detailFetches(), 1);
  assert.deepEqual(clipboard, ["npx skills add https://github.com/acme/tools/tree/main/skills/pdf --skill pdf-reader"]);
  assert.equal(toasts.at(-1)?.title, "安装命令已复制，分享给朋友一起用");
  assert.deepEqual(calls.slice(0, 3), ["loading:正在获取安装命令", "hideLoading", "toast:安装命令已复制，分享给朋友一起用"]);
  const event = events().find((row) => row.event === "copy_install");
  assert.equal(event?.page, "pages/landing/index");
  assert.deepEqual(event?.meta, { action: "copy_install", id: hot[0].id, slug: hot[0].slug, kind: "npx", target: "primary" });

  await page.onCopyHotInstall();
  assert.equal(detailFetches(), 1);
});

test("a second tap while the command is loading is ignored", async (t) => {
  const hot = hotSkills();
  const { page, clipboard, detailFetches } = harness(t, { hot, full: hot[0] });
  page.onLoad({});
  await settle();
  await Promise.all([page.onCopyHotInstall(), page.onCopyHotInstall()]);
  assert.equal(detailFetches(), 1);
  assert.equal(clipboard.length, 1);
});

test("when the full skill cannot be loaded a toast explains it, then the detail page opens", async (t) => {
  const hot = hotSkills();
  const { page, clipboard, navigations, calls } = harness(t, { hot, full: "error" });
  page.onLoad({});
  await settle();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await page.onCopyHotInstall();

  assert.deepEqual(clipboard, []);
  assert.deepEqual(calls, ["loading:正在获取安装命令", "hideLoading", "toast:网络不佳，带你去详情页复制"]);
  assert.deepEqual(navigations, []);
  t.mock.timers.tick(1200);
  assert.deepEqual(navigations, [`/pages/detail/index?id=${hot[0].id}`]);
});

test("a skill with no usable source also goes through toast then detail page", async (t) => {
  const hot = [makeSkill({ github_url: "https://example.com/not-github", skill_md_content: null }), makeSkill(), makeSkill()];
  const { page, navigations, calls } = harness(t, { hot, full: hot[0] });
  page.onLoad({});
  await settle();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await page.onCopyHotInstall();
  assert.equal(calls.at(-1), "toast:暂无安装命令，带你去详情页看看");
  t.mock.timers.tick(1200);
  assert.deepEqual(navigations, [`/pages/detail/index?id=${hot[0].id}`]);
});

test("tapping the card opens the skill detail page", async (t) => {
  const hot = hotSkills();
  const { page, navigations } = harness(t, { hot, full: hot[0] });
  page.onLoad({});
  await settle();
  page.openHotTool();
  assert.deepEqual(navigations, [`/pages/detail/index?id=${hot[0].id}`]);
});

test("a skill the list already proves is link-only copies the link with no loading or fetch", async (t) => {
  const example = makeSkill({ category: "mp-skill", tags: ["mp-example"], skill_md_content: null, github_url: "https://github.com/acme/mp-demo" });
  const hot = [example, makeSkill(), makeSkill()];
  const { page, clipboard, calls, detailFetches } = harness(t, { hot });
  page.onLoad({});
  await settle();
  assert.equal(page.data.hotCopyLabel, "一键复制 GitHub 链接");

  await page.onCopyHotInstall();
  await settle();
  assert.deepEqual(clipboard, ["https://github.com/acme/mp-demo"]);
  assert.equal(detailFetches(), 0);
  assert.ok(!calls.some((call) => call.startsWith("loading") || call === "hideLoading"));
  assert.equal(calls.at(-1), "toast:GitHub 链接已复制，分享给朋友一起看");
});

test("the landing share uses 工具名｜一句卖点, the detail path, the cover and reports share", async (t) => {
  const hot = hotSkills();
  const { page, events } = harness(t, { hot, full: hot[0] });
  page.onLoad({});
  await settle();

  const share = page.onShareAppMessage();
  assert.equal(share.title, "pdf｜读取和处理 PDF 文件");
  assert.equal(share.path, `/pages/detail/index?id=${hot[0].id}`);
  assert.equal(share.imageUrl, "wxfile://landing-card.jpg");
  const event = events().find((row) => row.event === "share");
  assert.equal(event?.page, "pages/landing/index");
  assert.deepEqual(event?.meta, { action: "share", id: hot[0].id, slug: hot[0].slug, channel: "menu", card: true });

  const timeline = page.onShareTimeline();
  assert.equal(timeline.title, "pdf｜读取和处理 PDF 文件");
  assert.equal(timeline.query, `id=${hot[0].id}`);
  assert.equal(events().filter((row) => row.event === "share").pop()?.meta?.channel, "timeline");
});

test("a failed cover keeps the default share image", async (t) => {
  const hot = hotSkills();
  const { page } = harness(t, { hot, full: hot[0], exportFails: true });
  page.onLoad({});
  await settle();
  const share = page.onShareAppMessage();
  assert.equal(share.imageUrl, undefined);
  assert.deepEqual(await share.promise, { title: share.title, path: share.path });
});

test("before the hot tool loads the landing page shares itself", async (t) => {
  const { page, events } = harness(t, { hot: "error", featured: [] });
  page.onLoad({});
  await settle();
  const share = page.onShareAppMessage();
  assert.equal(share.title, "头山 AI 工具箱：探索 AI 技能与趋势");
  assert.equal(share.path, "/pages/landing/index");
  assert.equal(page.onShareTimeline().query, "");
  const shares = events().filter((row) => row.event === "share");
  assert.equal(shares[0].meta?.id, undefined);
  assert.equal(shares[0].meta?.channel, "menu");
});

test("a landing page opened from a shared tool shows that tool instead of today's pick", async (t) => {
  const hot = hotSkills();
  const shared = makeSkill({ name: "docx" });
  const { page } = harness(t, { hot, full: shared });
  page.onLoad({ id: shared.id });
  await settle();
  assert.equal(page.data.hotTool?.id, shared.id);
  assert.equal(page.data.hotLabel, "好友推荐的工具");

  const { page: fallback } = harness(t, { hot, full: "error" });
  fallback.onLoad({ id: shared.id });
  await settle();
  assert.equal(fallback.data.hotTool?.id, hot[0].id);
  assert.equal(fallback.data.hotLabel, "今日热门工具");
});
