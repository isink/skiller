/**
 * Maps raw source-category strings into our curated 9 category slugs.
 * Anything unrecognized falls into "misc".
 */

export const CURATED_CATEGORIES = [
  "official",
  "docs",
  "code",
  "data",
  "office",
  "design",
  "devops",
  "research",
  "misc",
] as const;

export type CuratedCategory = (typeof CURATED_CATEGORIES)[number];

// Lower-cased substrings → target curated slug.
// Order matters: first match wins.
const RULES: Array<[RegExp, CuratedCategory]> = [
  [/(^|-)(pdf|docx|xlsx|pptx|word|excel|powerpoint|office)(-|$)/i, "office"],
  [/(^|-)(doc|docs|writing|comms|editor)/i, "docs"],
  [/(^|-)(code|dev|programming|refactor|lint|test|debug|typescript|python|rust|go|java|js)/i, "code"],
  [/(^|-)(data|sql|analytics|pandas|dataset|etl|database)/i, "data"],
  [/(^|-)(design|ui|ux|figma|canva|brand|image|art|logo|css)/i, "design"],
  [/(^|-)(devops|docker|k8s|kubernetes|ci|infra|terraform|deploy|cloud|mcp)/i, "devops"],
  [/(^|-)(research|paper|citation|academic|literature)/i, "research"],
  [/(^|-)(anthropic|official)/i, "official"],
];

export function mapCategory(raw: string | null | undefined): CuratedCategory {
  if (!raw) return "misc";
  const lower = raw.toLowerCase();
  if (CURATED_CATEGORIES.includes(lower as CuratedCategory)) {
    return lower as CuratedCategory;
  }
  for (const [rx, target] of RULES) {
    if (rx.test(lower)) return target;
  }
  return "misc";
}
