import assert from "node:assert/strict";
import test from "node:test";
import {
  MP_EXAMPLE_TAG,
  isSeedRepo,
  mpSkillPathsFromTree,
  mpSkillTags,
  parseMpImportArgs,
  selectMpSkillPaths,
} from "../lib/mp-skill";

const blob = (path: string) => ({ type: "blob", path });

test("a SKILL.md next to mcp.json is a mini program SKILL example", () => {
  const paths = mpSkillPathsFromTree([
    blob("app.json"),
    blob("skills/drink-skill/SKILL.md"),
    blob("skills/drink-skill/mcp.json"),
    blob("skills/drink-skill/index.js"),
    blob("skills/plain/SKILL.md"),
    { type: "tree", path: "skills" },
    blob("node_modules/pkg/SKILL.md"),
    blob("node_modules/pkg/mcp.json"),
    blob("docs/skill.md"),
    blob("docs/mcp.json"),
  ]);
  assert.deepEqual(paths.examples, ["docs/skill.md", "skills/drink-skill/SKILL.md"]);
  assert.deepEqual(paths.others, ["skills/plain/SKILL.md"]);
});

test("results are shallowest first and capped", () => {
  const entries = Array.from({ length: 5 }, (_, index) => [blob(`s${index}/SKILL.md`), blob(`s${index}/mcp.json`)]).flat();
  entries.push(blob("SKILL.md"), blob("mcp.json"));
  assert.deepEqual(mpSkillPathsFromTree(entries, 3).examples, ["SKILL.md", "s0/SKILL.md", "s1/SKILL.md"]);
  assert.deepEqual(mpSkillPathsFromTree(entries, 0).examples, []);
});

test("only known repositories contribute SKILL.md files without an mcp.json", () => {
  const paths = { examples: ["a/SKILL.md"], others: ["b/SKILL.md"] };
  assert.deepEqual(selectMpSkillPaths("someone/else", paths), [{ path: "a/SKILL.md", example: true }]);
  assert.deepEqual(selectMpSkillPaths("WeChat-Miniprogram/ai-mode-skills", paths), [
    { path: "a/SKILL.md", example: true },
    { path: "b/SKILL.md", example: false },
  ]);
  assert.equal(isSeedRepo("tencentcloudbase/awesome-miniprogram-skills"), true);
  assert.equal(isSeedRepo("someone/else"), false);
});

test("examples are tagged so the app can show them as references", () => {
  assert.deepEqual(mpSkillTags(true), ["wechat", "miniprogram", MP_EXAMPLE_TAG]);
  assert.deepEqual(mpSkillTags(false), ["wechat", "miniprogram"]);
});

test("the mini program import is a dry-run unless --apply is given", () => {
  assert.deepEqual(parseMpImportArgs([]), { apply: false, maxRepos: 30, minStars: 3, codeSearch: true });
  assert.equal(parseMpImportArgs(["--apply"]).apply, true);
  assert.equal(parseMpImportArgs(["--apply", "--dry-run"]).apply, false);
  assert.deepEqual(parseMpImportArgs(["--max-repos", "5", "--min-stars", "0", "--no-code-search"]), { apply: false, maxRepos: 5, minStars: 0, codeSearch: false });
  assert.throws(() => parseMpImportArgs(["--max-repos", "0"]), /--max-repos/);
  assert.throws(() => parseMpImportArgs(["--max-repos"]), /--max-repos/);
  assert.throws(() => parseMpImportArgs(["--force"]), /Unknown argument/);
});
