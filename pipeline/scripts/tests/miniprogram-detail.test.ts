import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Skill } from "../../../miniprogram/types/skill";

type Share = { title: string; path: string; imageUrl?: string; promise?: Promise<{ title: string; path: string; imageUrl?: string }> };
type DetailPage = {
  data: Record<string, any>;
  _cardPath: string;
  _cardKey: string;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  showSkill(skill: Skill, clearError: boolean): void;
  onCopyInstall(): void;
  onCopyAlternative(event: { currentTarget: { dataset: { index: number } } }): void;
  onCopySource(): void;
  onFeedback(): void;
  onShareAppMessage(event?: { from?: string }): Share;
  onShareTimeline(): { title: string; query: string };
};

const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: Omit<DetailPage, "setData">;
const originalPage = globals.Page;
globals.Page = (page: typeof definition) => { definition = page; };
require("../../../miniprogram/pages/detail/index");
globals.Page = originalPage;

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
    skill_md_content: "---\nname: pdf-reader\nlicense: MIT\n---\n# PDF",
    ...overrides,
  };
}

function harness(t: TestContext, options: { exportFails?: boolean } = {}) {
  const original = globals.wx;
  const events: Array<Record<string, any>> = [];
  const clipboard: string[] = [];
  const toasts: string[] = [];
  const modals: Array<Record<string, any>> = [];
  globals.wx = {
    getStorageSync: () => "",
    setStorageSync() {},
    setNavigationBarTitle() {},
    showToast: ({ title }: { title: string }) => { toasts.push(title); },
    setClipboardData: ({ data, success }: { data: string; success(): void }) => { clipboard.push(data); success(); },
    showModal: (modal: Record<string, any>) => { modals.push(modal); },
    request: ({ url, data, success }: { url: string; data: Record<string, any>; success(r: { statusCode: number }): void }) => {
      if (url.endsWith("/rest/v1/mp_events")) events.push(data);
      success({ statusCode: 201 });
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
      if (options.exportFails) fail(); else success({ tempFilePath: "wxfile://detail-card.jpg" });
    },
  };
  t.after(() => { globals.wx = original; });
  const page: DetailPage = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) { Object.assign(this.data, patch); callback?.(); },
  };
  return { page, events, clipboard, toasts, modals };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("the detail page leads with the WorkBuddy request, then the terminal command, steps, source link and license", (t) => {
  const { page } = harness(t);
  const skill = makeSkill();
  page.showSkill(skill, true);
  assert.equal(page.data.installKind, "workbuddy");
  assert.equal(page.data.installCopyLabel, "复制给 WorkBuddy");
  assert.equal(page.data.installCommand, `请帮我安装这个 Skill：${skill.name}\n来源：https://github.com/acme/tools/tree/main/skills/pdf\n装进你的技能里，装好后用一句话告诉我它能做什么、怎么用。`);
  assert.deepEqual(page.data.installAlternatives, [
    { label: "终端安装（需 Node.js）", command: "npx skills add https://github.com/acme/tools/tree/main/skills/pdf --skill pdf-reader" },
  ]);
  assert.equal(page.data.installSteps.length, 3);
  assert.equal(page.data.sourceUrl, "https://github.com/acme/tools/tree/main/skills/pdf");
  assert.equal(page.data.displayLicense, "MIT");
});

test("copying the install command reports a copy_install event", async (t) => {
  const { page, clipboard, toasts, events } = harness(t);
  const skill = makeSkill();
  page.showSkill(skill, true);
  page.onCopyInstall();
  await settle();

  assert.deepEqual(clipboard, [page.data.installCommand]);
  assert.deepEqual(toasts, ["已复制，粘贴给WorkBuddy就能装"]);
  const event = events.find((row) => row.event === "copy_install");
  assert.ok(event);
  assert.equal(event.page, "pages/detail/index");
  assert.deepEqual(event.meta, { action: "copy_install", id: skill.id, slug: skill.slug, kind: "workbuddy", target: "primary" });
});

test("a source that points at no skill folder copies the GitHub link", async (t) => {
  const { page, clipboard, toasts, events } = harness(t);
  page.showSkill(makeSkill({ skill_md_content: "no frontmatter", github_url: "https://github.com/acme/tools/pulls" }), true);
  page.onCopyInstall();
  await settle();
  assert.deepEqual(clipboard, ["https://github.com/acme/tools/pulls"]);
  assert.deepEqual(toasts, ["GitHub 链接已复制，分享给朋友一起看"]);
  assert.equal(events.find((row) => row.event === "copy_install")?.meta.kind, "link");
});

test("alternatives and the source link are copied and reported separately", async (t) => {
  const { page, clipboard, events } = harness(t);
  page.showSkill(makeSkill({ github_url: "https://github.com/acme/tidy", skill_md_content: "---\nname: tidy\n---\n" }), true);
  page.onCopyAlternative({ currentTarget: { dataset: { index: 1 } } });
  page.onCopySource();
  page.onCopyAlternative({ currentTarget: { dataset: { index: 9 } } });
  await settle();
  assert.deepEqual(clipboard, ["git clone https://github.com/acme/tidy.git ~/.claude/skills/tidy", "https://github.com/acme/tidy"]);
  assert.deepEqual(events.filter((row) => row.event === "copy_install").map((row) => row.meta.target).sort(), ["alternative", "source_link"]);
});

test("a failed clipboard write reports nothing", async (t) => {
  const { page, events } = harness(t);
  page.showSkill(makeSkill(), true);
  (globals.wx as { setClipboardData: unknown }).setClipboardData = ({ fail }: { fail(): void }) => fail();
  page.onCopyInstall();
  await settle();
  assert.equal(events.filter((row) => row.event === "copy_install").length, 0);
});

test("sharing uses 技能名｜一句中文用途 and the generated 5:4 cover", async (t) => {
  const { page, events } = harness(t);
  const skill = makeSkill({ name: "pdf" });
  page.showSkill(skill, true);
  await settle();

  const share = page.onShareAppMessage({ from: "button" });
  assert.equal(share.title, "pdf｜读取和处理 PDF 文件");
  assert.equal(share.path, `/pages/detail/index?id=${encodeURIComponent(skill.id)}`);
  assert.equal(share.imageUrl, "wxfile://detail-card.jpg");
  const event = events.find((row) => row.event === "share");
  assert.deepEqual(event?.meta, { action: "share", id: skill.id, slug: skill.slug, channel: "button", card: true });
});

test("when the cover is not ready yet the share sheet waits for it", async (t) => {
  const { page } = harness(t);
  page.showSkill(makeSkill({ name: "pdf" }), true);
  page._cardPath = "";
  page._cardKey = "";
  const share = page.onShareAppMessage();
  assert.equal(share.imageUrl, undefined);
  const resolved = await share.promise;
  assert.equal(resolved?.imageUrl, "wxfile://detail-card.jpg");
  assert.equal(resolved?.title, share.title);
  assert.equal(resolved?.path, share.path);
});

test("a cover that fails to render falls back to the default image", async (t) => {
  const { page } = harness(t, { exportFails: true });
  page.showSkill(makeSkill({ name: "pdf" }), true);
  await settle();
  const share = page.onShareAppMessage({ from: "menu" });
  const resolved = await share.promise;
  assert.equal(resolved?.imageUrl, undefined);
  assert.match(resolved?.title ?? "", /^pdf｜/);
  assert.equal(share.title, resolved?.title);
});

test("the timeline share reports the event too", (t) => {
  const { page, events } = harness(t);
  const skill = makeSkill({ name: "pdf" });
  page.showSkill(skill, true);
  const share = page.onShareTimeline();
  assert.equal(share.title, "pdf｜读取和处理 PDF 文件");
  assert.equal(share.query, `id=${encodeURIComponent(skill.id)}`);
  assert.equal(events.find((row) => row.event === "share")?.meta.channel, "timeline");
});

test("a curated skill shows what to say to WorkBuddy and links back to its collection", async (t) => {
  const { page, clipboard, toasts, events } = harness(t);
  const navigations: string[] = [];
  (globals.wx as { navigateTo: unknown }).navigateTo = ({ url }: { url: string }) => { navigations.push(url); };
  const skill = makeSkill({ slug: "meeting-notes" });
  page.showSkill(skill, true);
  assert.equal(page.data.usageSay.length, 2);
  assert.deepEqual(page.data.usageScene, { slug: "docs", title: "会议与写作" });
  assert.equal(page.data.usageHeadline, "会议记录 → 结论、待办、负责人");
  assert.equal(page.data.displayName, "会议纪要助手");
  assert.equal(page.data.englishName, skill.name);
  assert.match(page.data.displayDescription, /^开完会要发纪要时用/);
  assert.equal(page.data.usagePrepare, "会议记录或录音转写稿");
  assert.equal(page.onShareAppMessage().title, "会议纪要助手｜会议记录 → 结论、待办、负责人");
  assert.equal(page.data.usageExample, null);
  assert.equal(page.data.markdownOpen, false);
  (page as unknown as { onToggleMarkdown(): void }).onToggleMarkdown();
  assert.equal(page.data.markdownOpen, true);
  page.showSkill(skill, true);
  assert.equal(page.data.markdownOpen, true, "a refresh keeps the reader's choice");

  const detail = page as unknown as { onCopyUsage(e: unknown): void; openScene(e: unknown): void };
  detail.onCopyUsage({ currentTarget: { dataset: { index: 1 } } });
  await settle();
  assert.deepEqual(clipboard, [page.data.usageSay[1]]);
  assert.deepEqual(toasts, ["已复制，装好技能后发给WorkBuddy"]);
  assert.deepEqual(events.find((row) => row.event === "copy_install")?.meta, { action: "copy_install", id: skill.id, slug: "meeting-notes", kind: "workbuddy", target: "usage" });
  detail.openScene({ currentTarget: { dataset: { slug: "docs" } } });
  assert.deepEqual(navigations, ["/pages/scene/index?slug=docs"]);
});

test("a skill outside the collections shows no usage block", (t) => {
  const { page } = harness(t);
  page.showSkill(makeSkill(), true);
  assert.deepEqual(page.data.usageSay, []);
  assert.equal(page.data.usageScene, null);
  assert.equal(page.data.usageHeadline, "");
  assert.equal(page.data.displayName, page.data.skill.name);
  assert.equal(page.data.englishName, "");
  assert.equal(page.data.markdownOpen, true);
});

test("a reader votes once per skill and the vote is reported and remembered", async (t) => {
  const { page, events } = harness(t);
  const stored = new Map<string, unknown>();
  Object.assign(globals.wx as object, {
    getStorageSync: (key: string) => stored.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => { stored.set(key, value); },
  });
  const skill = makeSkill();
  page.showSkill(skill, true);
  assert.equal(page.data.vote, "");
  const detail = page as unknown as { onVote(e: unknown): void };
  detail.onVote({ currentTarget: { dataset: { vote: "down" } } });
  detail.onVote({ currentTarget: { dataset: { vote: "up" } } });
  await settle();
  assert.equal(page.data.vote, "down");
  const votes = events.filter((row) => row.event === "feedback");
  assert.equal(votes.length, 1);
  assert.deepEqual(votes[0].meta, { action: "feedback", id: skill.id, slug: skill.slug, vote: "down" });

  page.data.vote = "";
  page.showSkill(skill, true);
  assert.equal(page.data.vote, "down", "a returning reader is not asked again");
});

test("the SKILL.md text never goes into page data, and markdown is sent only while shown", (t) => {
  const { page } = harness(t);
  const patches: Array<Record<string, unknown>> = [];
  const setData = page.setData;
  page.setData = function (patch, callback) { patches.push(patch); setData.call(this, patch, callback); };
  const markdown = `---\nname: meeting-notes\n---\n# Meeting notes\n\n${"Turn raw notes into minutes. ".repeat(400)}`;
  const curated = makeSkill({ slug: "meeting-notes", skill_md_content: markdown });

  page.showSkill(curated, true);
  assert.equal(page.data.skill.skill_md_content, null);
  assert.equal(page.data.installKind, "workbuddy", "the install plan still reads the full skill");
  assert.ok(!("blocks" in patches[0]), "a folded SKILL.md is not parsed or sent");
  assert.ok(JSON.stringify(patches[0]).length < markdown.length / 2, "the first render is far smaller than the SKILL.md");

  page.showSkill(curated, true);
  assert.ok(!("blocks" in patches[1]));
  (page as unknown as { onToggleMarkdown(): void }).onToggleMarkdown();
  assert.ok(Array.isArray(patches[2].blocks) && (patches[2].blocks as unknown[]).length > 0, "opening it sends the blocks once");
  page.showSkill(curated, true);
  assert.ok(!("blocks" in patches[3]), "an unchanged refresh does not resend them");
  page.showSkill({ ...curated, skill_md_content: `${markdown}\n\n## Changed` }, true);
  assert.ok("blocks" in patches[4], "changed text while open is sent again");
});

test("a skill outside the collections shows its SKILL.md right away", (t) => {
  const { page } = harness(t);
  page.showSkill(makeSkill(), true);
  assert.equal(page.data.markdownOpen, true);
  assert.ok(page.data.blocks.length > 0);
  assert.equal(page.data.skill.skill_md_content, null);
});

test("terminal commands start folded under the WorkBuddy request and open on tap", (t) => {
  const { page } = harness(t);
  page.showSkill(makeSkill(), true);
  assert.equal(page.data.installKind, "workbuddy");
  assert.ok(page.data.installAlternatives.length > 0);
  assert.equal(page.data.altsOpen, false);
  (page as unknown as { onToggleAlternatives(): void }).onToggleAlternatives();
  assert.equal(page.data.altsOpen, true);
});
