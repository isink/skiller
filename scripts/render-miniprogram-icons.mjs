#!/usr/bin/env node
// Regenerates miniprogram/assets/icons/*.svg and transparent *.png rasters.
// Requires Node 22+ and a Chrome/Chromium binary (set CHROME to override).
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "miniprogram", "assets", "icons");
const CHROME = process.env.CHROME || "google-chrome-stable";
const PORT = 9341;

const ACCENT = "#7C9BFF";
const MUTED = "#7F899A";
const BG = "#0C0E12";

const SHAPES = {
  compass: '<circle cx="12" cy="12" r="9.5"/><polygon points="15.8 8.2 13.6 13.6 8.2 15.8 10.4 10.4"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  layers: '<polygon points="12 2.5 2.5 7.25 12 12 21.5 7.25 12 2.5"/><polyline points="2.5 16.75 12 21.5 21.5 16.75"/><polyline points="2.5 12 12 16.75 21.5 12"/>',
  radar: (c) => `<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.25"/><circle cx="12" cy="12" r="1.25" fill="${c}"/><line x1="12" y1="12" x2="19" y2="5"/>`,
  chevron: '<polyline points="9 5 16 12 9 19"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>',
};

const shape = (key, color) => (typeof SHAPES[key] === "function" ? SHAPES[key](color) : SHAPES[key]);
const stroke = (color, body, width = 1.75, fill = "none") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;

const ICONS = {
  "tab-discover": stroke(MUTED, shape("compass")),
  "tab-discover-active": stroke(ACCENT, shape("compass")),
  "tab-category": stroke(MUTED, shape("grid")),
  "tab-category-active": stroke(ACCENT, shape("grid")),
  "tab-favorite": stroke(MUTED, shape("heart")),
  "tab-favorite-active": stroke(ACCENT, shape("heart")),
  heart: stroke(MUTED, shape("heart")),
  "heart-filled": stroke(ACCENT, shape("heart"), 1.75, ACCENT),
  "heart-large": stroke(MUTED, shape("heart"), 1.5),
  layers: stroke(ACCENT, shape("layers")),
  radar: stroke(ACCENT, shape("radar", ACCENT)),
  "chevron-right": stroke(MUTED, shape("chevron"), 2),
  search: stroke(MUTED, shape("search"), 2),
  brand: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="26" fill="${ACCENT}"/><path d="M48 20C50 36 54 42 70 48C54 54 50 60 48 76C46 60 42 54 26 48C42 42 46 36 48 20Z" fill="${BG}"/></svg>\n`,
};

mkdirSync(OUT, { recursive: true });
for (const [name, svg] of Object.entries(ICONS)) writeFileSync(join(OUT, `${name}.svg`), svg);

const profile = mkdtempSync(join(tmpdir(), "icons-"));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--headless=new", "--no-sandbox", "--disable-gpu", "about:blank",
], { stdio: "ignore", detached: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      target = pages.find((p) => p.type === "page");
    } catch { /* browser not ready yet */ }
    if (!target) await sleep(200);
  }
  if (!target) throw new Error("Chrome did not start");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });

  await send("Page.enable");
  for (const file of readdirSync(OUT).filter((f) => f.endsWith(".svg"))) {
    const name = basename(file, ".svg");
    const size = name === "brand" ? 192 : 96;
    const svg = readFileSync(join(OUT, file), "utf8");
    const html = `<html><body style="margin:0;background:transparent"><img style="display:block" width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body></html>`;
    await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    await send("Page.navigate", { url: `data:text/html;base64,${Buffer.from(html).toString("base64")}` });
    await sleep(250);
    const { data } = await send("Page.captureScreenshot", { format: "png", fromSurface: true, clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  }
  ws.close();
} finally {
  try { process.kill(-chrome.pid); } catch { /* already exited */ }
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* temp profile cleanup is best effort */ }
}
