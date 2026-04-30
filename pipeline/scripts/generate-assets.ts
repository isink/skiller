/**
 * Generates placeholder app icon and splash screen PNGs using only Node.js
 * built-ins (no external dependencies).
 *
 * Run: npx tsx scripts/generate-assets.ts
 *
 * Outputs:
 *   assets/icon.png          1024×1024  (App Store icon)
 *   assets/adaptive-icon.png 1024×1024  (Android adaptive icon foreground)
 *   assets/splash.png        1284×2778  (iPhone 14 Pro Max splash)
 *
 * Replace these with real designed assets before shipping.
 */

import * as zlib from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// CRC32 (required by PNG spec)
// ---------------------------------------------------------------------------

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  crcTable[i] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder
// ---------------------------------------------------------------------------

function chunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

type RGBA = [number, number, number, number]; // r g b a  (0-255)

/**
 * Encode a flat RGBA pixel array into a valid PNG buffer.
 * pixels.length === width * height * 4
 */
function encodePNG(width: number, height: number, pixels: Uint8Array): Buffer {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // compression / filter / interlace = 0

  // Raw scanlines: 1 filter byte + 4 bytes per pixel
  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * rowLen + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

class Canvas {
  readonly pixels: Uint8Array;
  constructor(readonly w: number, readonly h: number, bg: RGBA = [0, 0, 0, 255]) {
    this.pixels = new Uint8Array(w * h * 4);
    this.fill(bg);
  }

  fill(color: RGBA) {
    for (let i = 0; i < this.w * this.h; i++) {
      this.pixels.set(color, i * 4);
    }
  }

  setPixel(x: number, y: number, color: RGBA) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    // Simple alpha composite over existing
    const srcA = color[3] / 255;
    const dstA = this.pixels[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA === 0) return;
    this.pixels[i] = Math.round((color[0] * srcA + this.pixels[i] * dstA * (1 - srcA)) / outA);
    this.pixels[i + 1] = Math.round((color[1] * srcA + this.pixels[i + 1] * dstA * (1 - srcA)) / outA);
    this.pixels[i + 2] = Math.round((color[2] * srcA + this.pixels[i + 2] * dstA * (1 - srcA)) / outA);
    this.pixels[i + 3] = Math.round(outA * 255);
  }

  /** Filled circle */
  circle(cx: number, cy: number, r: number, color: RGBA) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= r) {
          this.setPixel(x, y, color);
        } else if (dist <= r + 1) {
          // Anti-alias edge
          const alpha = Math.round((r + 1 - dist) * color[3]);
          this.setPixel(x, y, [color[0], color[1], color[2], alpha]);
        }
      }
    }
  }

  /** Rounded rectangle */
  roundRect(x: number, y: number, w: number, h: number, r: number, color: RGBA) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const inX = px - x;
        const inY = py - y;
        // Corner checks
        let inside = true;
        if (inX < r && inY < r) {
          inside = Math.sqrt((inX - r) ** 2 + (inY - r) ** 2) <= r;
        } else if (inX > w - r && inY < r) {
          inside = Math.sqrt((inX - (w - r)) ** 2 + (inY - r) ** 2) <= r;
        } else if (inX < r && inY > h - r) {
          inside = Math.sqrt((inX - r) ** 2 + (inY - (h - r)) ** 2) <= r;
        } else if (inX > w - r && inY > h - r) {
          inside = Math.sqrt((inX - (w - r)) ** 2 + (inY - (h - r)) ** 2) <= r;
        }
        if (inside) this.setPixel(px, py, color);
      }
    }
  }

  toPNG(): Buffer {
    return encodePNG(this.w, this.h, this.pixels);
  }
}

// ---------------------------------------------------------------------------
// Asset generation
// ---------------------------------------------------------------------------

// Brand palette
const BG:    RGBA = [0x0b, 0x0b, 0x0f, 0xff]; // #0B0B0F
const BRAND: RGBA = [0xd9, 0x77, 0x57, 0xff]; // #D97757 (orange)
const WHITE: RGBA = [0xf5, 0xf5, 0xf7, 0xff]; // #F5F5F7

/** Icon: dark bg + orange circle + "iS" logotype approximated as two circles */
function makeIcon(size: number): Buffer {
  const c = new Canvas(size, size, BG);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.38;

  // Orange circle background
  c.circle(cx, cy, outerR, BRAND);

  // White inner shape: small dot (i) + rounded rectangle (S approximation)
  const unit = size * 0.04;

  // "i" dot
  c.circle(cx - unit * 3.5, cy - unit * 3, unit * 1.2, WHITE);
  // "i" stem
  c.roundRect(
    Math.round(cx - unit * 4.7),
    Math.round(cy - unit * 0.5),
    Math.round(unit * 2.4),
    Math.round(unit * 5),
    Math.round(unit * 1.2),
    WHITE
  );

  // "S" — three horizontal rounded bars
  const barH = Math.round(unit * 1.6);
  const barW = Math.round(unit * 5.5);
  const barR = Math.round(unit * 0.8);
  const sx = Math.round(cx + unit * 0.5);

  // Top bar
  c.roundRect(sx, Math.round(cy - unit * 4.5), barW, barH, barR, WHITE);
  // Middle bar
  c.roundRect(sx, Math.round(cy - unit * 1.2), barW, barH, barR, WHITE);
  // Bottom bar
  c.roundRect(sx, Math.round(cy + unit * 2.1), barW, barH, barR, WHITE);

  // Left connector (top half of S)
  c.roundRect(sx, Math.round(cy - unit * 4.5), barR * 2, Math.round(unit * 4.1), barR, WHITE);
  // Right connector (bottom half of S)
  c.roundRect(
    Math.round(sx + barW - barR * 2),
    Math.round(cy - unit * 1.2),
    barR * 2,
    Math.round(unit * 4.1),
    barR,
    WHITE
  );

  return c.toPNG();
}

/** Splash: dark bg + centered orange circle (simple) */
function makeSplash(w: number, h: number): Buffer {
  const c = new Canvas(w, h, BG);
  const r = Math.min(w, h) * 0.12;
  c.circle(w / 2, h / 2, r, BRAND);
  return c.toPNG();
}

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "assets");
fs.mkdirSync(assetsDir, { recursive: true });

const tasks: { name: string; buf: () => Buffer }[] = [
  { name: "icon.png",          buf: () => makeIcon(1024) },
  { name: "adaptive-icon.png", buf: () => makeIcon(1024) },
  { name: "splash.png",        buf: () => makeSplash(1284, 2778) },
];

for (const { name, buf } of tasks) {
  const dest = path.join(assetsDir, name);
  process.stdout.write(`Generating ${name}...`);
  fs.writeFileSync(dest, buf());
  console.log(` done (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
}

console.log("\nAssets written to assets/. Replace with real designs before App Store submission.");
