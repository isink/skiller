/**
 * Upsert trending AI terms from a JSON array file.
 *
 * Usage:
 *   npm run upsert:trending -- path/to/terms.json
 *
 * JSON format (array of objects):
 *   [
 *     {
 *       "term": "RAG",
 *       "summary": "检索增强生成,结合外部知识库提升LLM准确性",
 *       "score": 0.92,
 *       "heat": 8500,
 *       "status": "已命中",
 *       "discovered_at": "2026-10-01",
 *       "recheck_at": "2026-11-01",
 *       "trends_heat": 12000,
 *       "source": "google-trends",
 *       "url": "https://trends.google.com/..."
 *     }
 *   ]
 *
 * All fields are optional except "term". The script upserts by term (unique key).
 * Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env before running.
 */

import { readFile } from "node:fs/promises";
import { db } from "./lib/supabase";

type TrendingTermInput = {
  term: string;
  summary?: string;
  score?: number;
  heat?: number;
  status?: string;
  discovered_at?: string;
  recheck_at?: string;
  trends_heat?: number;
  source?: string;
  url?: string;
};

type TrendingTermRow = {
  term: string;
  summary_zh?: string;
  score?: number;
  heat?: number;
  status?: string;
  discovered_at?: string;
  recheck_at?: string;
  trends_heat?: number;
  source?: string;
  source_url?: string;
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("\n✖ Usage: npm run upsert:trending -- path/to/terms.json\n");
    process.exit(1);
  }

  console.log(`→ Reading ${filePath}`);
  const content = await readFile(filePath, "utf-8");
  const input: TrendingTermInput[] = JSON.parse(content);

  if (!Array.isArray(input)) {
    console.error("\n✖ JSON file must contain an array of term objects.\n");
    process.exit(1);
  }

  console.log(`✓ Found ${input.length} terms`);

  const rows: TrendingTermRow[] = input.map((item) => {
    if (!item.term || typeof item.term !== "string" || !item.term.trim()) {
      throw new Error("Each term object must have a non-empty 'term' field.");
    }

    const row: TrendingTermRow = { term: item.term.trim() };
    if (item.summary) row.summary_zh = item.summary;
    if (item.score !== undefined) row.score = item.score;
    if (item.heat !== undefined) row.heat = item.heat;
    if (item.status) row.status = item.status;
    if (item.discovered_at) row.discovered_at = item.discovered_at;
    if (item.recheck_at) row.recheck_at = item.recheck_at;
    if (item.trends_heat !== undefined) row.trends_heat = item.trends_heat;
    if (item.source) row.source = item.source;
    if (item.url) row.source_url = item.url;

    return row;
  });

  console.log(`→ Upserting ${rows.length} terms into public.trending_terms`);

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const { error } = await db.from("trending_terms").upsert(row, {
      onConflict: "term",
    });

    if (error) {
      console.error(`  ✖ ${row.term}: ${error.message}`);
      failed++;
    } else {
      succeeded++;
      process.stdout.write(`  ↳ ${succeeded} upserted · last: ${row.term}\r`);
    }
  }

  process.stdout.write("\n");
  console.log(`✓ Upserted ${succeeded} terms, failed ${failed}`);

  if (failed > 0) {
    console.error("\n✖ Some terms failed to upsert. Check errors above.\n");
    process.exit(1);
  }

  console.log("\n✅ Done. Trending terms are live.");
}

main().catch((err) => {
  console.error("\n✖ Upsert failed:");
  console.error(err);
  process.exit(1);
});
