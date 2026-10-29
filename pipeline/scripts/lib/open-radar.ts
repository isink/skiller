/** 开源雷达候选：来源抓取结果的统一形状、过滤规则与写库行。 */

import { scrubReadme } from "./open-radar-readme";

export const OPEN_RADAR_SOURCES = ["github_trending", "product_hunt"] as const;
export type OpenRadarSource = (typeof OPEN_RADAR_SOURCES)[number];

export type OpenRadarCandidate = {
  source: OpenRadarSource;
  /** 来源内唯一键：仓库全名（小写）或 Product Hunt 帖子 id。 */
  sourceId: string;
  sourceUrl: string;
  /** 仅后台字段：来源站点的仓库全名，不进入对外视图。 */
  fullName: string | null;
  title: string;
  /** 来源站点的描述原文，作为 summary 占位。 */
  summary: string | null;
  language: string | null;
  topics: string[];
  starsToday: number | null;
  starsTotal: number | null;
  votesCount: number | null;
  /** 来源项目 README 的原始 Markdown（仅日榜来源，写库时清洗）；没抓到时为空，不会覆盖库里已有内容。 */
  readmeMd?: string | null;
};

export type OpenRadarFilterOptions = {
  minStarsToday: number;
  minVotes: number;
  aiOnly: boolean;
  githubLimit: number;
  productHuntLimit: number;
};

export const DEFAULT_FILTER_OPTIONS: OpenRadarFilterOptions = {
  minStarsToday: 20,
  minVotes: 30,
  aiOnly: true,
  githubLimit: 25,
  productHuntLimit: 20,
};

const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const AI_KEYWORDS = new RegExp(
  [
    "\\bai\\b", "\\ba\\.i\\.", "\\bllms?\\b", "\\bgpt\\b", "\\bgpts\\b", "chatgpt", "openai", "anthropic", "claude",
    "gemini", "deepseek", "\\bqwen\\b", "\\bollama\\b", "\\bagents?\\b", "agentic", "copilot", "\\brag\\b", "\\bmcp\\b",
    "\\bprompts?\\b", "machine learning", "deep learning", "neural", "diffusion", "transformers?\\b",
    "embeddings?\\b", "generative", "\\bgenai\\b", "artificial intelligence", "language model",
    "\\bskills?\\b", "vibe cod", "大模型", "智能体", "人工智能", "提示词",
  ].join("|"),
  "i",
);

export function isAiRelated(candidate: Pick<OpenRadarCandidate, "title" | "summary" | "topics" | "fullName">): boolean {
  const haystack = [candidate.fullName, candidate.title, candidate.summary, ...candidate.topics]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
  return AI_KEYWORDS.test(haystack);
}

function metric(candidate: OpenRadarCandidate): number {
  return (candidate.source === "github_trending" ? candidate.starsToday : candidate.votesCount) ?? 0;
}

function isValid(candidate: OpenRadarCandidate, options: OpenRadarFilterOptions): boolean {
  if (!candidate.sourceId.trim() || !candidate.title.trim() || !candidate.sourceUrl.trim()) return false;
  if (candidate.source === "github_trending") {
    return !!candidate.fullName && FULL_NAME.test(candidate.fullName) && metric(candidate) >= options.minStarsToday;
  }
  return !!candidate.summary?.trim() && metric(candidate) >= options.minVotes;
}

/** 去重、阈值、AI 相关性过滤，每个来源按热度降序保留前 N 条。 */
export function filterCandidates(
  candidates: readonly OpenRadarCandidate[],
  options: OpenRadarFilterOptions = DEFAULT_FILTER_OPTIONS,
): OpenRadarCandidate[] {
  const seen = new Set<string>();
  const kept: OpenRadarCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.sourceId}`;
    if (seen.has(key) || !isValid(candidate, options)) continue;
    if (options.aiOnly && !isAiRelated(candidate)) continue;
    seen.add(key);
    kept.push(candidate);
  }
  const limitOf = (source: OpenRadarSource) => (source === "github_trending" ? options.githubLimit : options.productHuntLimit);
  const counts: Record<OpenRadarSource, number> = { github_trending: 0, product_hunt: 0 };
  return kept
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => metric(b.candidate) - metric(a.candidate) || a.index - b.index)
    .map(({ candidate }) => candidate)
    .filter((candidate) => counts[candidate.source]++ < limitOf(candidate.source));
}

export type OpenRadarRow = {
  source: OpenRadarSource;
  source_id: string;
  source_url: string;
  full_name: string | null;
  title: string;
  summary: string | null;
  language: string | null;
  topics: string[];
  stars_today: number | null;
  stars_total: number | null;
  votes_count: number | null;
  last_seen_at: string;
  /** 已清洗的 README（见 scrubReadme）；没有时整个字段省略。 */
  readme_md?: string;
};

function readmeFields(candidate: OpenRadarCandidate): { readme_md?: string } {
  const readme = scrubReadme(candidate.readmeMd);
  return readme === null ? {} : { readme_md: readme };
}

/** 新候选的完整写库行。status 由数据库默认值置为 draft；审核字段（title_zh、summary_zh、pitfalls 等）不在其中。 */
export function toRow(candidate: OpenRadarCandidate, seenAt: Date = new Date()): OpenRadarRow {
  return {
    source: candidate.source,
    source_id: candidate.sourceId,
    source_url: candidate.sourceUrl,
    full_name: candidate.fullName,
    title: candidate.title,
    summary: candidate.summary,
    language: candidate.language,
    topics: candidate.topics,
    stars_today: candidate.starsToday,
    stars_total: candidate.starsTotal,
    votes_count: candidate.votesCount,
    last_seen_at: seenAt.toISOString(),
    ...readmeFields(candidate),
  };
}

export type OpenRadarMetricsPatch = Pick<OpenRadarRow, "language" | "topics" | "stars_today" | "stars_total" | "votes_count" | "last_seen_at" | "readme_md">;

/**
 * 已存在条目只刷新热度、出现时间和来源 README：不动 status、标题、摘要和任何人工审核内容。
 * 本次没抓到 README 时不带 readme_md，库里已有的 README 保持原样。
 */
export function toMetricsPatch(candidate: OpenRadarCandidate, seenAt: Date = new Date()): OpenRadarMetricsPatch {
  const { language, topics, stars_today, stars_total, votes_count, last_seen_at, readme_md } = toRow(candidate, seenAt);
  return { language, topics, stars_today, stars_total, votes_count, last_seen_at, ...(readme_md === undefined ? {} : { readme_md }) };
}

function nonNegativeInteger(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function flag(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return fallback;
  if (/^(1|true|yes|on)$/i.test(raw.trim())) return true;
  if (/^(0|false|no|off)$/i.test(raw.trim())) return false;
  throw new Error(`${name} must be 1/0 or true/false`);
}

export function readFilterOptions(env: Record<string, string | undefined>): OpenRadarFilterOptions {
  return {
    minStarsToday: nonNegativeInteger("OPEN_RADAR_MIN_STARS_TODAY", env.OPEN_RADAR_MIN_STARS_TODAY, DEFAULT_FILTER_OPTIONS.minStarsToday),
    minVotes: nonNegativeInteger("OPEN_RADAR_MIN_VOTES", env.OPEN_RADAR_MIN_VOTES, DEFAULT_FILTER_OPTIONS.minVotes),
    aiOnly: flag("OPEN_RADAR_AI_ONLY", env.OPEN_RADAR_AI_ONLY, DEFAULT_FILTER_OPTIONS.aiOnly),
    githubLimit: nonNegativeInteger("OPEN_RADAR_GH_LIMIT", env.OPEN_RADAR_GH_LIMIT, DEFAULT_FILTER_OPTIONS.githubLimit),
    productHuntLimit: nonNegativeInteger("OPEN_RADAR_PH_LIMIT", env.OPEN_RADAR_PH_LIMIT, DEFAULT_FILTER_OPTIONS.productHuntLimit),
  };
}
