import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiscoveredSkillRow,
  deriveSlug,
  importDiscoveredSkill,
  parseFrontmatter,
  type DiscoveredSkillRow,
  type ImportDeps,
} from "../lib/github-discovered-skill";
import type { GitHubSkillItem } from "../lib/github-api";
import type { GitHubRepoMetadata } from "../lib/github-repo-metadata";

const metadata: GitHubRepoMetadata = { fullName: "Acme/Tools", defaultBranch: "main", stars: 42, starsCheckedAt: "2026-10-16T00:00:00.000Z" };
const md = "---\nname: PDF Reader\ndescription: Reads PDFs\ntags: [pdf, docs]\ncategory: office\n---\n# Body of the skill";

test("frontmatter scalars and inline lists are parsed", () => {
  assert.deepEqual(parseFrontmatter(md), { name: "PDF Reader", description: "Reads PDFs", tags: ["pdf", "docs"], category: "office" });
  assert.deepEqual(parseFrontmatter("# no frontmatter"), {});
});

test("slugs combine the repository and folder", () => {
  assert.equal(deriveSlug("Acme/Tools", "skills/pdf/SKILL.md"), "acme-tools-skills-pdf");
  assert.equal(deriveSlug("Acme/Tools", "SKILL.md"), "acme-tools");
  assert.ok(deriveSlug("a/b", `${"x/".repeat(60)}SKILL.md`).length <= 80);
});

test("the row keeps the importer contract and seeds curation fields", () => {
  const row = buildDiscoveredSkillRow(md, "skills/pdf/SKILL.md", metadata);
  assert.deepEqual(row, {
    slug: "acme-tools-skills-pdf",
    name: "PDF Reader",
    description: "Reads PDFs",
    category: "office",
    tags: ["pdf", "docs", "community"],
    author: "Acme",
    github_url: "https://github.com/Acme/Tools/blob/main/skills/pdf/SKILL.md",
    skill_md_content: md,
    github_stars: 42,
    github_stars_checked_at: "2026-10-16T00:00:00.000Z",
    rank: 0,
    score: 0,
    featured: false,
  });
});

test("name and description fall back to the repository and first paragraph", () => {
  const row = buildDiscoveredSkillRow("# Title\n\nThis paragraph is long enough to count as the summary.\n\nNext", "SKILL.md", { ...metadata, fullName: "acme/my-tool" });
  assert.equal(row.name, "My Tool");
  assert.equal(row.description, "This paragraph is long enough to count as the summary.");
});

test("without frontmatter name, each SKILL.md in one repo is named after its own folder", () => {
  const repo = { ...metadata, fullName: "acme/miniprogram-demo" };
  const body = "# Title\n\nThis paragraph is long enough to count as the summary.";
  const names = ["skills/drink-skill/SKILL.md", "skills/agent-auth-skill/SKILL.md", "bill-skill/SKILL.md"]
    .map((path) => buildDiscoveredSkillRow(body, path, repo).name);
  assert.deepEqual(names, ["drink-skill", "agent-auth-skill", "bill-skill"]);
});

test("a frontmatter name wins over the folder name", () => {
  const row = buildDiscoveredSkillRow(md, "skills/drink-skill/SKILL.md", { ...metadata, fullName: "acme/ai-mode-demo" });
  assert.equal(row.name, "PDF Reader");
});

test("a SKILL.md at the repository root without frontmatter name uses the repository name", () => {
  const row = buildDiscoveredSkillRow("# Title\n\nNo frontmatter here, just a body.", "SKILL.md", { ...metadata, fullName: "acme/ai-mode-demo" });
  assert.equal(row.name, "Ai Mode Demo");
});

test("a forced category and caller tags win and survive the tag cap", () => {
  const tags = "[a, b, c, d, e, f, g, h, i]";
  const row = buildDiscoveredSkillRow(`---\nname: x\ntags: ${tags}\n---\nbody body body body`, "SKILL.md", metadata, { category: "mp-skill", extraTags: ["wechat", "mp-example"] });
  assert.equal(row.category, "mp-skill");
  assert.deepEqual(row.tags, ["wechat", "mp-example", "a", "b", "c", "d", "e", "f"]);
});

const item = (path = "skills/pdf/SKILL.md"): GitHubSkillItem => ({
  name: "SKILL.md", path, url: `https://api.github.com/repos/acme/tools/contents/${path}`,
  repository: { full_name: "acme/tools", html_url: "https://github.com/acme/tools", description: null },
});

function deps(overrides: Partial<ImportDeps> = {}) {
  const rows: DiscoveredSkillRow[] = [];
  const renames: Array<[string, string]> = [];
  const value: ImportDeps = {
    fetchSkillMd: async () => md,
    getRepoMetadata: async () => metadata,
    existingSlugs: new Set<string>(),
    renameSlug: async (from, to) => { renames.push([from, to]); },
    upsert: async (row) => { rows.push(row); },
    ...overrides,
  };
  return { value, rows, renames };
}

async function quiet<T>(run: () => Promise<T>): Promise<T> {
  const { error, warn } = console;
  console.error = () => {}; console.warn = () => {};
  try { return await run(); } finally { console.error = error; console.warn = warn; }
}

test("a fetched SKILL.md is stored under the canonical repository name", async () => {
  const { value, rows } = deps();
  assert.equal(await importDiscoveredSkill(item(), value), "imported");
  assert.equal(rows[0].slug, "acme-tools-skills-pdf");
  assert.equal(rows[0].author, "Acme");
});

test("missing or tiny files are skipped; fetch and metadata errors fail without throwing", async () => {
  assert.equal(await importDiscoveredSkill(item(), deps({ fetchSkillMd: async () => undefined }).value), "skipped");
  assert.equal(await importDiscoveredSkill(item(), deps({ fetchSkillMd: async () => "tiny" }).value), "skipped");
  assert.equal(await quiet(() => importDiscoveredSkill(item(), deps({ fetchSkillMd: async () => { throw new Error("500"); } }).value)), "failed");
  assert.equal(await quiet(() => importDiscoveredSkill(item(), deps({ getRepoMetadata: async () => { throw new Error("gone"); } }).value)), "failed");
  assert.equal(await quiet(() => importDiscoveredSkill(item(), deps({ upsert: async () => { throw new Error("db"); } }).value)), "failed");
});

test("a renamed repository renames the stored slug first", async () => {
  const existing = new Set(["acme-old-skills-pdf"]);
  const { value, renames } = deps({ existingSlugs: existing, getRepoMetadata: async () => ({ ...metadata, fullName: "acme/new" }) });
  const renamed = item();
  renamed.repository.full_name = "acme/old";
  assert.equal(await quiet(() => importDiscoveredSkill(renamed, value)), "imported");
  assert.deepEqual(renames, [["acme-old-skills-pdf", "acme-new-skills-pdf"]]);
  assert.ok(existing.has("acme-new-skills-pdf") && !existing.has("acme-old-skills-pdf"));

  const failing = deps({ existingSlugs: new Set(["acme-old-skills-pdf"]), getRepoMetadata: async () => ({ ...metadata, fullName: "acme/new" }), renameSlug: async () => { throw new Error("conflict"); } });
  assert.equal(await quiet(() => importDiscoveredSkill(renamed, failing.value)), "failed");
  assert.equal(failing.rows.length, 0);
});

test("a re-import keeps the curated topic placement", async () => {
  const placements = new Map([["acme-tools-skills-pdf", { category: "mp-skill", tags: ["wechat", "mp-example"] }]]);
  const { value, rows } = deps({ placements });
  await importDiscoveredSkill(item(), value);
  assert.equal(rows[0].category, "mp-skill");
  assert.deepEqual(rows[0].tags, ["wechat", "mp-example", "pdf", "docs", "community"]);

  const other = deps({ placements });
  await importDiscoveredSkill(item("skills/other/SKILL.md"), other.value);
  assert.equal(other.rows[0].category, "office");
});
