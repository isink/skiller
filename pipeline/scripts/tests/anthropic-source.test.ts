import assert from "node:assert/strict";
import test from "node:test";

import { anthropicSkillURLs, discoverAnthropicSkillSources } from "../lib/anthropic-source";
import { planCuratedUpsert } from "../lib/curation";

const repository = { owner: "anthropics", repo: "skills", branch: "main" };

test("official discovery reads the skills container and preserves historical slugs", async () => {
  const calls: string[] = [];
  const sources = await discoverAnthropicSkillSources(async (path) => {
    calls.push(path);
    return path === ""
      ? [
          { name: ".claude-plugin", path: ".claude-plugin", type: "dir" },
          { name: "skills", path: "skills", type: "dir" },
          { name: "spec", path: "spec", type: "dir" },
          { name: "template", path: "template", type: "dir" },
        ]
      : [
          { name: "pdf", path: "skills/pdf", type: "dir" },
          { name: "docx", path: "skills/docx", type: "dir" },
          { name: "README.md", path: "skills/README.md", type: "file" },
        ];
  });

  assert.deepEqual(calls, ["", "skills"]);
  assert.deepEqual(sources, [
    { slug: "pdf", directoryPath: "skills/pdf", skillFilePath: "skills/pdf/SKILL.md" },
    { slug: "docx", directoryPath: "skills/docx", skillFilePath: "skills/docx/SKILL.md" },
  ]);
});

test("old root-layout repositories keep their original paths and slugs", async () => {
  const calls: string[] = [];
  const sources = await discoverAnthropicSkillSources(async (path) => {
    calls.push(path);
    return [
      { name: "pdf", path: "pdf", type: "dir" },
      { name: ".github", path: ".github", type: "dir" },
      { name: "README.md", path: "README.md", type: "file" },
    ];
  });
  assert.deepEqual(calls, [""]);
  assert.deepEqual(sources, [{ slug: "pdf", directoryPath: "pdf", skillFilePath: "pdf/SKILL.md" }]);
});

test("raw content, displayed GitHub link and commit dates refer to the same actual skill", () => {
  for (const directoryPath of ["skills/pdf", "pdf"]) {
    const urls = anthropicSkillURLs({
      slug: "pdf", directoryPath, skillFilePath: `${directoryPath}/SKILL.md`,
    }, repository);
    assert.equal(urls.rawUrl, `https://raw.githubusercontent.com/anthropics/skills/main/${directoryPath}/SKILL.md`);
    assert.equal(urls.githubUrl, `https://github.com/anthropics/skills/tree/main/${directoryPath}`);
    const commits = new URL(urls.commitsUrl);
    assert.equal(commits.pathname, "/repos/anthropics/skills/commits");
    assert.equal(commits.searchParams.get("path"), `${directoryPath}/SKILL.md`);
    assert.equal(commits.searchParams.get("sha"), "main");
  }
});

test("a moved official skill updates the same catalog row without changing curation", async () => {
  const [source] = await discoverAnthropicSkillSources(async (path) => path === ""
    ? [{ name: "skills", path: "skills", type: "dir" }]
    : [{ name: "pdf", path: "skills/pdf", type: "dir" }]);
  const urls = anthropicSkillURLs(source, repository);
  const plan = planCuratedUpsert([{
    slug: source.slug, github_url: urls.githubUrl, category: "office",
    rank: 80, score: 95, featured: true,
  }], new Set(["pdf"]));
  assert.deepEqual(plan.insert, []);
  assert.deepEqual(plan.update, [{
    slug: "pdf", github_url: "https://github.com/anthropics/skills/tree/main/skills/pdf", category: "office",
  }]);
  assert.deepEqual(planCuratedUpsert([{ slug: source.slug }], new Set(["pdf"]), { newOnly: true }), {
    insert: [], update: [],
  });
});

test("malformed directory payloads fail before producing import rows", async () => {
  await assert.rejects(discoverAnthropicSkillSources(async () => ({ message: "Not Found" })), /must be an array/);
  await assert.rejects(discoverAnthropicSkillSources(async () => [null]), /invalid entry/);
});
