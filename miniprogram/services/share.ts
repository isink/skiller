export const APP_TITLE = "头山 AI 工具箱";

export function enableShareMenu(): void {
  try { wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] }); }
  catch { /* Sharing is optional; the page works without the menu. */ }
}

const PLACEHOLDER_PURPOSE = "中文简介待补充";
const MAX_TITLE_NAME = 18;

function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

/** First sentence of a Chinese summary, cut at a clause break when it is too long. */
export function shortPurpose(description: string | null | undefined, max = 20): string {
  const text = (description || "").replace(/\s+/g, " ").trim();
  if (!text || text === PLACEHOLDER_PURPOSE) return "";
  const sentence = text.split(/[。！？!?；;\n]/)[0].trim();
  const chars = Array.from(sentence);
  if (chars.length <= max) return sentence.replace(/[，,、：:\s]+$/, "");
  const head = chars.slice(0, max).join("");
  const clause = Math.max(head.lastIndexOf("，"), head.lastIndexOf(","), head.lastIndexOf("、"));
  if (clause >= Math.floor(max / 2)) return head.slice(0, clause);
  return `${chars.slice(0, max - 1).join("")}…`;
}

/** "技能名｜一句中文用途" for the share sheet; falls back to the app name when there is no summary. */
export function skillShareTitle(name: string, description: string | null | undefined): string {
  const title = clip((name || "").trim(), MAX_TITLE_NAME) || APP_TITLE;
  const purpose = shortPurpose(description);
  return `${title}｜${purpose || APP_TITLE}`;
}

/** Toast shown after an install copy succeeds; nudges the user to pass the tool on. */
export function copyShareNudge(kind: string, target: "primary" | "alternative"): string {
  return kind === "link" && target === "primary"
    ? "GitHub 链接已复制，分享给朋友一起看"
    : "安装命令已复制，分享给朋友一起用";
}
