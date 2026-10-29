import { boundedRetryDelayMs } from "./rate-limit";

/** 开源雷达详情页展示项目自己的 README：抓取原文、清洗成小程序可安全展示的 Markdown。 */

/** 清洗后 README 的字符上限；小程序一次 setData 有体积限制，过长的文档在行边界截断。 */
export const README_MAX_CHARS = 20_000;
/** 清洗前先截断的原文长度，避免对超大文件跑一堆正则。 */
const README_RAW_MAX_CHARS = 400_000;
/** 品牌词替换文本：对外内容不能出现来源平台名字（见 open_radar_items_published_no_brand）。 */
export const BRAND_REPLACEMENT = "Git 平台";
export const URL_PLACEHOLDER = "<repo-url>";

const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

// 小程序 rich-text 渲染不了这些标签，也不能原样放进正文；只剥标签、保留标签内文字。
const HTML_TAGS =
  "a|abbr|b|big|blockquote|br|center|code|dd|del|details|div|dl|dt|em|figcaption|figure|font|h[1-6]|hr|i|img|ins|kbd|li|mark|ol|p|picture|pre|small|source|span|strike|strong|sub|summary|sup|table|tbody|td|tfoot|th|thead|tr|u|ul|video|svg|path|iframe|audio|source|track";
const HTML_TAG = new RegExp(`</?(?:${HTML_TAGS})(?:\\s[^<>]*)?/?>`, "gi");
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const EMPTY_LINK = /\[\s*\]\([^)]*\)/g;
const REFERENCE_DEFINITION = /^\s{0,3}\[[^\]]+\]:\s*\S.*$/;
const BRAND_LINK = /\[([^\]]*)\]\(\s*<?[^)\s>]*github[^)]*\)/gi;
const BRAND_URL = /(?:git\+)?(?:https?:\/\/|ssh:\/\/|git@)[^\s)\]>"'`<]*github[^\s)\]>"'`<]*/gi;
const BRAND = /github/gi;
const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;

function scrubBrand(text: string): string {
  return text.replace(BRAND_URL, URL_PLACEHOLDER).replace(BRAND, BRAND_REPLACEMENT);
}

function scrubProse(text: string): string {
  return scrubBrand(
    text
      .replace(HTML_COMMENT, "")
      .replace(HTML_TAG, "")
      .replace(IMAGE, "")
      .replace(EMPTY_LINK, "")
      .replace(BRAND_LINK, (_match, label: string) => label),
  );
}

type Segment = { code: boolean; lines: string[] };

/** 把文档按围栏代码块切成「正文 / 代码」段；围栏统一规范成三个反引号（小程序解析器只认这一种）。 */
function splitFences(text: string): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = { code: false, lines: [] };
  let opener: string | null = null;
  for (const line of text.split("\n")) {
    const fence = FENCE.exec(line);
    if (opener === null && fence) {
      segments.push(current);
      current = { code: true, lines: [] };
      opener = fence[2][0];
      current.lines.push(`${fence[1]}\`\`\`${fence[3]}`);
      continue;
    }
    if (opener !== null && fence && fence[2][0] === opener && fence[3].trim() === "") {
      current.lines.push(`${fence[1]}\`\`\``);
      segments.push(current);
      current = { code: false, lines: [] };
      opener = null;
      continue;
    }
    current.lines.push(line);
  }
  segments.push(current);
  return segments.filter((segment) => segment.lines.length > 0);
}

function truncateAtLine(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lineEnd = cut.lastIndexOf("\n");
  const kept = (lineEnd > 0 ? cut.slice(0, lineEnd) : cut).trimEnd();
  const openFence = (kept.match(/^\s*```/gm) ?? []).length % 2 === 1;
  return openFence ? `${kept}\n\`\`\`` : kept;
}

/**
 * 把来源 README 原文清洗成可对外展示的 Markdown：
 * - 去掉 HTML 标签 / 注释、图片和徽章（小程序渲染不了）；
 * - 来源平台的链接只留文字，仓库地址换成 `<repo-url>`，其余出现的平台品牌词换成「Git 平台」，
 *   这样才能通过数据库对已发布条目的品牌词约束，又不必把 README 整个抹掉；
 * - 超长文档在行边界截断。
 * 清洗后没有可读内容时返回 null。该函数幂等，可对已清洗的文本重复调用。
 */
export function scrubReadme(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/^\uFEFF/, "").replace(/\0/g, "").replace(/\r\n?/g, "\n").slice(0, README_RAW_MAX_CHARS);

  const cleaned = splitFences(text)
    .map((segment) => {
      if (segment.code) return scrubBrand(segment.lines.join("\n"));
      return scrubProse(segment.lines.filter((line) => !REFERENCE_DEFINITION.test(line)).join("\n"))
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const result = truncateAtLine(cleaned, README_MAX_CHARS);
  return /\S/.test(result.replace(/```/g, "")) ? result : null;
}

export type GithubReadmeOptions = {
  token?: string | null;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
};

/** 仓库 README 的原始 Markdown；仓库没有 README（404）时返回 null，限流/服务端错误有限次重试后抛错。 */
export async function fetchGithubReadme(fullName: string, options: GithubReadmeOptions = {}): Promise<string | null> {
  if (!FULL_NAME.test(fullName)) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "skiller-open-radar",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const url = `https://api.github.com/repos/${fullName}/readme`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(30000) });
    if (res.status === 404) return null;
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      const delayMs = boundedRetryDelayMs(attempt, Number(res.headers.get("retry-after") ?? 30) * 1000);
      if (delayMs === undefined) throw new Error(`README ${res.status} after ${attempt + 1} attempts: ${fullName}`);
      await sleepImpl(delayMs);
      continue;
    }
    if (!res.ok) throw new Error(`README ${res.status} ${res.statusText}: ${fullName}`);
    return await res.text();
  }
}
