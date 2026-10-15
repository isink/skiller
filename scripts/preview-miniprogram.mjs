#!/usr/bin/env node
// Renders approximate 375px previews of the mini program pages in every colour theme.
// This is NOT the WeChat renderer: WXML is evaluated with a tiny interpreter and drawn by Chrome (rpx -> px at 0.5).
// Usage: node scripts/preview-miniprogram.mjs [--out <dir>] [--themes id,id] [--pages landing,home,radar]
//        node scripts/preview-miniprogram.mjs --applied [--height 1800] [--out <dir>] [--pages landing,home,radar,detail,radar-latest]
// Calendar / saved-term samples: --applied --pages radar-latest,radar-calendar,favorites-radar
// The TypeScript-only fixture helpers use Node's built-in type stripping (Node 22.18+ / 24+).
// Default output: <out>/<theme>-<page>.png (375x812 @2x) and <out>/comparison.png (all themes side by side).
// --applied renders the app exactly as shipped (app.wxss + assets/icons, no theme override) to <out>/<page>.png.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES } from "./miniprogram-themes.mjs";
import { buildMonthDays, buildRecentDays } from "../miniprogram/services/radar-calendar.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MP = join(HERE, "..", "miniprogram");
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const OUT = arg("out", join(HERE, "..", "preview-out"));
const APPLIED = process.argv.includes("--applied");
const HEIGHT = Number(arg("height", 812));
const THEME_IDS = APPLIED ? ["applied"] : arg("themes", Object.keys(THEMES).join(",")).split(",");
const PAGES = arg("pages", APPLIED ? "landing,home,radar,detail,radar-latest" : "landing,home,radar").split(",");
const CHROME = process.env.CHROME || "google-chrome-stable";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (p) => readFileSync(join(MP, p), "utf8");

/* ---------- minimal WXML interpreter ---------- */
function parse(src) {
  const root = { children: [] }; const stack = [root];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:.-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g; let m;
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) { stack.at(-1).children.push({ text: m[5] }); continue; }
    if (m[1]) { stack.pop(); continue; }
    const attrs = {}; for (const a of m[3].matchAll(/([\w:.-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? "";
    const node = { tag: m[2], attrs, children: [] }; stack.at(-1).children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root.children;
}
const strip = (v) => v.replace(/^\{\{|\}\}$/g, "");
const ev = (expr, scope) => { try { return new Function("scope", `with(scope){return (${expr})}`)(scope); } catch (e) { console.error("EXPR FAIL", expr, e.message); return ""; } };
const interp = (s, scope) => s.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => { const v = ev(e, scope); return v == null ? "" : v; });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const TAG = { view: "div", text: "span", button: "button", "scroll-view": "div", image: "img", input: "input", "rich-text": "div" };

function render(nodes, scope, ctx) {
  let out = ""; let prevIf = null;
  for (const n of nodes) {
    if (n.text !== undefined) { out += esc(interp(n.text, scope)); continue; }
    const a = n.attrs;
    if ("wx:elif" in a || "wx:else" in a) {
      if (prevIf) continue;
      if ("wx:elif" in a && !ev(strip(a["wx:elif"]), scope)) continue;
      prevIf = true;
    } else if ("wx:if" in a) {
      prevIf = !!ev(strip(a["wx:if"]), scope);
      if (!prevIf) continue;
    } else prevIf = null;
    if ("wx:for" in a) (ev(strip(a["wx:for"]), scope) || []).forEach((item, index) => { out += one(n, { ...scope, item, index }, ctx); });
    else out += one(n, scope, ctx);
  }
  return out;
}
function one(n, scope, ctx) {
  const a = n.attrs;
  if (n.tag === "block") return render(n.children, scope, ctx);
  if (n.tag === "skill-tabbar") return render(parse(rd("components/skill-tabbar/index.wxml")), { active: a.active }, ctx);
  if (n.tag === "rich-text") {
    const nodes = ev(strip(a.nodes), scope) || [];
    return `<div class="wx-rich-text">${nodes.map((x) => (x.type === "text" ? esc(x.text) : `<${x.name}>${esc(x.children[0].text)}</${x.name}>`)).join("")}</div>`;
  }
  const tag = TAG[n.tag] || "div";
  let attrs = ` class="wx-${n.tag} ${a.class !== undefined ? interp(a.class, scope).trim() : ""}"`;
  if (a.style) attrs += ` style="${interp(a.style, scope)}"`;
  if (n.tag === "image") attrs += ` src="file://${ctx.icons}${interp(a.src, scope).replace("/assets/icons", "")}"`;
  if (n.tag === "input") attrs += ` placeholder="${a.placeholder}" value="${interp(a.value || "", scope)}"`;
  if (tag === "img" || tag === "input") return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${render(n.children, scope, ctx)}</${tag}>`;
}
const toCss = (files) => files.map(rd).join("\n")
  .replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${parseFloat(n) / 2}px`)
  .replace(/(^|[\s,}])page\s*\{/g, "$1:root,body{")
  .replace(/(^|[,\s>+~])text(?=[\s,.#:\[{>+~])/g, "$1.wx-text")
  .replace(/env\(safe-area-inset-bottom\)/g, "34px");
const BASE_CSS = `*::-webkit-scrollbar{display:none}body{margin:0;width:375px}div,span,img,input{box-sizing:border-box}
.wx-view,.wx-scroll-view,.wx-rich-text{display:block}.wx-scroll-view{overflow-x:auto}
.wx-text{display:inline}.wx-image{display:inline-block}input{font-family:inherit;outline:none}
button{font-family:inherit;border:0;box-sizing:border-box;cursor:pointer}`;

/* ---------- sample data ---------- */
const sk = (id, name, desc, cat, author, featured, fresh = {}) => ({ id, name, featured, displayDescription: desc, displayCategory: cat, author, displayStars: "来源仓库 Star 12,480 · 2026-10-08 核对", displayUpdated: "技能更新于 2026-10-02", displayGrowth: "", displayAdded: "", displayRepoNote: "", ...fresh });
const skills = [
  sk("1", "frontend-design", "创建有辨识度、可用于生产环境的前端界面，避免千篇一律的 AI 风格，注重排版、色彩与动效细节。", "设计", "anthropics", true),
  sk("2", "pdf-toolkit", "读取、合并、拆分与填写 PDF 表单。", "文档", "doc-lab", false),
  sk("3", "deep-research", "围绕一个主题自动检索、交叉验证并生成带引用的调研报告。", "调研研究", "open-research", true),
];
const hot = [
  sk("11", "frontend-design", "创建有辨识度、可用于生产环境的前端界面，注重排版、色彩与动效细节。", "设计", "anthropics", true, { displayGrowth: "本周 +1,284⭐", displayAdded: "12 天前收录", displayRepoNote: "同仓库 16 个技能" }),
  sk("12", "deep-research", "围绕一个主题自动检索、交叉验证并生成带引用的调研报告。", "调研研究", "open-research", false, { displayGrowth: "本周 +342⭐", displayAdded: "3 天前收录" }),
  sk("13", "pdf-toolkit", "读取、合并、拆分与填写 PDF 表单。", "文档", "doc-lab", false, { displayGrowth: "本周 +57⭐" }),
];
const latest = [
  sk("21", "sql-explainer", "把复杂 SQL 拆解成通俗步骤，并指出潜在的性能问题。", "数据", "data-folks", false, { displayAdded: "今天收录" }),
  sk("22", "release-notes", "根据提交记录自动整理面向用户的发布说明。", "文档", "ship-it", false, { displayAdded: "2 天前收录" }),
];
const categories = [{ id: 1, slug: "official", name: "官方精选" }, { id: 2, slug: "code", name: "编程开发" }, { id: 3, slug: "design", name: "设计" }, { id: 4, slug: "docs", name: "文档" }];
// Illustration fixtures only: the actual mini program always requests live API data.
const term = (t, s, score, count, needsRetry = false) => ({
  term: t, displaySummary: s || "简介待补充", score,
  displayScore: score == null ? "-" : `${Math.round(score * 100)}分`,
  displayHeat: "-", displayDate: "2026年10月12日", displayDateGroup: "10月12日发现",
  hasSummary: !!s, hasScore: Number.isFinite(score), hasHeat: false,
  popularity_platform: "github", popularity_count: count,
  popularity_checked_at: "2026-10-12T13:07:00Z", popularity_status: needsRetry ? "error" : "ok",
  displayPopularity: count.toLocaleString("en-US"), displayPopularityLabel: "GitHub Star",
  displayPopularityCheckedAt: "10月12日 21:07", hasPopularity: true,
  popularityNeedsRetry: needsRetry, popularityIsStale: false,
  isFavorite: false,
});
const terms = [
  term("Claude Obsidian", "将 Obsidian 笔记接入 Claude Code，作为可查阅的长期记忆。", 0.86, 12840),
  term("Grimoire", "为 AI 编程助手整理可复用的提示词与技能。", 0.72, 8160),
  term("Bot Bridge", "连接远程 AI 助手与本地 Obsidian 知识库。", 0.68, 5680, true),
  term("Memory Layer", "跨会话保存与检索信息的组件。", null, 3480),
];
const discovery = (name, summary, score, day = "15", isFavorite = false) => ({
  ...term(name, summary, score, 0),
  popularity_platform: null, popularity_count: null, popularity_checked_at: null,
  hasPopularity: false, isFavorite,
  displayDate: `2026年10月${day}日`, displayDateGroup: `10月${day}日发现`,
});
const discoveries = [
  discovery("house-control", "Mac 菜单栏里的开源 3D 智能家居控制。", 0.82),
  discovery("graphicle", "本地代码图谱与记忆，给编程智能体用。", 0.81, "15", true),
  discovery("Ultramarine 1 Flash", "Paper Instruments 出的知识工作开源模型。", 0.79, "15", true),
  discovery("Hermes Agent", "Nous 开源智能体桌面版更新。", 0.78),
  discovery("Petal", "开源结对编程与窗口级屏幕共享工具。", 0.76),
];
const previousDiscoveries = [
  discovery("LFM2.5-24B-A2B", "Liquid AI 的 24B MoE 端侧模型，激活约 2B，多语言。", 0.82, "14"),
  discovery("Drama 3", "Fish 开源可控情感 TTS 模型。", 0.80, "14", true),
  discovery("TrellisWM", "macOS 分栏窗口管理器，支持跨应用停靠、分页和嵌套窗口。", 0.77, "14"),
];
const calendarFixture = (selectedDate = "2026-10-15", expanded = false) => ({
  today: "2026-10-15", selectedDate,
  selectedDateLabel: selectedDate ? `2026年10月${Number(selectedDate.slice(8))}日` : "全部日期",
  calendarExpanded: expanded, calendarMonth: "2026-10", calendarMonthLabel: "2026年10月",
  canNextMonth: false, weekdays: ["一", "二", "三", "四", "五", "六", "日"],
  recentDays: buildRecentDays("2026-10-15", selectedDate),
  monthDays: buildMonthDays("2026-10", selectedDate, "2026-10-15"),
});
const t = (text) => ({ type: "text", text });
const el = (name, text) => ({ name, children: [t(text)] });
const DETAIL = {
  loading: false, error: "", favorited: true, displayCategory: "设计",
  skill: { name: "frontend-design", tags: ["代码", "前端", "界面"], author: "anthropics" },
  displayDescription: skills[0].displayDescription, displayStars: skills[0].displayStars, displayUpdated: skills[0].displayUpdated,
  installCommand: "npx skills add https://github.com/anthropics/skills/tree/main/skills/frontend-design --skill frontend-design",
  installHint: "在已安装 Node.js 的电脑终端运行，按提示选择要安装到的 AI 工具。",
  blocks: [
    { type: "heading", level: 1, inline: [t("前端设计指南")] },
    { type: "paragraph", inline: [t("当你需要构建网页组件或整页界面时使用，请先运行 "), el("code", "npx skills add"), t(" 并阅读 "), el("strong", "注意事项"), t("。")] },
    { type: "heading", level: 2, inline: [t("使用方式")] },
    { type: "list", inline: [t("• 先确定视觉方向与排版")] },
    { type: "list", inline: [t("• 再选择配色与动效")] },
    { type: "quote", inline: [t("好的设计从约束开始。")] },
    { type: "code", text: "# 在 AI 工具中调用已安装的技能\n# 描述你的页面目标与约束" },
    { type: "rule", inline: [] },
    { type: "paragraph", inline: [t("更多细节见下文。")] },
  ],
};
const DATA = {
  landing: {},
  detail: DETAIL,
  home: { query: "", hot, featured: skills, latest, categories, counts: { official: 24, code: 132, design: 41, docs: 58 }, results: [], searching: false, loading: false, error: "" },
  radar: {
    loading: false, error: "", hasMore: false, terms,
    mode: "github", boardAvailable: true, displayCheckedAt: "10月12日 21:07", hasPendingUpdate: false,
    favoriteCount: 3,
    ...calendarFixture(""),
  },
};
DATA["radar-latest"] = { ...DATA.radar, ...calendarFixture(), mode: "latest", terms: discoveries };
DATA["radar-calendar"] = { ...DATA["radar-latest"], ...calendarFixture("2026-10-14", true), terms: previousDiscoveries };
DATA["favorites-radar"] = {
  tab: "radar", skills, loading: false, error: "", radarFavorites: [discoveries[2], discoveries[1], previousDiscoveries[1]],
};
const PAGE_OF = {
  "radar-latest": "radar", "radar-calendar": "radar",
  "favorites-radar": "favorites",
};

/* ---------- Chrome (CDP) ---------- */
async function withChrome(port, fn) {
  const profile = mkdtempSync(join(tmpdir(), "mp-preview-"));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--hide-scrollbars", "--no-sandbox", "--disable-gpu", "about:blank"], { stdio: "ignore", detached: true });
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((p) => p.type === "page"); } catch { /* not ready */ }
      if (!target) await sleep(200);
    }
    if (!target) throw new Error("Chrome did not start");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0; const pending = new Map();
    ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
    await send("Page.enable");
    await fn(send);
    ws.close();
  } finally {
    try { process.kill(-chrome.pid); } catch { /* exited */ }
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
async function shoot(send, file, { width, height, scale, out }) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
  await send("Page.navigate", { url: `file://${file}` });
  await sleep(700);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(data, "base64"));
}

/* ---------- main ---------- */
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "mp-preview-html-"));
const written = [];

for (const [i, id] of THEME_IDS.entries()) {
  const theme = THEMES[id];
  let icons = join(MP, "assets", "icons");
  let override = "";
  if (!APPLIED) {
    icons = join(work, `icons-${id}`);
    const r = spawnSync("node", [join(HERE, "render-miniprogram-icons.mjs"), "--theme", id, "--out", icons, "--port", String(9360 + i)], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`icon render failed for ${id}`);
    override = `:root,body{${Object.entries(theme.tokens).map(([k, v]) => `${k}:${v}`).join(";")}}`;
  }
  await withChrome(9370 + i, async (send) => {
    for (const page of PAGES) {
      const dir = PAGE_OF[page] || page;
      const withTabbar = dir === "home" || dir === "favorites";
      const body = render(parse(rd(`pages/${dir}/index.wxml`)), DATA[page], { icons });
      const css = toCss(["app.wxss", `pages/${dir}/index.wxss`, ...(withTabbar ? ["components/skill-tabbar/index.wxss"] : [])]);
      const html = join(work, `${id}-${page}.html`);
      writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}${override}</style></head><body>${body}</body></html>`);
      const out = join(OUT, APPLIED ? `${page}.png` : `${id}-${page}.png`);
      await shoot(send, html, { width: 375, height: HEIGHT, scale: 2, out });
      written.push(out);
    }
  });
}

const sheetPages = APPLIED ? [] : ["landing", "radar"].filter((p) => PAGES.includes(p));
if (sheetPages.length) {
  const cell = (id, page) => `<figure><img src="file://${join(OUT, `${id}-${page}.png`)}" width="375" height="812"></figure>`;
  const cols = THEME_IDS.map((id) => `<section><h2>${THEMES[id].name}<small>${id} · ${THEMES[id].mode}</small></h2>${sheetPages.map((p) => cell(id, p)).join("")}</section>`).join("");
  const html = join(work, "comparison.html");
  const width = THEME_IDS.length * 375 + (THEME_IDS.length + 1) * 32;
  const height = 96 + sheetPages.length * (812 + 24) + 40;
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;width:${width}px;background:#d9d9de;font-family:-apple-system,"PingFang SC","Noto Sans CJK SC",sans-serif}
    main{display:flex;gap:32px;padding:0 32px}section{width:375px}
    h2{margin:28px 0 16px;font-size:22px;color:#1b1b20}h2 small{margin-left:10px;font-size:13px;font-weight:400;color:#666}
    figure{margin:0 0 24px;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.25)}img{display:block}
  </style></head><body><main>${cols}</main></body></html>`);
  await withChrome(9390, async (send) => {
    const out = join(OUT, "comparison.png");
    await shoot(send, html, { width, height, scale: 1, out });
    written.push(out);
  });
}
rmSync(work, { recursive: true, force: true });
console.log(written.join("\n"));
