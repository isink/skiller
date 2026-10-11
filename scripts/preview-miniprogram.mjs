#!/usr/bin/env node
// Renders approximate 375px previews of the mini program pages in every colour theme.
// This is NOT the WeChat renderer: WXML is evaluated with a tiny interpreter and drawn by Chrome (rpx -> px at 0.5).
// Usage: node scripts/preview-miniprogram.mjs [--out <dir>] [--themes id,id] [--pages landing,home,radar]
// Output: <out>/<theme>-<page>.png (375x812 @2x) and <out>/comparison.png (all themes side by side).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES } from "./miniprogram-themes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MP = join(HERE, "..", "miniprogram");
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const OUT = arg("out", join(HERE, "..", "preview-out"));
const THEME_IDS = arg("themes", Object.keys(THEMES).join(",")).split(",");
const PAGES = arg("pages", "landing,home,radar").split(",");
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
const TAG = { view: "div", text: "span", "scroll-view": "div", image: "img", input: "input", "rich-text": "div" };

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
  .replace(/env\(safe-area-inset-bottom\)/g, "34px");
const BASE_CSS = `*::-webkit-scrollbar{display:none}body{margin:0;width:375px}div,span,img,input{box-sizing:border-box}
.wx-view,.wx-scroll-view,.wx-rich-text{display:block}.wx-scroll-view{overflow-x:auto}
.wx-text{display:inline}.wx-image{display:inline-block}input{font-family:inherit;outline:none}`;

/* ---------- sample data ---------- */
const sk = (id, name, desc, cat, author, featured) => ({ id, name, featured, displayDescription: desc, displayCategory: cat, author, displayStars: "来源仓库 Star 12,480 · 2026-10-08 核对", displayUpdated: "技能更新于 2026-10-02" });
const skills = [
  sk("1", "frontend-design", "创建有辨识度、可用于生产环境的前端界面，避免千篇一律的 AI 风格，注重排版、色彩与动效细节。", "设计", "anthropics", true),
  sk("2", "pdf-toolkit", "读取、合并、拆分与填写 PDF 表单。", "文档", "doc-lab", false),
  sk("3", "deep-research", "围绕一个主题自动检索、交叉验证并生成带引用的调研报告。", "调研研究", "open-research", true),
];
const categories = [{ id: 1, slug: "official", name: "官方精选" }, { id: 2, slug: "code", name: "编程开发" }, { id: 3, slug: "design", name: "设计" }, { id: 4, slug: "docs", name: "文档" }];
const term = (t, s, score, heat, status) => ({ term: t, displaySummary: s, score, displayScore: score == null ? "-" : `${Math.round(score * 100)}分`, displayHeat: heat, displayDate: "2026年10月8日", status, displayStatus: status || "待观察" });
const DATA = {
  landing: {},
  home: { query: "", featured: skills, latest: skills.slice(1), categories, counts: { official: 24, code: 132, design: 41, docs: 58 }, results: [], searching: false, loading: false, error: "" },
  radar: { loading: false, error: "", hasMore: false, showDetail: false, selectedTerm: null, terms: [
    term("Vibe Coding", "用自然语言描述意图，由模型生成并迭代代码的一种开发方式，近期社区讨论热度快速攀升。", 0.86, "2.4万", "已转选题"),
    term("Context Engineering", "为模型精心组织上下文信息的工程实践。", 0.72, "8.1k", "已命中"),
    term("Agent Harness", "围绕智能体的运行外壳。", 0.31, "560", "未命中"),
    term("Memory Layer", "跨会话保存与检索信息的组件。", null, "-", null),
  ] },
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
  const icons = join(work, `icons-${id}`);
  const r = spawnSync("node", [join(HERE, "render-miniprogram-icons.mjs"), "--theme", id, "--out", icons, "--port", String(9360 + i)], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`icon render failed for ${id}`);
  const override = `:root,body{${Object.entries(theme.tokens).map(([k, v]) => `${k}:${v}`).join(";")}}`;
  await withChrome(9370 + i, async (send) => {
    for (const page of PAGES) {
      const withTabbar = page === "home";
      const body = render(parse(rd(`pages/${page}/index.wxml`)), DATA[page], { icons });
      const css = toCss(["app.wxss", `pages/${page}/index.wxss`, ...(withTabbar ? ["components/skill-tabbar/index.wxss"] : [])]);
      const html = join(work, `${id}-${page}.html`);
      writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}${override}</style></head><body>${body}</body></html>`);
      const out = join(OUT, `${id}-${page}.png`);
      await shoot(send, html, { width: 375, height: 812, scale: 2, out });
      written.push(out);
    }
  });
}

const sheetPages = ["landing", "radar"].filter((p) => PAGES.includes(p));
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
