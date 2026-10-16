import { APP_TITLE } from "./share";

/** WeChat crops share images to 5:4. */
export const CARD_WIDTH = 750;
export const CARD_HEIGHT = 600;
const RENDER_TIMEOUT_MS = 2500;

export interface ShareCardData {
  name: string;
  purpose: string;
  stars: number | null;
  category?: string;
}

/** The subset of CanvasRenderingContext2D the card needs, so tests can supply a recorder. */
export interface CardContext {
  fillStyle: string;
  font: string;
  textBaseline: string;
  textAlign: string;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}

export function formatCardStars(stars: number | null | undefined): string {
  if (stars === null || stars === undefined || !Number.isFinite(stars) || stars < 0) return "";
  if (stars >= 10000) return `${(stars / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  return String(Math.round(stars));
}

// English words stay whole; every other character (including each CJK glyph) may wrap.
function tokens(text: string): string[] {
  return text.match(/[A-Za-z0-9._\-/]+|[\s\S]/gu) || [];
}

/** Greedy line wrapping by measured width; the last permitted line ends with an ellipsis. */
export function wrapText(ctx: Pick<CardContext, "measureText">, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  let truncated = false;
  const push = (line: string): boolean => {
    if (lines.length >= maxLines) { truncated = true; return false; }
    lines.push(line);
    return true;
  };
  outer:
  for (const token of tokens(text.replace(/\s+/g, " ").trim())) {
    const pieces = ctx.measureText(token).width > maxWidth ? Array.from(token) : [token];
    for (const piece of pieces) {
      if (current && ctx.measureText(current + piece).width > maxWidth) {
        if (!push(current.replace(/\s+$/, ""))) break outer;
        current = piece.trim() ? piece : "";
      } else {
        current += piece;
      }
    }
  }
  if (!truncated && current.trim()) truncated = !push(current.replace(/\s+$/, ""));
  if (truncated && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/[，,、\s]+$/, "")}…`;
  }
  return lines;
}

const COLORS = {
  background: "#f5f2ea",
  surface: "#fffdf8",
  accent: "#b4402a",
  onAccent: "#fffdf8",
  text: "#1c1a16",
  text2: "#4f4a43",
  text3: "#6b6459",
  border: "#e3ddcf",
};
const FONT = "sans-serif";
const MARGIN = 56;

export function drawShareCard(ctx: CardContext, data: ShareCardData): void {
  const innerWidth = CARD_WIDTH - MARGIN * 2;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, 16, CARD_HEIGHT);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.accent;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(data.category ? `AI 技能 · ${data.category}` : "AI 技能推荐", MARGIN, 52);

  ctx.fillStyle = COLORS.text;
  ctx.font = `bold 68px ${FONT}`;
  const nameLines = wrapText(ctx, data.name, innerWidth, 2);
  nameLines.forEach((line, index) => ctx.fillText(line, MARGIN, 116 + index * 84));

  const purposeTop = 116 + nameLines.length * 84 + 24;
  ctx.fillStyle = COLORS.text2;
  ctx.font = `34px ${FONT}`;
  const purposeLines = wrapText(ctx, data.purpose, innerWidth, nameLines.length > 1 ? 3 : 4);
  purposeLines.forEach((line, index) => ctx.fillText(line, MARGIN, purposeTop + index * 52));

  ctx.fillStyle = COLORS.border;
  ctx.fillRect(MARGIN, 488, innerWidth, 2);

  const stars = formatCardStars(data.stars);
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.accent;
  ctx.font = `bold 36px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(stars ? `★ ${stars} Star` : "★ 开源技能", MARGIN, 540);

  ctx.fillStyle = COLORS.text3;
  ctx.font = `600 30px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(APP_TITLE, CARD_WIDTH - MARGIN, 540);
}

interface CanvasNode extends CardContextHost { width: number; height: number }
interface CardContextHost { getContext(type: "2d"): CardContext | null }

/**
 * Draws the card into the page's hidden `<canvas type="2d">` and exports a
 * temporary JPEG. Resolves to null on any failure so callers use the default
 * share image instead.
 */
export function renderShareCard(selector: string, data: ShareCardData): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (path: string | null) => {
      if (settled) return;
      settled = true;
      resolve(path);
    };
    const timer = setTimeout(() => finish(null), RENDER_TIMEOUT_MS);
    try {
      wx.createSelectorQuery().select(selector).fields({ node: true }).exec((result: Array<{ node?: CanvasNode } | null>) => {
        try {
          const node = result && result[0] ? result[0].node : undefined;
          const ctx = node ? node.getContext("2d") : null;
          if (!node || !ctx) { clearTimeout(timer); finish(null); return; }
          node.width = CARD_WIDTH;
          node.height = CARD_HEIGHT;
          drawShareCard(ctx, data);
          wx.canvasToTempFilePath({
            canvas: node,
            x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT,
            destWidth: CARD_WIDTH, destHeight: CARD_HEIGHT,
            fileType: "jpg",
            quality: 0.9,
            success: (res: { tempFilePath?: string }) => { clearTimeout(timer); finish(res.tempFilePath || null); },
            fail: () => { clearTimeout(timer); finish(null); },
          });
        } catch { clearTimeout(timer); finish(null); }
      });
    } catch { clearTimeout(timer); finish(null); }
  });
}
