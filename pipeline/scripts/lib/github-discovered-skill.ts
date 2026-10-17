import { idToDisplayName, toSlug } from "../import/lib/slugify";
import { mapCategory } from "../import/lib/category-map";
import { checkedRepoStarsPatch, type GitHubRepoMetadata } from "./github-repo-metadata";
import type { GitHubSkillItem } from "./github-api";

export type Frontmatter = {
  name?: string;
  description?: string;
  tags?: string[];
  category?: string;
};

/** Minimal YAML frontmatter parser (same approach as import-anthropic.ts) */
export function parseFrontmatter(md: string): Frontmatter {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm: Record<string, string | string[]> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim().replace(/^["']|["']$/g, "");
    const arr = val.match(/^\[(.*)\]$/);
    if (arr) {
      fm[key] = arr[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      fm[key] = val;
    }
  }
  return fm as Frontmatter;
}

/** Derive a stable slug from repo + file path */
export function deriveSlug(repoFullName: string, filePath: string): string {
  // e.g. "owner/my-skill-repo" + "skills/foo/SKILL.md" → "owner--foo"
  const dir = filePath.replace(/\/?SKILL\.md$/i, "").replace(/\//g, "-");
  const repoSlug = repoFullName.replace("/", "--");
  const combined = dir ? `${repoSlug}--${dir}` : repoSlug;
  return toSlug(combined).slice(0, 80);
}

export type DiscoveredSkillRow = {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  github_url: string;
  skill_md_content: string;
  github_stars: number;
  github_stars_checked_at: string;
  rank: number;
  score: number;
  featured: boolean;
};

export type RowOptions = {
  /** Forces the category instead of inferring it from frontmatter and the repository name. */
  category?: string;
  /** Tags placed before the frontmatter tags. */
  extraTags?: readonly string[];
};

/** Parent folder of SKILL.md ("skills/drink-skill/SKILL.md" → "drink-skill"); empty when the file sits at the repo root. */
function skillDirName(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments.length >= 2 ? segments[segments.length - 2] : "";
}

export function buildDiscoveredSkillRow(
  md: string,
  path: string,
  repo: GitHubRepoMetadata,
  options: RowOptions = {},
): DiscoveredSkillRow {
  const fm = parseFrontmatter(md);
  const [owner, repoName] = repo.fullName.split("/");

  // Name: frontmatter > folder holding SKILL.md (verbatim) > repo name cleaned up
  const rawName = typeof fm.name === "string" ? fm.name : "";
  const name = rawName || skillDirName(path) || idToDisplayName(repoName);

  // Description: frontmatter > first non-heading paragraph of body
  let description = typeof fm.description === "string" ? fm.description : "";
  if (!description) {
    const body = md.replace(/^---[\s\S]*?---\r?\n?/, "");
    description = body
      .split(/\r?\n\r?\n/)
      .map((p) => p.replace(/^#+\s*/, "").trim())
      .find((p) => p.length > 20) ?? "";
  }
  description = description.slice(0, 1000);

  const rawCategory = typeof fm.category === "string" ? fm.category : null;
  const category = options.category ?? mapCategory(rawCategory ?? repo.fullName);

  const tags: string[] = [
    // Caller tags come first so the 8-tag cap never drops them.
    ...(options.extraTags ?? []),
    ...(Array.isArray(fm.tags) ? fm.tags.filter((t): t is string => typeof t === "string") : []),
    "community",
  ];
  const uniqueTags = Array.from(new Set(tags)).slice(0, 8);

  return {
    slug: deriveSlug(repo.fullName, path),
    name,
    description,
    category,
    tags: uniqueTags,
    author: owner,
    github_url: `https://github.com/${repo.fullName}/blob/${repo.defaultBranch}/${path}`,
    skill_md_content: md,
    ...checkedRepoStarsPatch(repo),
    // Seed values for new rows only; existing rows keep their curation.
    rank: 0,
    score: 0,
    featured: false,
  };
}

export type ImportOutcome = "imported" | "skipped" | "failed";

export interface ImportDeps {
  fetchSkillMd(contentsUrl: string): Promise<string | undefined>;
  getRepoMetadata(fullName: string): Promise<GitHubRepoMetadata>;
  /** Slugs already stored; updated in place as rows are renamed or inserted. */
  existingSlugs: Set<string>;
  renameSlug(from: string, to: string): Promise<void>;
  upsert(row: DiscoveredSkillRow): Promise<void>;
  /** Curated placement (category and tags) that must survive a re-import, such as the mini program topic. */
  placements?: ReadonlyMap<string, SkillPlacement>;
}

export type SkillPlacement = { category: string; tags: readonly string[] };

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Fetches, maps and stores one SKILL.md. Failures are logged and reported, never thrown. */
export async function importDiscoveredSkill(
  item: GitHubSkillItem,
  deps: ImportDeps,
  options: RowOptions = {},
): Promise<ImportOutcome> {
  const { repository: repo, path, url } = item;

  let md: string | undefined;
  try {
    md = await deps.fetchSkillMd(url);
  } catch (error) {
    // Keep importing the remaining files; the caller still fails the run.
    console.error(`\n  ✖ ${repo.full_name}/${path}: ${describe(error)}`);
    return "failed";
  }
  if (!md || md.trim().length < 20) return "skipped";

  // Code search can return a redirected old name; key the skill by the canonical one.
  let repoMetadata: GitHubRepoMetadata;
  try {
    repoMetadata = await deps.getRepoMetadata(repo.full_name);
  } catch (error) {
    console.error(`\n  ✖ ${repo.full_name}: ${describe(error)}`);
    return "failed";
  }

  const slug = deriveSlug(repoMetadata.fullName, path);
  const storedSlug = deriveSlug(repo.full_name, path);
  if (slug !== storedSlug && deps.existingSlugs.has(storedSlug) && !deps.existingSlugs.has(slug)) {
    try {
      await deps.renameSlug(storedSlug, slug);
    } catch (error) {
      console.error(`\n  ✖ rename ${storedSlug}: ${describe(error)}`);
      return "failed";
    }
    console.warn(`\n  ↪ renamed stored skill ${storedSlug} → ${slug}`);
    deps.existingSlugs.delete(storedSlug);
    deps.existingSlugs.add(slug);
  }

  const row = buildDiscoveredSkillRow(md, path, repoMetadata, options);
  const placement = deps.placements?.get(row.slug);
  if (placement) {
    row.category = placement.category;
    row.tags = Array.from(new Set([...placement.tags, ...row.tags])).slice(0, 8);
  }

  try {
    await deps.upsert(row);
  } catch (error) {
    console.error(`\n  ✖ ${row.slug}: ${describe(error)}`);
    return "failed";
  }
  return "imported";
}
