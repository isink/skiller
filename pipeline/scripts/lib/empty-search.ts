/**
 * Pure helpers behind `npm run report:empty-search`: aggregate the mini
 * program's `search_empty` events and decide what to look for on GitHub.
 */
import { DISCOVERY_TOPICS } from "./github-discovery";

export type EmptySearchEvent = {
  query: string | null;
  anon_id: string | null;
  created_at: string;
};

export type QueryStat = {
  query: string;
  count: number;
  users: number;
  lastSeen: string;
};

export const MAX_TERM_LENGTH = 60;

/** Same cleanup as the client search (services/api.ts), plus case folding for grouping. */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFKC")
    .replace(/[(),.*"%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
}

export type AggregateOptions = { minCount?: number; limit?: number };

export function aggregateEmptySearches(events: readonly EmptySearchEvent[], options: AggregateOptions = {}): QueryStat[] {
  const minCount = options.minCount ?? 1;
  const groups = new Map<string, { query: string; count: number; users: Set<string>; lastSeen: string }>();
  events.forEach((event, index) => {
    const query = normalizeQuery(event.query);
    if (!query) return;
    const key = query.toLowerCase();
    const group = groups.get(key) ?? { query, count: 0, users: new Set<string>(), lastSeen: "" };
    group.count += 1;
    // Rows without an anon id still count as distinct visitors, one each.
    group.users.add(event.anon_id || `row-${index}`);
    if (event.created_at > group.lastSeen) group.lastSeen = event.created_at;
    groups.set(key, group);
  });
  const stats = [...groups.values()]
    .map((group): QueryStat => ({ query: group.query, count: group.count, users: group.users.size, lastSeen: group.lastSeen }))
    .filter((stat) => stat.count >= minCount)
    .sort((left, right) =>
      right.count - left.count
      || right.users - left.users
      || (left.lastSeen < right.lastSeen ? 1 : left.lastSeen > right.lastSeen ? -1 : 0)
      || (left.query < right.query ? -1 : left.query > right.query ? 1 : 0));
  return options.limit === undefined ? stats : stats.slice(0, Math.max(0, options.limit));
}

/** Text that is safe to embed in a GitHub search query: no qualifiers, quotes or operators. */
export function githubSearchTerm(query: string): string {
  return normalizeQuery(query)
    .replace(/[:"'`<>=~^{}\[\]|&!+\-/]/g, " ")
    .replace(/\b(?:AND|OR|NOT)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TERM_LENGTH)
    .trim();
}

/** Repository searches for a term. Empty when nothing searchable is left after sanitising. */
export function repoSearchQueries(query: string): string[] {
  const term = githubSearchTerm(query);
  if (!term) return [];
  const topics = DISCOVERY_TOPICS.map((topic) => `topic:${topic}`).join(" OR ");
  return [
    `${term} (${topics}) fork:false archived:false`,
    `${term} SKILL.md in:name,description,readme fork:false archived:false`,
  ];
}

/** ILIKE pattern matching every URL inside a repository. `_` and `%` are escaped for Postgres. */
export function catalogUrlPattern(fullName: string): string {
  return `https://github.com/${fullName.replace(/[\\%_]/g, (char) => `\\${char}`)}/%`;
}

export type RepoCandidate = {
  fullName: string;
  url: string;
  description: string;
  stars: number;
  defaultBranch: string;
};

export type RepoLike = {
  full_name?: unknown;
  html_url?: unknown;
  description?: unknown;
  stargazers_count?: unknown;
  default_branch?: unknown;
  archived?: unknown;
  fork?: unknown;
};

/** Valid, non-archived, non-fork repositories only; most starred first, one entry per repository. */
export function toRepoCandidates(items: readonly RepoLike[], minStars = 0): RepoCandidate[] {
  const seen = new Map<string, RepoCandidate>();
  for (const item of items) {
    if (typeof item.full_name !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(item.full_name)) continue;
    if (item.archived === true || item.fork === true) continue;
    if (typeof item.default_branch !== "string" || !item.default_branch) continue;
    const stars = typeof item.stargazers_count === "number" ? item.stargazers_count : 0;
    if (stars < minStars) continue;
    const key = item.full_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, {
      fullName: item.full_name,
      url: typeof item.html_url === "string" ? item.html_url : `https://github.com/${item.full_name}`,
      description: typeof item.description === "string" ? item.description.replace(/\s+/g, " ").trim().slice(0, 140) : "",
      stars,
      defaultBranch: item.default_branch,
    });
  }
  return [...seen.values()].sort((left, right) => right.stars - left.stars || (left.fullName < right.fullName ? -1 : 1));
}

export type TermReport = {
  stat: QueryStat;
  /** Skills already matching the term in the catalog; the term needs no import when this is positive. */
  catalogMatches: number;
  candidates: Array<RepoCandidate & { skillFiles: number; inCatalog: boolean }>;
  imported: number;
  note?: string;
};

export type ReportMeta = {
  from: Date;
  to: Date;
  totalEvents: number;
  searchedGitHub: boolean;
  imported: boolean;
};

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ");
}

export function formatReport(terms: readonly TermReport[], meta: ReportMeta): string {
  const lines: string[] = [];
  lines.push("# 空搜索补录报告", "");
  lines.push(
    `- 统计窗口：${day(meta.from)} ~ ${day(meta.to)}（UTC）`,
    `- 空搜索事件 ${meta.totalEvents} 次，去重后 ${terms.length} 个搜索词`,
    `- GitHub 候选：${meta.searchedGitHub ? "已搜索" : "未搜索（--no-github）"}；入库：${meta.imported ? "已按 --import 执行" : "仅报告，未写入数据库"}`,
    "",
  );
  if (terms.length === 0) {
    lines.push("窗口内没有空搜索记录。", "");
    return lines.join("\n");
  }
  lines.push("| # | 搜索词 | 次数 | 人数 | 最近一次 | 站内已命中 | GitHub 候选 | 入库 |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  terms.forEach((term, index) => {
    const fresh = term.candidates.filter((candidate) => !candidate.inCatalog).length;
    lines.push(
      `| ${index + 1} | ${cell(term.stat.query)} | ${term.stat.count} | ${term.stat.users} | ${term.stat.lastSeen.slice(0, 10)} `
      + `| ${term.catalogMatches} | ${meta.searchedGitHub ? `${term.candidates.length}（未收录 ${fresh}）` : "-"} | ${meta.imported ? term.imported : "-"} |`,
    );
  });
  lines.push("");
  const detailed = terms.filter((term) => term.candidates.length > 0 || term.note);
  if (detailed.length > 0) lines.push("## 候选仓库", "");
  for (const term of detailed) {
    lines.push(`### ${term.stat.query}（${term.stat.count} 次）`, "");
    if (term.note) lines.push(`> ${term.note}`, "");
    for (const candidate of term.candidates) {
      const status = candidate.inCatalog ? "已收录" : "未收录";
      lines.push(
        `- [${candidate.fullName}](${candidate.url}) ★${candidate.stars} · ${candidate.skillFiles} 个 SKILL.md · ${status}`
        + (candidate.description ? ` — ${candidate.description}` : ""),
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

export type ReportArgs = {
  days: number;
  limit: number;
  minCount: number;
  perTerm: number;
  minStars: number;
  github: boolean;
  verify: boolean;
  importRepos: boolean;
  out?: string;
};

function integerFlag(name: string, value: string | undefined, min: number, max: number): number {
  const parsed = Number(value);
  if (value === undefined || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} needs an integer from ${min} to ${max}`);
  }
  return parsed;
}

export function parseReportArgs(argv: readonly string[]): ReportArgs {
  const args: ReportArgs = { days: 7, limit: 20, minCount: 1, perTerm: 2, minStars: 3, github: true, verify: true, importRepos: false };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = () => argv[++index];
    switch (flag) {
      case "--days": args.days = integerFlag(flag, value(), 1, 90); break;
      case "--limit": args.limit = integerFlag(flag, value(), 1, 200); break;
      case "--min-count": args.minCount = integerFlag(flag, value(), 1, 1000); break;
      case "--per-term": args.perTerm = integerFlag(flag, value(), 1, 10); break;
      case "--min-stars": args.minStars = integerFlag(flag, value(), 0, 100000); break;
      case "--no-github": args.github = false; break;
      case "--no-verify": args.verify = false; break;
      case "--import": args.importRepos = true; break;
      case "--out": {
        const target = value();
        if (!target) throw new Error("--out needs a file path");
        args.out = target;
        break;
      }
      default: throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (args.importRepos && !args.github) throw new Error("--import needs GitHub search; remove --no-github");
  if (args.importRepos && !args.verify) throw new Error("--import needs verified SKILL.md files; remove --no-verify");
  return args;
}

export interface ReportDeps {
  fetchEvents(since: Date): Promise<EmptySearchEvent[]>;
  countCatalogMatches(term: string): Promise<number>;
  searchRepos(query: string): Promise<RepoLike[]>;
  /** SKILL.md files the repository contains; 0 when it has none. */
  countSkillFiles(candidate: RepoCandidate): Promise<number>;
  repoInCatalog(fullName: string): Promise<boolean>;
  /** Imports the repository's skills and returns how many rows were written. */
  importRepo(candidate: RepoCandidate): Promise<number>;
  now?: () => Date;
  log?: (message: string) => void;
}

export async function buildEmptySearchReport(args: ReportArgs, deps: ReportDeps): Promise<{ terms: TermReport[]; meta: ReportMeta }> {
  const to = (deps.now ?? (() => new Date()))();
  const from = new Date(to.getTime() - args.days * 86_400_000);
  const events = await deps.fetchEvents(from);
  const stats = aggregateEmptySearches(events, { minCount: args.minCount, limit: args.limit });
  const terms: TermReport[] = [];

  for (const stat of stats) {
    const report: TermReport = { stat, catalogMatches: await deps.countCatalogMatches(stat.query), candidates: [], imported: 0 };
    terms.push(report);
    if (!args.github) continue;
    if (report.catalogMatches > 0) { report.note = "站内已有匹配技能，跳过 GitHub 搜索。"; continue; }
    const queries = repoSearchQueries(stat.query);
    if (queries.length === 0) { report.note = "搜索词里没有可用于 GitHub 搜索的文字。"; continue; }

    try {
      const found: RepoLike[] = [];
      for (const query of queries) found.push(...await deps.searchRepos(query));
      for (const candidate of toRepoCandidates(found, args.minStars).slice(0, args.perTerm * 3)) {
        const skillFiles = args.verify ? await deps.countSkillFiles(candidate) : 0;
        if (args.verify && skillFiles === 0) continue;
        report.candidates.push({ ...candidate, skillFiles, inCatalog: await deps.repoInCatalog(candidate.fullName) });
        if (report.candidates.length >= args.perTerm) break;
      }
      if (args.importRepos) {
        for (const candidate of report.candidates.filter((entry) => !entry.inCatalog)) {
          report.imported += await deps.importRepo(candidate);
        }
      }
    } catch (error) {
      report.note = `GitHub 搜索失败：${error instanceof Error ? error.message : String(error)}`;
      deps.log?.(`  ✖ ${stat.query}: ${report.note}`);
    }
  }
  return { terms, meta: { from, to, totalEvents: events.length, searchedGitHub: args.github, imported: args.importRepos } };
}
