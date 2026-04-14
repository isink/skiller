/**
 * Import ~1,400 community agent skills from
 * https://github.com/sickn33/antigravity-awesome-skills
 *
 * The upstream repo publishes a curated skills_index.json at its root. We fetch
 * it directly, map their schema onto our Supabase `skills` table, and upsert
 * every row. Safe to re-run — uses `slug` as the conflict target.
 *
 *   npm run import:antigravity
 */

import { db } from "./lib/supabase";
import { idToDisplayName } from "./lib/slugify";
import { mapCategory, CURATED_CATEGORIES } from "./lib/category-map";
import { applyOverrides } from "./lib/overrides";

const SOURCE_URL =
  "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills_index.json";
const REPO_TREE_BASE =
  "https://github.com/sickn33/antigravity-awesome-skills/tree/main/";

type UpstreamSkill = {
  id: string;
  path: string;
  category: string;
  name: string;
  description: string;
  risk: string;
  source: string;
  date_added: string | null;
  plugin?: {
    targets?: { codex?: string; claude?: string };
    setup?: { type?: string; summary?: string; docs?: string | null };
    reasons?: string[];
  };
};

type InsertSkill = {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  github_url: string;
  rank: number;
  score: number;
  install_count: number;
  featured: boolean;
};

function authorFromSource(source: string): string {
  if (!source || source === "personal" || source === "community") {
    return "community";
  }
  const match = source.match(/github\.com\/([^/]+)/i);
  if (match) return match[1];
  return source.slice(0, 64);
}

function deriveTags(upstream: UpstreamSkill): string[] {
  const tags = new Set<string>();
  if (upstream.risk && upstream.risk !== "none") tags.add(upstream.risk);
  if (upstream.category) tags.add(upstream.category.toLowerCase());
  if (upstream.plugin?.targets?.claude === "supported") tags.add("claude");
  if (upstream.plugin?.targets?.codex === "supported") tags.add("codex");
  return Array.from(tags).slice(0, 8);
}

function mapSkill(upstream: UpstreamSkill): InsertSkill {
  return {
    slug: upstream.id,
    name: idToDisplayName(upstream.name || upstream.id),
    description: (upstream.description ?? "").slice(0, 1000),
    category: mapCategory(upstream.category),
    tags: deriveTags(upstream),
    author: authorFromSource(upstream.source),
    github_url: REPO_TREE_BASE + upstream.path,
    rank: 0,
    score: 0,
    install_count: 0,
    featured: false,
  };
}

async function ensureCategories(): Promise<void> {
  // Idempotent upsert of our 9 curated slugs so the skills FK always resolves.
  const rows = CURATED_CATEGORIES.map((slug) => ({
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    icon: "sparkles",
  }));
  const { error } = await db
    .from("categories")
    .upsert(rows, { onConflict: "slug" });
  if (error) throw error;
  console.log(`✓ Ensured ${rows.length} curated categories`);
}

async function fetchUpstream(): Promise<UpstreamSkill[]> {
  console.log(`→ Fetching ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as UpstreamSkill[];
  if (!Array.isArray(json)) {
    throw new Error("Unexpected payload: top-level is not an array");
  }
  console.log(`✓ Fetched ${json.length} skills`);
  return json;
}

async function upsertBatch(rows: InsertSkill[]): Promise<void> {
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await db
      .from("skills")
      .upsert(slice, { onConflict: "slug" });
    if (error) throw error;
    process.stdout.write(`  ↳ upserted ${i + slice.length}/${rows.length}\r`);
  }
  process.stdout.write("\n");
}

async function main() {
  await ensureCategories();
  const upstream = await fetchUpstream();

  // Deduplicate by slug — upstream is usually clean but be defensive.
  const seen = new Set<string>();
  const rows: InsertSkill[] = [];
  for (const u of upstream) {
    if (!u.id || seen.has(u.id)) continue;
    seen.add(u.id);
    rows.push(mapSkill(u));
  }

  console.log(`→ Upserting ${rows.length} skills`);
  await upsertBatch(rows);

  await applyOverrides();

  console.log(`\n✅ Done. Imported ${rows.length} skills from Antigravity.`);
}

main().catch((err) => {
  console.error("\n✖ Import failed:");
  console.error(err);
  process.exit(1);
});
