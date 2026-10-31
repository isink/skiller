#!/usr/bin/env node
// Renders one 3:4 poster per WorkBuddy scene (miniprogram/services/scenes.ts) for posting outside the
// mini program, in two versions:
//   xhs     小红书：no WeChat entry point (the platform limits posts that send people to WeChat)
//   wechat  朋友圈 / 群：adds how to open the mini program, plus its code when one is provided
// Usage: node scripts/render-scene-posters.mjs [--out <dir>] [--qr-dir <dir>]
// A mini program code for a scene is read from <qr-dir>/<scene>.png (default docs/marketing/qr/); without
// one the WeChat version shows the search instruction only. Needs Node 22.6+ (imports the .ts directly)
// and Google Chrome (set CHROME to override).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { SCENES } from "../miniprogram/services/scenes.ts";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = arg("out", join(ROOT, "docs", "marketing", "posters"));
const QR_DIR = arg("qr-dir", join(ROOT, "docs", "marketing", "qr"));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1080;
const HEIGHT = 1440;
const APP_NAME = "头山 AI 工具箱";

// Who each scene is for, as the poster headline says it.
const AUDIENCE = {
  excel: "天天做表的人",
  ppt: "常做 PPT 的人",
  docs: "天天开会的人",
  marketing: "做新媒体的人",
  finance: "财务人",
  hr: "做 HR 的人",
  sales: "做销售的人",
  pm: "产品经理",
};

const BRAND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="26" fill="#b4402a"/><path d="M48 20C50 36 54 42 70 48C54 54 50 60 48 76C46 60 42 54 26 48C42 42 46 36 48 20Z" fill="#fffdf8"/></svg>`;

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function footer(scene, channel) {
  if (channel === "xhs") {
    return `<div class="foot foot-xhs">
      <div class="steps"><span><b>①</b>复制安装指令</span><span><b>②</b>粘贴给 WorkBuddy</span><span><b>③</b>装好直接用</span></div>
      <p class="fine">技能来自 GitHub 开源项目 · 非 WorkBuddy 官方内容</p>
    </div>`;
  }
  const qrPath = join(QR_DIR, `${scene.slug}.png`);
  const qr = existsSync(qrPath)
    ? `<img class="qr" src="data:image/png;base64,${readFileSync(qrPath).toString("base64")}" alt="">`
    : "";
  return `<div class="foot foot-wechat">
    <div class="foot-text">
      <p class="foot-title">一句话装好这 3 个技能</p>
      <p class="foot-line">微信搜索「${APP_NAME}」→ ${escape(scene.title)}</p>
      <p class="fine">技能来自 GitHub 开源项目 · 非 WorkBuddy 官方内容</p>
    </div>
    ${qr}
  </div>`;
}

function poster(scene, channel) {
  const cards = scene.must.map((pick, index) => `
    <article class="card">
      <span class="rank">${index + 1}</span>
      <div class="card-body">
        <h2>${escape(pick.headline)}</h2>
        <p class="say">对 WorkBuddy 说：“${escape(pick.say[0])}”</p>
      </div>
    </article>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  :root { --paper: #f5f2ea; --card: #fffdf8; --ink: #1c1a16; --ink-2: #4f4a43; --ink-3: #7a7266; --accent: #b4402a; --accent-soft: rgba(180, 64, 42, 0.10); --line: #e3ddcf;
    --sans: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body { display: flex; flex-direction: column; padding: 68px 72px 60px; background: var(--paper); color: var(--ink); font-family: var(--sans); }
  .top { display: flex; align-items: center; gap: 16px; }
  .top svg { width: 52px; height: 52px; }
  .badge { padding: 8px 20px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 28px; font-weight: 600; letter-spacing: 2px; }
  h1 { margin-top: 40px; font-size: 80px; font-weight: 800; line-height: 1.18; letter-spacing: 1px; }
  h1 span { display: block; white-space: nowrap; }
  h1 em { color: var(--accent); font-style: normal; }
  .tagline { margin-top: 18px; color: var(--ink-2); font-size: 32px; }
  .cards { display: flex; flex-direction: column; gap: 20px; margin-top: 40px; }
  .card { display: flex; gap: 26px; padding: 30px 34px; border: 2px solid var(--line); border-radius: 32px; background: var(--card); }
  .rank { flex-shrink: 0; width: 64px; height: 64px; border-radius: 50%; background: var(--accent); color: var(--card); font-size: 34px; font-weight: 800; line-height: 64px; text-align: center; }
  .card-body { min-width: 0; }
  h2 { font-size: 40px; font-weight: 700; line-height: 1.3; }
  .say { margin-top: 10px; color: var(--ink-2); font-size: 27px; line-height: 1.5; }
  .foot { margin-top: auto; padding-top: 32px; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 28px 24px; border-radius: 24px; background: var(--ink); color: var(--card); font-size: 28px; font-weight: 600; text-align: center; }
  .steps b { display: block; margin-bottom: 6px; color: #f3d9cf; font-size: 30px; }
  .foot-wechat { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 30px 36px; border-radius: 28px; background: var(--ink); color: var(--card); }
  .foot-title { font-size: 36px; font-weight: 700; }
  .foot-line { margin-top: 10px; font-size: 30px; color: #f3d9cf; }
  .qr { width: 180px; height: 180px; flex-shrink: 0; border-radius: 16px; background: #fff; padding: 10px; }
  .fine { margin-top: 16px; color: var(--ink-3); font-size: 22px; }
  .foot-wechat .fine { color: #b9b0a2; }
  </style></head><body>
  <div class="top">${BRAND}<span class="badge">WorkBuddy 技能合集</span></div>
  <h1><span>${escape(AUDIENCE[scene.slug] || scene.title)}必装的</span><span><em>3 个</em> WorkBuddy 技能</span></h1>
  <p class="tagline">${escape(scene.tagline)}</p>
  <section class="cards">${cards}</section>
  ${footer(scene, channel)}
  </body></html>`;
}

const work = mkdtempSync(join(tmpdir(), "scene-posters-"));
try {
  for (const channel of ["xhs", "wechat"]) {
    const dir = join(OUT, channel);
    mkdirSync(dir, { recursive: true });
    for (const scene of SCENES) {
      if (!AUDIENCE[scene.slug]) console.warn(`! no audience line for scene ${scene.slug}; using its title`);
      const html = join(work, `${channel}-${scene.slug}.html`);
      writeFileSync(html, poster(scene, channel));
      const png = join(dir, `${scene.slug}.png`);
      execFileSync(CHROME, [
        "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
        `--window-size=${WIDTH},${HEIGHT}`, `--screenshot=${png}`, pathToFileURL(html).href,
      ], { stdio: "ignore" });
      console.log(`✓ ${channel}/${scene.slug}.png`);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
