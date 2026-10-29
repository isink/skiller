import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { backfillReadmes, type BackfillRow } from "../lib/open-radar-backfill";
import { toMetricsPatch, toRow, type OpenRadarCandidate } from "../lib/open-radar";
import { attachReadmes } from "../lib/open-radar-run";
import { persistCandidates, type OpenRadarDb } from "../lib/open-radar-store";
import {
  BRAND_REPLACEMENT,
  fetchGithubReadme,
  README_MAX_CHARS,
  scrubReadme,
  URL_PLACEHOLDER,
} from "../lib/open-radar-readme";

const candidate = (fullName: string, readmeMd?: string | null): OpenRadarCandidate => ({
  source: "github_trending", sourceId: fullName.toLowerCase(), sourceUrl: `https://example.com/${fullName}`, fullName,
  title: fullName.split("/")[1], summary: "LLM agent", language: null, topics: [], starsToday: 50, starsTotal: null, votesCount: null,
  ...(readmeMd === undefined ? {} : { readmeMd }),
});

test("scrub keeps readable README content and removes every brand token", () => {
  const raw = [
    "# Agent Kit",
    "",
    '<p align="center"><img src="https://raw.githubusercontent.com/a/b/logo.png" width="200"></p>',
    "[![CI](https://img.shields.io/badge/ci.svg)](https://github.com/a/b/actions) ![x](y.png)",
    "",
    "<!-- hidden GitHub note -->",
    "Star us on GitHub! See [the repo](https://github.com/a/b) and [docs](https://example.com/docs).",
    "",
    "```bash",
    "git clone https://github.com/a/b.git",
    "pip install agent-kit",
    "```",
    "",
    "[ref]: https://github.com/a/b",
  ].join("\r\n");
  const out = scrubReadme(raw) ?? "";
  assert.ok(!/github/i.test(out), out);
  assert.match(out, /^# Agent Kit/);
  assert.ok(out.includes(`Star us on ${BRAND_REPLACEMENT}!`));
  assert.ok(out.includes("See the repo and [docs](https://example.com/docs)."));
  assert.ok(out.includes(`git clone ${URL_PLACEHOLDER}\npip install agent-kit`));
  assert.ok(!out.includes("<img") && !out.includes("<p") && !out.includes("hidden") && !out.includes("shields") && !out.includes("[ref]"));
  assert.ok(!out.includes("\r"));
  assert.ok(!/\n{3,}/.test(out));
});

test("scrub handles scp-style remotes, odd casing and multi-line tags", () => {
  const out = scrubReadme('Use GITHUB or Github.\n\n```\ngit clone git@github.com:a/b.git\nnpm i github:a/b\n```\n\n<img\n  src="x.png"\n>\ntext') ?? "";
  assert.ok(!/github/i.test(out), out);
  assert.ok(out.includes("text") && !out.includes("<img"));
});

test("scrub is idempotent and normalizes tilde fences to backtick fences", () => {
  const once = scrubReadme("~~~js\nconsole.log('GitHub')\n~~~\n\nHello <repo-url>") ?? "";
  assert.ok(once.startsWith("```js\n"), once);
  assert.ok(once.includes("Hello <repo-url>"));
  assert.equal(scrubReadme(once), once);
});

test("scrub truncates long documents at a line boundary and closes an open fence", () => {
  const long = `# T\n\n\`\`\`txt\n${"line of code\n".repeat(5000)}\`\`\`\n`;
  const out = scrubReadme(long) ?? "";
  assert.ok(out.length <= README_MAX_CHARS + 4, String(out.length));
  assert.equal((out.match(/^```/gm) ?? []).length % 2, 0);
  assert.ok(out.endsWith("```"));
});

test("scrub returns null when nothing readable remains", () => {
  for (const value of [null, undefined, "", "  \n ", '<img src="a.png">', "![badge](x.svg)\n<!-- c -->", "```\n```"]) {
    assert.equal(scrubReadme(value), null, String(value));
  }
});

test("rows and metric patches carry the scrubbed README only when one was fetched", () => {
  const withReadme = candidate("a/hot", "# Hot\n\nFork it on GitHub");
  assert.equal(toRow(withReadme).readme_md, `# Hot\n\nFork it on ${BRAND_REPLACEMENT}`);
  assert.equal(toMetricsPatch(withReadme).readme_md, `# Hot\n\nFork it on ${BRAND_REPLACEMENT}`);

  for (const none of [candidate("a/none"), candidate("a/null", null), candidate("a/blank", "<img src='x'>")]) {
    assert.ok(!("readme_md" in toRow(none)));
    assert.ok(!("readme_md" in toMetricsPatch(none)));
  }
  const patch = toMetricsPatch(withReadme);
  for (const editorOwned of ["title", "title_zh", "summary", "summary_zh", "status", "pitfalls", "install_command"]) {
    assert.ok(!(editorOwned in patch), editorOwned);
  }
});

test("persist writes README for new drafts and refreshes it on existing rows without touching editor fields", async () => {
  const ops: Array<{ kind: string; payload: unknown }> = [];
  const db: OpenRadarDb = {
    from: () => ({
      select: () => ({ eq: () => ({ in: async () => ({ data: [{ source_id: "a/old" }], error: null }) }) }),
      upsert: async (rows) => { ops.push({ kind: "upsert", payload: rows }); return { error: null }; },
      update: (values) => ({ eq: () => ({ eq: async () => { ops.push({ kind: "update", payload: values }); return { error: null }; } }) }),
    }),
  };
  await persistCandidates(db, "github_trending", [candidate("a/old", "# Old\nGitHub"), candidate("a/new", "# New")]);
  const upsert = ops.find((op) => op.kind === "upsert")?.payload as Array<Record<string, unknown>>;
  assert.equal(upsert[0].readme_md, "# New");
  const update = ops.find((op) => op.kind === "update")?.payload as Record<string, unknown>;
  assert.equal(update.readme_md, `# Old\n${BRAND_REPLACEMENT}`);
  for (const key of ["title", "summary", "title_zh", "summary_zh", "status"]) assert.ok(!(key in update), key);
});

test("attachReadmes fills README per repository and tolerates missing or failing ones", async () => {
  const items = [candidate("a/ok"), candidate("a/none"), candidate("a/boom"), candidate("a/empty")];
  const seen: string[] = [];
  const errors: string[] = [];
  const outcome = await attachReadmes(
    items,
    async (fullName) => {
      seen.push(fullName);
      if (fullName === "a/none") return null;
      if (fullName === "a/boom") throw new Error("rate limited");
      if (fullName === "a/empty") return "  ";
      return "# OK";
    },
    (fullName, error) => errors.push(`${fullName}:${error.message}`),
  );
  assert.deepEqual(outcome, { attached: 1, missing: 2, failed: 1 });
  assert.deepEqual(errors, ["a/boom:rate limited"]);
  assert.equal(items[0].readmeMd, "# OK");
  assert.ok(items.slice(1).every((item) => item.readmeMd === undefined));

  const product = { ...candidate("x/y"), source: "product_hunt" as const, fullName: null };
  const untouched = await attachReadmes([product], async () => { throw new Error("must not be called"); });
  assert.deepEqual(untouched, { attached: 0, missing: 0, failed: 0 });
});

function response(status: number, body = "", headers: Record<string, string> = {}): Response {
  return new Response(status === 404 ? null : body, { status, headers });
}

test("fetchGithubReadme asks for raw markdown, returns null for 404 and rejects malformed names", async () => {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl = (async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    return url.includes("/a/none/") ? response(404) : response(200, "# Raw");
  }) as unknown as typeof fetch;

  assert.equal(await fetchGithubReadme("a/ok", { fetchImpl, token: "tok" }), "# Raw");
  assert.equal(calls[0].url, "https://api.github.com/repos/a/ok/readme");
  assert.equal(calls[0].headers.Accept, "application/vnd.github.raw+json");
  assert.equal(calls[0].headers.Authorization, "Bearer tok");
  assert.equal(await fetchGithubReadme("a/none", { fetchImpl }), null);
  assert.ok(!("Authorization" in calls[1].headers));
  assert.equal(await fetchGithubReadme("a/b/../../c", { fetchImpl }), null);
  assert.equal(await fetchGithubReadme("nope", { fetchImpl }), null);
  assert.equal(calls.length, 2);
});

test("fetchGithubReadme retries rate limits a bounded number of times", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const sleepImpl = async (ms: number) => { delays.push(ms); };
  const flaky = (async () => (++attempts < 3 ? response(429, "", { "retry-after": "2" }) : response(200, "# Ok"))) as unknown as typeof fetch;
  assert.equal(await fetchGithubReadme("a/b", { fetchImpl: flaky, sleepImpl }), "# Ok");
  assert.deepEqual(delays, [2000, 2000]);

  const always = (async () => response(403, "", { "retry-after": "1" })) as unknown as typeof fetch;
  await assert.rejects(fetchGithubReadme("a/b", { fetchImpl: always, sleepImpl }), /README 403/);
  const broken = (async () => response(400, "bad")) as unknown as typeof fetch;
  await assert.rejects(fetchGithubReadme("a/b", { fetchImpl: broken, sleepImpl }), /README 400/);
});

test("backfill fills only rows without README unless forced, writes scrubbed text, and keeps going after failures", async () => {
  const rows: BackfillRow[] = [
    { id: "1", full_name: "a/empty", readme_md: null },
    { id: "2", full_name: "a/has", readme_md: "# keep" },
    { id: "3", full_name: "a/none", readme_md: "" },
    { id: "4", full_name: "a/boom", readme_md: null },
    { id: "5", full_name: null, readme_md: null },
  ];
  const run = async (force: boolean) => {
    const saved: Array<[string, string]> = [];
    const errors: string[] = [];
    const result = await backfillReadmes(
      rows,
      {
        fetchReadme: async (fullName) => {
          if (fullName === "a/none") return null;
          if (fullName === "a/boom") throw new Error("boom");
          return `# ${fullName}\nOn GitHub`;
        },
        save: async (id, readme) => { saved.push([id, readme]); },
        onError: (row) => errors.push(row.id),
      },
      { force },
    );
    return { result, saved, errors };
  };

  const normal = await run(false);
  assert.deepEqual(normal.result, { updated: 1, skipped: 2, missing: 1, failed: 1 });
  assert.deepEqual(normal.saved, [["1", `# a/empty\nOn ${BRAND_REPLACEMENT}`]]);
  assert.deepEqual(normal.errors, ["4"]);

  const forced = await run(true);
  assert.deepEqual(forced.saved.map(([id]) => id), ["1", "2"]);
  assert.deepEqual(forced.result, { updated: 2, skipped: 1, missing: 1, failed: 1 });
});

const sql = (path: string) => readFileSync(join(__dirname, "../../supabase", path), "utf8");

test("migration 028 adds readme_md, a published brand constraint and appends it to the public view only", () => {
  const migration = sql("migrations/028_open_radar_readme.sql");
  assert.match(migration, /add column if not exists readme_md text/);
  assert.match(migration, /open_radar_items_published_readme_no_brand check \([\s\S]*readme_md !~\* 'github'/);
  assert.match(migration, /grant select on table public\.open_radar_published to anon/);
  assert.ok(!/grant[^;]*public\.open_radar_items[^;]*to[^;]*anon/.test(migration));

  const view = /create or replace view public\.open_radar_published as([\s\S]*?);/.exec(migration)?.[1] ?? "";
  assert.match(view, /published_at,\s*readme_md\s*from/);
  assert.match(view, /where status = 'published'/);
  for (const internal of ["full_name", "source_id", "source_url", "source,", "stars_", "votes_count", "status,"]) {
    assert.ok(!view.includes(internal), internal);
  }
});

test("the schema snapshot includes the README column, constraint and view column", () => {
  const schema = sql("schema.sql");
  assert.match(schema, /\n  readme_md text,\n/);
  assert.match(schema, /open_radar_items_published_readme_no_brand check/);
  const view = /create or replace view public\.open_radar_published as([\s\S]*?);/.exec(schema)?.[1] ?? "";
  assert.match(view, /readme_md/);
  assert.ok(!view.includes("full_name") && !view.includes("source_url"));
});
