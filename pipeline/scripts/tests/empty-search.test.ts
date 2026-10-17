import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateEmptySearches,
  buildEmptySearchReport,
  catalogUrlPattern,
  formatReport,
  githubSearchTerm,
  normalizeQuery,
  parseReportArgs,
  repoSearchQueries,
  toRepoCandidates,
  type EmptySearchEvent,
  type ReportDeps,
  type RepoLike,
} from "../lib/empty-search";

const event = (query: string | null, anon: string | null, createdAt: string): EmptySearchEvent => ({ query, anon_id: anon, created_at: createdAt });

test("queries are grouped case-insensitively and ranked by count, users and recency", () => {
  const stats = aggregateEmptySearches([
    event("简历", "a", "2026-10-10T00:00:00Z"),
    event(" 简历 ", "a", "2026-10-11T00:00:00Z"),
    event("PDF  Reader", "b", "2026-10-12T00:00:00Z"),
    event("pdf reader", "c", "2026-10-13T00:00:00Z"),
    event("pdf reader", "c", "2026-10-14T00:00:00Z"),
    event("latex", "d", "2026-10-15T00:00:00Z"),
    event("excel", "e", "2026-10-09T00:00:00Z"),
    event(null, "f", "2026-10-09T00:00:00Z"),
    event("   ", "f", "2026-10-09T00:00:00Z"),
  ]);
  assert.deepEqual(stats.map((stat) => [stat.query, stat.count, stat.users]), [
    ["PDF Reader", 3, 2],
    ["简历", 2, 1],
    ["latex", 1, 1],
    ["excel", 1, 1],
  ]);
  assert.equal(stats[0].lastSeen, "2026-10-14T00:00:00Z");
});

test("minCount and limit trim the list; anonymous rows count as separate visitors", () => {
  const events = [event("a", null, "2026-10-01T00:00:00Z"), event("a", null, "2026-10-02T00:00:00Z"), event("b", "x", "2026-10-03T00:00:00Z")];
  assert.equal(aggregateEmptySearches(events)[0].users, 2);
  assert.deepEqual(aggregateEmptySearches(events, { minCount: 2 }).map((stat) => stat.query), ["a"]);
  assert.deepEqual(aggregateEmptySearches(events, { limit: 1 }).map((stat) => stat.query), ["a"]);
  assert.deepEqual(aggregateEmptySearches([]), []);
});

test("search terms are cleaned like the app and stripped of GitHub qualifiers", () => {
  assert.equal(normalizeQuery("a(b),c.d*e"), "a b c d e");
  assert.equal(githubSearchTerm("repo:evil/x user:me OR stars:>1"), "repo evil x user me stars 1");
  assert.equal(githubSearchTerm('"quoted" -minus'), "quoted minus");
  assert.equal(githubSearchTerm("a".repeat(100)).length, 60);
  assert.deepEqual(repoSearchQueries("%%%"), []);
});

test("every term gets a topic search and a SKILL.md text search", () => {
  const [topics, text] = repoSearchQueries("简历 优化");
  assert.match(topics, /^简历 优化 \(topic:agent-skills OR /);
  assert.match(topics, /fork:false archived:false$/);
  assert.match(text, /^简历 优化 SKILL\.md in:name,description,readme/);
});

test("catalog lookups escape LIKE wildcards in repository names", () => {
  assert.equal(catalogUrlPattern("owner/my_repo"), "https://github.com/owner/my\\_repo/%");
  assert.equal(catalogUrlPattern("owner/100%"), "https://github.com/owner/100\\%/%");
});

const repo = (overrides: RepoLike): RepoLike => ({
  full_name: "o/r", html_url: "https://github.com/o/r", description: "d", stargazers_count: 10, default_branch: "main", ...overrides,
});

test("repository candidates drop forks, archives, duplicates and low-star repositories", () => {
  const candidates = toRepoCandidates([
    repo({ full_name: "a/low", stargazers_count: 1 }),
    repo({ full_name: "a/top", stargazers_count: 99, description: "  long\n desc  " }),
    repo({ full_name: "A/TOP", stargazers_count: 5 }),
    repo({ full_name: "a/fork", fork: true }),
    repo({ full_name: "a/old", archived: true }),
    repo({ full_name: "bad name" }),
    repo({ full_name: "a/nobranch", default_branch: "" }),
    repo({ full_name: "a/mid", stargazers_count: 20, html_url: undefined }),
  ], 3);
  assert.deepEqual(candidates.map((candidate) => [candidate.fullName, candidate.stars]), [["a/top", 99], ["a/mid", 20]]);
  assert.equal(candidates[0].description, "long desc");
  assert.equal(candidates[1].url, "https://github.com/a/mid");
});

test("arguments default to a report-only run", () => {
  const args = parseReportArgs([]);
  assert.deepEqual(args, { days: 7, limit: 20, minCount: 1, perTerm: 2, minStars: 3, github: true, verify: true, importRepos: false });
  assert.equal(parseReportArgs(["--import"]).importRepos, true);
  assert.equal(parseReportArgs(["--days", "30", "--out", "report.md"]).out, "report.md");
  assert.throws(() => parseReportArgs(["--days", "0"]), /--days/);
  assert.throws(() => parseReportArgs(["--out"]), /--out/);
  assert.throws(() => parseReportArgs(["--import", "--no-github"]), /--import/);
  assert.throws(() => parseReportArgs(["--import", "--no-verify"]), /--import/);
  assert.throws(() => parseReportArgs(["--wat"]), /Unknown argument/);
});

function fakeDeps(overrides: Partial<ReportDeps> = {}) {
  const calls = { searched: [] as string[], imported: [] as string[], since: undefined as Date | undefined };
  const deps: ReportDeps = {
    now: () => new Date("2026-10-16T12:00:00Z"),
    async fetchEvents(since) {
      calls.since = since;
      return [
        event("简历", "a", "2026-10-12T00:00:00Z"), event("简历", "b", "2026-10-13T00:00:00Z"),
        event("pdf", "c", "2026-10-14T00:00:00Z"), event("latex", "d", "2026-10-15T00:00:00Z"),
        event("%%%", "e", "2026-10-15T00:00:00Z"),
      ];
    },
    async countCatalogMatches(term) { return term === "pdf" ? 7 : 0; },
    async searchRepos(query) {
      calls.searched.push(query);
      return query.startsWith("简历")
        ? [repo({ full_name: "x/resume", stargazers_count: 50 }), repo({ full_name: "x/empty", stargazers_count: 40 }), repo({ full_name: "x/known", stargazers_count: 30 })]
        : [];
    },
    async countSkillFiles(candidate) { return candidate.fullName === "x/empty" ? 0 : 3; },
    async repoInCatalog(fullName) { return fullName === "x/known"; },
    async importRepo(candidate) { calls.imported.push(candidate.fullName); return 3; },
    ...overrides,
  };
  return { deps, calls };
}

test("the default run only reports: nothing is imported", async () => {
  const { deps, calls } = fakeDeps();
  const args = parseReportArgs([]);
  const { terms, meta } = await buildEmptySearchReport(args, deps);

  assert.equal(calls.since?.toISOString(), "2026-10-09T12:00:00.000Z");
  assert.deepEqual(calls.imported, []);
  assert.deepEqual(terms.map((term) => term.stat.query), ["简历", "latex", "pdf"]);
  const resume = terms[0];
  assert.deepEqual(resume.candidates.map((candidate) => [candidate.fullName, candidate.skillFiles, candidate.inCatalog]), [["x/resume", 3, false], ["x/known", 3, true]]);
  assert.equal(resume.imported, 0);
  assert.match(terms.find((term) => term.stat.query === "pdf")?.note ?? "", /站内已有匹配/);
  assert.ok(!calls.searched.some((query) => query.startsWith("pdf")));
  assert.equal(meta.totalEvents, 5);
  assert.equal(meta.imported, false);
});

test("--import imports only verified repositories that are not in the catalog", async () => {
  const { deps, calls } = fakeDeps();
  const { terms } = await buildEmptySearchReport(parseReportArgs(["--import"]), deps);
  assert.deepEqual(calls.imported, ["x/resume"]);
  assert.equal(terms[0].imported, 3);
});

test("--no-github skips every GitHub call", async () => {
  const { deps, calls } = fakeDeps();
  const { terms } = await buildEmptySearchReport(parseReportArgs(["--no-github"]), deps);
  assert.deepEqual(calls.searched, []);
  assert.ok(terms.every((term) => term.candidates.length === 0));
});

test("a failing GitHub search is noted for that term and the report continues", async () => {
  const { deps } = fakeDeps({ async searchRepos() { throw new Error("rate limited"); } });
  const { terms } = await buildEmptySearchReport(parseReportArgs([]), deps);
  assert.match(terms[0].note ?? "", /rate limited/);
  assert.equal(terms.length, 3);
});

test("the Markdown report lists terms, counts and candidates", async () => {
  const { deps } = fakeDeps();
  const { terms, meta } = await buildEmptySearchReport(parseReportArgs([]), deps);
  const report = formatReport(terms, meta);
  assert.match(report, /^# 空搜索补录报告/);
  assert.match(report, /仅报告，未写入数据库/);
  assert.match(report, /\| 1 \| 简历 \| 2 \| 2 \| 2026-10-13 \| 0 \| 2（未收录 1） \| - \|/);
  assert.match(report, /\[x\/resume\]\(https:\/\/github\.com\/o\/r\) ★50 · 3 个 SKILL\.md · 未收录/);
  assert.match(report, /x\/known.*已收录/);
  assert.match(formatReport([], meta), /窗口内没有空搜索记录/);
});
