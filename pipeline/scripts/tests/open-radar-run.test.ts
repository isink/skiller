import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { OpenRadarCandidate, OpenRadarRow } from "../lib/open-radar";
import { collectCandidates, parseSourceChoice } from "../lib/open-radar-run";
import { persistCandidates, type OpenRadarDb } from "../lib/open-radar-store";

const ghItem = (fullName: string, starsToday: number): OpenRadarCandidate => ({
  source: "github_trending", sourceId: fullName.toLowerCase(), sourceUrl: `https://example.com/${fullName}`, fullName,
  title: fullName.split("/")[1], summary: "LLM agent", language: null, topics: [], starsToday, starsTotal: null, votesCount: null,
});
const phItem = (id: string, votesCount: number): OpenRadarCandidate => ({
  source: "product_hunt", sourceId: id, sourceUrl: `https://www.producthunt.com/posts/${id}`, fullName: null,
  title: id, summary: "AI tool", language: null, topics: [], starsToday: null, starsTotal: null, votesCount,
});

test("source choice accepts known values only", () => {
  assert.equal(parseSourceChoice(undefined), "all");
  assert.equal(parseSourceChoice("github"), "github");
  assert.equal(parseSourceChoice("product-hunt"), "product-hunt");
  assert.throws(() => parseSourceChoice("npm"), /--source/);
});

test("collects and filters both sources", async () => {
  const calls: unknown[] = [];
  const { outcomes } = await collectCandidates(
    "all",
    { PRODUCT_HUNT_TOKEN: " tok ", OPEN_RADAR_GH_LANGUAGE: "python", OPEN_RADAR_PH_WINDOW_HOURS: "24" },
    {
      fetchGithub: async (language) => { calls.push(language); return [ghItem("a/hot", 100), ghItem("a/cold", 1)]; },
      fetchProductHunt: async (token, hours) => { calls.push([token, hours]); return [phItem("p1", 80)]; },
    },
  );
  assert.deepEqual(calls, ["python", ["tok", 24]]);
  assert.deepEqual(outcomes.map((o) => [o.source, o.fetched, o.kept.length]), [["github_trending", 2, 1], ["product_hunt", 1, 1]]);
});

test("a failing source does not block the other one", async () => {
  const { outcomes } = await collectCandidates("all", { PRODUCT_HUNT_TOKEN: "tok" }, {
    fetchGithub: async () => { throw new Error("layout changed"); },
    fetchProductHunt: async () => [phItem("p1", 80)],
  });
  assert.equal(outcomes[0].error?.message, "layout changed");
  assert.equal(outcomes[1].kept.length, 1);
});

test("a missing Product Hunt token skips it in all mode but fails when requested explicitly", async () => {
  const deps = { fetchGithub: async () => [ghItem("a/hot", 100)] };
  const all = await collectCandidates("all", {}, deps);
  assert.equal(all.outcomes[1].skipped, "未设置 PRODUCT_HUNT_TOKEN");
  assert.equal(all.outcomes[1].error, undefined);

  const only = await collectCandidates("product-hunt", {}, deps);
  assert.equal(only.outcomes.length, 1);
  assert.match(only.outcomes[0].error?.message ?? "", /PRODUCT_HUNT_TOKEN/);

  const github = await collectCandidates("github", {}, deps);
  assert.deepEqual(github.outcomes.map((o) => o.source), ["github_trending"]);
});

test("invalid configuration is rejected before any fetch", async () => {
  await assert.rejects(collectCandidates("all", { OPEN_RADAR_PH_WINDOW_HOURS: "0" }), /OPEN_RADAR_PH_WINDOW_HOURS/);
  await assert.rejects(collectCandidates("all", { OPEN_RADAR_MIN_VOTES: "x" }), /OPEN_RADAR_MIN_VOTES/);
});

type Op =
  | { kind: "upsert"; rows: OpenRadarRow[]; options: { onConflict: string; ignoreDuplicates: boolean } }
  | { kind: "update"; values: Record<string, unknown>; where: Record<string, string> };

function fakeDb(existing: string[], failure?: "upsert" | "update") {
  const ops: Op[] = [];
  const db: OpenRadarDb = {
    from: () => ({
      select: () => ({ eq: () => ({ in: async () => ({ data: existing.map((source_id) => ({ source_id })), error: null }) }) }),
      upsert: async (rows, options) => {
        ops.push({ kind: "upsert", rows, options });
        return { error: failure === "upsert" ? { message: "permission denied" } : null };
      },
      update: (values) => ({
        eq: (c1, v1) => ({
          eq: async (c2, v2) => {
            ops.push({ kind: "update", values, where: { [c1]: v1, [c2]: v2 } });
            return { error: failure === "update" ? { message: "update denied" } : null };
          },
        }),
      }),
    }),
  };
  return { db, ops };
}

test("persist inserts new rows as drafts and only refreshes metrics of existing ones", async () => {
  const { db, ops } = fakeDb(["a/old"]);
  const result = await persistCandidates(db, "github_trending", [ghItem("a/old", 50), ghItem("a/new", 60)], new Date("2026-10-29T00:00:00Z"));
  assert.deepEqual(result, { source: "github_trending", inserted: 1, refreshed: 1 });

  const upsert = ops.find((op) => op.kind === "upsert");
  assert.ok(upsert && upsert.kind === "upsert");
  assert.deepEqual(upsert.options, { onConflict: "source,source_id", ignoreDuplicates: true });
  assert.deepEqual(upsert.rows.map((row) => row.source_id), ["a/new"]);
  assert.ok(upsert.rows.every((row) => !("status" in row)));

  const update = ops.find((op) => op.kind === "update");
  assert.ok(update && update.kind === "update");
  assert.deepEqual(update.where, { source: "github_trending", source_id: "a/old" });
  assert.deepEqual(Object.keys(update.values).sort(), ["language", "last_seen_at", "stars_today", "stars_total", "topics", "votes_count"]);
});

test("persist batches large inputs and surfaces database errors", async () => {
  const many = Array.from({ length: 205 }, (_, i) => phItem(`p${i}`, 100));
  const { db, ops } = fakeDb([]);
  const result = await persistCandidates(db, "product_hunt", many);
  assert.equal(result.inserted, 205);
  assert.deepEqual(ops.map((op) => (op.kind === "upsert" ? op.rows.length : 0)), [100, 100, 5]);

  await assert.rejects(persistCandidates(fakeDb([], "upsert").db, "product_hunt", [phItem("p1", 100)]), /permission denied/);
  await assert.rejects(persistCandidates(fakeDb(["p1"], "update").db, "product_hunt", [phItem("p1", 100)]), /update denied/);
});

const sql = (path: string) => readFileSync(join(__dirname, "../../supabase", path), "utf8");

test("migration defaults to draft and exposes only published, non-internal columns", () => {
  const migration = sql("migrations/027_open_radar_items.sql");
  assert.match(migration, /status text not null default 'draft'/);
  assert.match(migration, /unique \(source, source_id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert, update, delete on table public\.open_radar_items to service_role;/);
  assert.match(migration, /grant select on table public\.open_radar_published to anon/);
  assert.ok(!/grant[^;]*public\.open_radar_items[^;]*to[^;]*anon/.test(migration));
  assert.match(migration, /open_radar_items_published_no_brand check/);

  const view = /create or replace view public\.open_radar_published as([\s\S]*?);/.exec(migration)?.[1] ?? "";
  assert.match(view, /where status = 'published'/);
  for (const internal of ["full_name", "source_id", "source_url", "source,", "stars_", "votes_count", "status,"]) {
    assert.ok(!view.includes(internal), internal);
  }
});

test("the schema snapshot defines the same table and view", () => {
  const schema = sql("schema.sql");
  assert.match(schema, /create table if not exists public\.open_radar_items/);
  assert.match(schema, /create or replace view public\.open_radar_published/);
});
