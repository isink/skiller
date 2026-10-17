import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { shortPurpose, skillShareTitle, APP_TITLE } from "../../../miniprogram/services/share";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  drawShareCard,
  formatCardStars,
  renderShareCard,
  wrapText,
  type CardContext,
} from "../../../miniprogram/services/share-card";

class RecordingContext implements CardContext {
  fillStyle = ""; font = ""; textBaseline = ""; textAlign = "";
  texts: Array<{ text: string; x: number; y: number }> = [];
  rects: Array<{ x: number; y: number; width: number; height: number }> = [];
  fillRect(x: number, y: number, width: number, height: number) { this.rects.push({ x, y, width, height }); }
  fillText(text: string, x: number, y: number) { this.texts.push({ text, x, y }); }
  // Ten pixels per character keeps the wrapping maths easy to follow.
  measureText(text: string) { return { width: Array.from(text).length * 10 }; }
}

test("the share card is five to four", () => {
  assert.equal(CARD_WIDTH / CARD_HEIGHT, 5 / 4);
});

test("share titles read 技能名｜一句中文用途", () => {
  assert.equal(skillShareTitle("pdf", "读取、创建和处理 PDF 文件。支持合并拆分。"), "pdf｜读取、创建和处理 PDF 文件");
  assert.equal(skillShareTitle("code-audit", "开展授权的源码安全审查，使用 Semgrep、CodeQL 等方法定位危险调用并验证修复效果。"), "code-audit｜开展授权的源码安全审查");
});

test("long purposes are cut at a clause break or ellipsised", () => {
  assert.equal(shortPurpose("为 Antigravity CLI 配置分层权限策略，在无需跳过全部权限检查的情况下安全运行自动化任务。"), "为 Antigravity CLI 配…");
  assert.equal(shortPurpose("阅读并整理 PDF 文件，提取其中的表格"), "阅读并整理 PDF 文件，提取其中的表格");
  assert.equal(shortPurpose("一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十"), `${"一二三四五六七八九十一二三四五六七八九"}…`);
  assert.equal(shortPurpose("简短用途。后面的不要"), "简短用途");
});

test("a missing summary falls back to the app name", () => {
  assert.equal(skillShareTitle("pdf", "中文简介待补充"), `pdf｜${APP_TITLE}`);
  assert.equal(skillShareTitle("pdf", ""), `pdf｜${APP_TITLE}`);
  assert.equal(skillShareTitle("", null), `${APP_TITLE}｜${APP_TITLE}`);
  assert.ok(Array.from(skillShareTitle("a-very-long-skill-name-that-goes-on-and-on", "用途")).length <= 40);
});

test("star counts are shortened for the card", () => {
  assert.equal(formatCardStars(null), "");
  assert.equal(formatCardStars(0), "0");
  assert.equal(formatCardStars(9876), "9876");
  assert.equal(formatCardStars(12000), "1.2万");
  assert.equal(formatCardStars(20000), "2万");
});

test("text wraps by measured width, keeps English words whole and ends with an ellipsis", () => {
  const ctx = new RecordingContext();
  assert.deepEqual(wrapText(ctx, "一二三四五六七八九十一二三", 50, 5), ["一二三四五", "六七八九十", "一二三"]);
  assert.deepEqual(wrapText(ctx, "ab hello world", 80, 3), ["ab hello", "world"]);
  assert.deepEqual(wrapText(ctx, "一二三四五六七八九十一二三", 50, 2), ["一二三四五", "六七八九…"]);
  assert.deepEqual(wrapText(ctx, "", 50, 2), []);
  assert.deepEqual(wrapText(ctx, "supercalifragilistic", 50, 3), ["super", "calif", "ragi…"]);
});

test("the card shows name, purpose, stars and the app name", () => {
  const ctx = new RecordingContext();
  drawShareCard(ctx, { name: "pdf", purpose: "读取和处理 PDF 文件", stars: 12345, category: "办公" });
  const texts = ctx.texts.map((entry) => entry.text);
  assert.ok(texts.includes("pdf"));
  assert.ok(texts.some((text) => text.includes("读取和处理")));
  assert.ok(texts.includes("★ 1.2万 Star"));
  assert.ok(texts.includes(APP_TITLE));
  assert.ok(texts.includes("AI 技能 · 办公"));
  assert.deepEqual(ctx.rects[0], { x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT });
  assert.ok(ctx.texts.every((entry) => entry.y >= 0 && entry.y <= CARD_HEIGHT));
});

test("a skill without a star count still gets a footer", () => {
  const ctx = new RecordingContext();
  drawShareCard(ctx, { name: "x", purpose: "y", stars: null });
  assert.ok(ctx.texts.some((entry) => entry.text === "★ 开源技能"));
  assert.ok(ctx.texts.some((entry) => entry.text === "AI 技能推荐"));
});

const globals = globalThis as typeof globalThis & { wx: unknown };

function mockCanvas(t: TestContext, options: { node?: unknown; exportFails?: boolean; neverExports?: boolean } = {}) {
  const original = globals.wx;
  const exported: Array<Record<string, unknown>> = [];
  const ctx = new RecordingContext();
  const node = options.node === undefined ? { width: 0, height: 0, getContext: () => ctx } : options.node;
  globals.wx = {
    createSelectorQuery: () => ({
      select: () => ({ fields: () => ({ exec: (callback: (result: unknown[]) => void) => callback([{ node }]) }) }),
    }),
    canvasToTempFilePath: (request: Record<string, unknown> & { success(r: { tempFilePath: string }): void; fail(): void }) => {
      exported.push(request);
      if (options.neverExports) return;
      if (options.exportFails) request.fail(); else request.success({ tempFilePath: "wxfile://card.jpg" });
    },
  };
  t.after(() => { globals.wx = original; });
  return { exported, ctx, node: node as { width: number; height: number } | null };
}

test("rendering exports a 5:4 JPEG from the page canvas", async (t) => {
  const { exported, ctx, node } = mockCanvas(t);
  const path = await renderShareCard("#share-canvas", { name: "pdf", purpose: "用途", stars: 5 });
  assert.equal(path, "wxfile://card.jpg");
  assert.equal(node?.width, CARD_WIDTH);
  assert.equal(node?.height, CARD_HEIGHT);
  assert.ok(ctx.texts.length > 0);
  assert.equal(exported[0].fileType, "jpg");
  assert.equal(exported[0].canvas, node);
});

test("any rendering failure resolves to null so the default image is used", async (t) => {
  mockCanvas(t, { exportFails: true });
  assert.equal(await renderShareCard("#share-canvas", { name: "a", purpose: "b", stars: 1 }), null);

  mockCanvas(t, { node: null });
  assert.equal(await renderShareCard("#share-canvas", { name: "a", purpose: "b", stars: 1 }), null);

  mockCanvas(t, { node: { width: 0, height: 0, getContext: () => { throw new Error("no 2d"); } } });
  assert.equal(await renderShareCard("#share-canvas", { name: "a", purpose: "b", stars: 1 }), null);

  globals.wx = {};
  assert.equal(await renderShareCard("#share-canvas", { name: "a", purpose: "b", stars: 1 }), null);
});

test("a canvas that never answers times out to null", async (t) => {
  mockCanvas(t, { neverExports: true });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = renderShareCard("#share-canvas", { name: "a", purpose: "b", stars: 1 });
  t.mock.timers.tick(3000);
  assert.equal(await pending, null);
});
