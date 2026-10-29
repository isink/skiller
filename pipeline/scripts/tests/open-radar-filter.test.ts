import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FILTER_OPTIONS,
  filterCandidates,
  isAiRelated,
  readFilterOptions,
  toRow,
  type OpenRadarCandidate,
} from "../lib/open-radar";

function gh(fullName: string, starsToday: number | null, summary: string | null = "An LLM agent toolkit"): OpenRadarCandidate {
  return {
    source: "github_trending", sourceId: fullName.toLowerCase(), sourceUrl: `https://example.com/${fullName}`, fullName,
    title: fullName.split("/")[1], summary, language: "Go", topics: [], starsToday, starsTotal: 1000, votesCount: null,
  };
}

function ph(id: string, votesCount: number | null, overrides: Partial<OpenRadarCandidate> = {}): OpenRadarCandidate {
  return {
    source: "product_hunt", sourceId: id, sourceUrl: `https://www.producthunt.com/posts/${id}`, fullName: null,
    title: `Product ${id}`, summary: "AI writing assistant", language: null, topics: [], starsToday: null, starsTotal: null, votesCount,
    ...overrides,
  };
}

test("AI relevance matches whole words in name, description and topics", () => {
  assert.ok(isAiRelated(gh("a/b", 50, "Open-source AI agent")));
  assert.ok(isAiRelated(gh("a/mcp-server", 50, null)));
  assert.ok(isAiRelated({ title: "X", summary: "chat app", topics: ["Artificial Intelligence"], fullName: null }));
  assert.ok(isAiRelated({ title: "X", summary: "大模型应用开发", topics: [], fullName: null }));
  assert.ok(!isAiRelated(gh("a/maintain", 50, "A tool to maintain trains and mail servers")));
  assert.ok(!isAiRelated({ title: "Spreadsheet", summary: "Budget planner", topics: ["Productivity"], fullName: null }));
});

test("drops invalid names, low heat, duplicates and non-AI items", () => {
  const kept = filterCandidates([
    gh("good/agent", 300),
    gh("good/agent", 999),
    gh("weak/agent", 5),
    gh("bad name/agent", 300),
    gh("nonai/spreadsheet", 300, "Budget planner"),
    gh("missing/stars", null),
    ph("p1", 120),
    ph("p2", 3),
    ph("p3", 200, { summary: null }),
    ph("p4", 90, { title: "Chat", summary: "Budget planner" }),
  ]);
  assert.deepEqual(kept.map((item) => item.sourceId), ["good/agent", "p1"].map((id) => id.toLowerCase()));
});

test("AI filter can be switched off and thresholds are inclusive", () => {
  const options = { ...DEFAULT_FILTER_OPTIONS, aiOnly: false, minStarsToday: 20 };
  const kept = filterCandidates([gh("nonai/spreadsheet", 20, "Budget planner"), gh("nonai/other", 19, "Budget planner")], options);
  assert.deepEqual(kept.map((item) => item.sourceId), ["nonai/spreadsheet"]);
});

test("sorts each source by heat and caps it independently", () => {
  const options = { ...DEFAULT_FILTER_OPTIONS, githubLimit: 2, productHuntLimit: 1 };
  const kept = filterCandidates([gh("a/one", 50), gh("a/two", 400), gh("a/three", 200), ph("p1", 40), ph("p2", 500)], options);
  assert.deepEqual(kept.map((item) => item.sourceId), ["p2", "a/two", "a/three"]);
});

test("the same id in different sources is not a duplicate", () => {
  const kept = filterCandidates([gh("x/y", 100), ph("x/y", 100)]);
  assert.equal(kept.length, 2);
});

test("rows contain only crawler-owned columns, never status or reviewed content", () => {
  const row = toRow(gh("Acme/Agent", 100), new Date("2026-10-29T00:00:00Z"));
  assert.equal(row.last_seen_at, "2026-10-29T00:00:00.000Z");
  assert.equal(row.full_name, "Acme/Agent");
  for (const forbidden of ["status", "title_zh", "summary_zh", "pitfalls", "install_command", "article_url", "package_url", "published_at"]) {
    assert.ok(!(forbidden in row), forbidden);
  }
});

test("reads thresholds from the environment and rejects bad values", () => {
  assert.deepEqual(readFilterOptions({}), DEFAULT_FILTER_OPTIONS);
  assert.deepEqual(
    readFilterOptions({ OPEN_RADAR_MIN_STARS_TODAY: "0", OPEN_RADAR_MIN_VOTES: "5", OPEN_RADAR_AI_ONLY: "0", OPEN_RADAR_GH_LIMIT: "3", OPEN_RADAR_PH_LIMIT: "4" }),
    { minStarsToday: 0, minVotes: 5, aiOnly: false, githubLimit: 3, productHuntLimit: 4 },
  );
  assert.equal(readFilterOptions({ OPEN_RADAR_AI_ONLY: "true" }).aiOnly, true);
  assert.equal(readFilterOptions({ OPEN_RADAR_AI_ONLY: "" }).aiOnly, true);
  assert.throws(() => readFilterOptions({ OPEN_RADAR_MIN_VOTES: "-1" }), /OPEN_RADAR_MIN_VOTES/);
  assert.throws(() => readFilterOptions({ OPEN_RADAR_GH_LIMIT: "1.5" }), /OPEN_RADAR_GH_LIMIT/);
  assert.throws(() => readFilterOptions({ OPEN_RADAR_AI_ONLY: "maybe" }), /OPEN_RADAR_AI_ONLY/);
});
