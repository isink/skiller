/**
 * Helpers for the 「微信小程序 SKILL」topic.
 *
 * WeChat's "小程序 AI 开发模式" lets a mini program declare SKILLs in app.json
 * (`agent.skills`) and describe them with AGENTS.md. Each SKILL is a directory
 * with SKILL.md, mcp.json and index.js
 * (https://developers.weixin.qq.com/miniprogram/dev/ai/integration.html).
 */
import type { TreeEntry } from "./github-discovery";

export const MP_SKILL_CATEGORY = "mp-skill";
export const MP_SKILL_CATEGORY_ROW = { slug: MP_SKILL_CATEGORY, name: "微信小程序 SKILL", icon: "sparkles" } as const;

/** Marks skills whose directory follows the mini program layout (SKILL.md + mcp.json). */
export const MP_EXAMPLE_TAG = "mp-example";
export const MP_SKILL_TAGS = ["wechat", "miniprogram"] as const;

/** Known repositories that belong to the topic even when they have no mcp.json (for example official helper skills). */
export const MP_SKILL_SEED_REPOS = [
  "wechat-miniprogram/ai-mode-demo",
  "wechat-miniprogram/ai-mode-skills",
  "TencentCloudBase/awesome-miniprogram-skills",
] as const;

export const MP_SKILL_REPO_QUERIES = [
  "小程序 AI 开发模式 in:readme,description",
  "wx.modelContext in:readme",
  "微信小程序 SKILL agent in:name,description,readme",
  "miniprogram AI skills mcp.json in:readme",
] as const;

/** Code search (authenticated, 10 requests/minute): files that register atomic APIs of a mini program SKILL. */
export const MP_SKILL_CODE_QUERY = "wx.modelContext.createSkill";

const IGNORED_SEGMENTS = new Set(["node_modules", ".git", "miniprogram_npm"]);

function directory(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function orderedPaths(paths: string[], limit: number): string[] {
  paths.sort((left, right) =>
    left.split("/").length - right.split("/").length
    || (left < right ? -1 : left > right ? 1 : 0));
  return paths.slice(0, Math.max(0, limit));
}

export type MpSkillPaths = {
  /** SKILL.md files that sit next to an mcp.json: a complete mini program SKILL. */
  examples: string[];
  /** Every other SKILL.md in the tree, only meaningful for seed repositories. */
  others: string[];
};

/** Splits SKILL.md paths of a git tree into mini program SKILL examples and the rest. */
export function mpSkillPathsFromTree(entries: readonly TreeEntry[], limit = 30): MpSkillPaths {
  const blobs = entries
    .filter((entry): entry is { path: string; type: string } => entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => entry.path)
    .filter((path) => !path.split("/").some((segment) => IGNORED_SEGMENTS.has(segment.toLowerCase())));
  const mcpDirs = new Set(blobs.filter((path) => basename(path).toLowerCase() === "mcp.json").map(directory));
  const skills = blobs.filter((path) => basename(path).toLowerCase() === "skill.md");
  return {
    examples: orderedPaths(skills.filter((path) => mcpDirs.has(directory(path))), limit),
    others: orderedPaths(skills.filter((path) => !mcpDirs.has(directory(path))), limit),
  };
}

export function isSeedRepo(fullName: string): boolean {
  const key = fullName.toLowerCase();
  return MP_SKILL_SEED_REPOS.some((seed) => seed.toLowerCase() === key);
}

/** Which SKILL.md files of a repository to import, and which tags they get. */
export function selectMpSkillPaths(
  fullName: string,
  paths: MpSkillPaths,
): Array<{ path: string; example: boolean }> {
  const selected = paths.examples.map((path) => ({ path, example: true }));
  if (isSeedRepo(fullName)) selected.push(...paths.others.map((path) => ({ path, example: false })));
  return selected;
}

export function mpSkillTags(example: boolean): string[] {
  return example ? [...MP_SKILL_TAGS, MP_EXAMPLE_TAG] : [...MP_SKILL_TAGS];
}

export type MpImportArgs = { apply: boolean; maxRepos: number; minStars: number; codeSearch: boolean };

export function parseMpImportArgs(argv: readonly string[]): MpImportArgs {
  const args: MpImportArgs = { apply: false, maxRepos: 30, minStars: 3, codeSearch: true };
  const integer = (flag: string, value: string | undefined, min: number, max: number) => {
    const parsed = Number(value);
    if (value === undefined || !Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`${flag} needs an integer from ${min} to ${max}`);
    }
    return parsed;
  };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    switch (flag) {
      case "--apply": args.apply = true; break;
      case "--dry-run": args.apply = false; break;
      case "--no-code-search": args.codeSearch = false; break;
      case "--max-repos": args.maxRepos = integer(flag, argv[++index], 1, 200); break;
      case "--min-stars": args.minStars = integer(flag, argv[++index], 0, 100000); break;
      default: throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}
