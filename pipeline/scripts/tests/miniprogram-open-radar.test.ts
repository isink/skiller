import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import type { OpenRadarItem } from "../../../miniprogram/services/open-radar";

type ListPage = {
  data: { loading: boolean; error: string; items: Array<{ id: string; titleZh: string; summary: string }> };
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  onLoad(): void;
  onShow(): void;
  openItem(event: { currentTarget: { dataset: { id?: string } } }): void;
  onShareAppMessage(): { title: string; path: string };
};
type DetailPage = {
  data: { loading: boolean; error: string; item: OpenRadarItem | null };
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  onLoad(options: Record<string, string>): void;
  load(): Promise<void>;
  onCopyInstall(): void;
  onCopyLink(event: { currentTarget: { dataset: { kind: string } } }): void;
  onShareAppMessage(): { title: string; path: string };
  onShareTimeline(): { title: string; query: string };
};

const root = join(__dirname, "../../../miniprogram");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };

function loadPage<T>(path: string): Omit<T, "setData" | "data"> & { data: Record<string, unknown> } {
  const original = globals.Page;
  let definition: any;
  globals.Page = (page: unknown) => { definition = page; };
  require(join(root, path));
  globals.Page = original;
  return definition;
}

const listDefinition = loadPage<ListPage>("pages/open-radar/index");
const detailDefinition = loadPage<DetailPage>("pages/open-radar-detail/index");

function harness(t: TestContext) {
  const original = globals.wx;
  const navigations: string[] = [];
  const clipboard: string[] = [];
  const toasts: string[] = [];
  globals.wx = {
    showShareMenu() {},
    navigateTo: ({ url }: { url: string }) => { navigations.push(url); },
    setClipboardData: ({ data, success }: { data: string; success(): void }) => { clipboard.push(data); success(); },
    showToast: ({ title }: { title: string }) => { toasts.push(title); },
    stopPullDownRefresh() {},
    request: ({ success }: { success(r: { statusCode: number }): void }) => success({ statusCode: 201 }),
  };
  t.after(() => { globals.wx = original; });
  const make = <P extends { data: unknown }>(definition: unknown): P => {
    const base = definition as { data: unknown };
    return {
      ...base,
      data: JSON.parse(JSON.stringify(base.data)),
      setData(patch: Record<string, unknown>, callback?: () => void) { Object.assign((this as P).data as object, patch); callback?.(); },
    } as unknown as P;
  };
  return { navigations, clipboard, toasts, list: () => make<ListPage>(listDefinition), detail: () => make<DetailPage>(detailDefinition) };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

const sampleItem: OpenRadarItem = {
  id: "demo", titleZh: "示例项目", summary: "一句话摘要", pitfalls: ["先装依赖"],
  installCommand: "npm i demo", articleUrl: "https://mp.weixin.qq.com/s/demo", packageUrl: "https://example.com/demo.zip",
};

test("both open radar pages are registered and have all four page files", () => {
  const app = JSON.parse(read("app.json")) as { pages: string[] };
  for (const page of ["pages/open-radar/index", "pages/open-radar-detail/index"]) {
    assert.ok(app.pages.includes(page), page);
    for (const ext of ["ts", "wxml", "wxss", "json"]) assert.ok(existsSync(join(root, `${page}.${ext}`)), `${page}.${ext}`);
  }
});

test("landing keeps the open radar as a small link under the scenes, with no new-word radar", () => {
  const wxml = read("pages/landing/index.wxml");
  assert.match(wxml, /bindtap="navigateToOpenRadar">开源雷达<\/text>/);
  assert.match(wxml, /bindtap="navigateToSkills">全部 AI 技能库<\/text>/);
  assert.ok(!wxml.includes("新词雷达"));
  assert.ok(!wxml.includes("热门新词"));
  assert.ok(!wxml.includes("tool-tile"));
  assert.match(wxml, /class="hot-card"/);
  assert.ok(wxml.indexOf("scene-grid") < wxml.indexOf("more-links"));
});

test("open radar pages avoid GitHub branding and web-view", () => {
  for (const file of ["pages/open-radar/index.wxml", "pages/open-radar-detail/index.wxml", "pages/open-radar/index.ts", "pages/open-radar-detail/index.ts", "services/open-radar.ts"]) {
    const source = read(file);
    assert.ok(!/github/i.test(source), file);
    assert.ok(!/web-view/.test(source), file);
  }
});

test("the list opens empty with placeholder state and no hard-coded entries", async (t) => {
  const { list } = harness(t);
  const page = list();
  page.onLoad();
  assert.equal(page.data.loading, true);
  await settle();
  assert.equal(page.data.loading, false);
  assert.equal(page.data.error, "");
  assert.deepEqual(page.data.items, []);
  assert.match(read("pages/open-radar/index.wxml"), /开源雷达筹备中/);
});

test("tapping a list row opens its detail page; an empty id is ignored", (t) => {
  const { list, navigations } = harness(t);
  const page = list();
  page.openItem({ currentTarget: { dataset: { id: "a b" } } });
  page.openItem({ currentTarget: { dataset: {} } });
  assert.deepEqual(navigations, ["/pages/open-radar-detail/index?id=a%20b"]);
});

test("the list shares the open radar page", (t) => {
  const { list } = harness(t);
  assert.deepEqual(list().onShareAppMessage(), { title: "头山 AI 工具箱：开源雷达", path: "/pages/open-radar/index" });
});

test("the detail page opens as an empty shell without data", async (t) => {
  const { detail } = harness(t);
  const page = detail();
  page.onLoad({ id: "demo" });
  await settle();
  assert.equal(page.data.loading, false);
  assert.equal(page.data.item, null);
  assert.match(read("pages/open-radar-detail/index.wxml"), /内容准备中/);

  const noId = detail();
  noId.onLoad({});
  await settle();
  assert.equal(noId.data.loading, false);
  assert.equal(noId.data.item, null);
});

test("the detail template reserves every planned field", () => {
  const wxml = read("pages/open-radar-detail/index.wxml");
  for (const field of ["item.titleZh", "item.summary", "item.pitfalls", "item.installCommand", "item.articleUrl", "item.packageUrl"]) {
    assert.ok(wxml.includes(field), field);
  }
  for (const label of ["踩坑要点", "安装命令", "公众号文", "部署包"]) assert.ok(wxml.includes(label), label);
});

test("detail copies the install command and links once data exists", async (t) => {
  const { detail, clipboard, toasts } = harness(t);
  const page = detail();
  page.onLoad({ id: "demo" });
  await settle();
  page.setData({ item: sampleItem });
  page.onCopyInstall();
  page.onCopyLink({ currentTarget: { dataset: { kind: "article" } } });
  page.onCopyLink({ currentTarget: { dataset: { kind: "package" } } });
  page.onCopyLink({ currentTarget: { dataset: { kind: "other" } } });
  assert.deepEqual(clipboard, ["npm i demo", "https://mp.weixin.qq.com/s/demo", "https://example.com/demo.zip"]);
  assert.deepEqual(toasts, ["安装命令已复制", "公众号文链接已复制", "部署包链接已复制"]);
});

test("detail copy does nothing without data and sharing keeps the id", async (t) => {
  const { detail, clipboard } = harness(t);
  const page = detail();
  page.onLoad({ id: "demo" });
  await settle();
  page.onCopyInstall();
  page.onCopyLink({ currentTarget: { dataset: { kind: "article" } } });
  assert.deepEqual(clipboard, []);
  assert.deepEqual(page.onShareAppMessage(), { title: "头山 AI 工具箱：开源雷达", path: "/pages/open-radar-detail/index?id=demo" });
  assert.deepEqual(page.onShareTimeline(), { title: "头山 AI 工具箱：开源雷达", query: "id=demo" });
  page.setData({ item: sampleItem });
  assert.equal(page.onShareAppMessage().title, "示例项目｜开源雷达");
});
