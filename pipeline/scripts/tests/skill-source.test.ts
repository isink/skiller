import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalSkillSourceURL, fetchSkillFileDate, latestCommitDate, needsSourceCheck, resolveSkillSource } from "../lib/skill-source";

test("tree links resolve to their own SKILL.md, including nested branches", () => {
  assert.deepEqual(
    resolveSkillSource("https://github.com/acme/skills/tree/release/v2/skills/pdf", "release/v2"),
    { owner: "acme", repo: "skills", ref: "release/v2", path: "skills/pdf/SKILL.md" },
  );
  assert.deepEqual(
    resolveSkillSource("https://github.com/acme/skills/tree/HEAD/skills/docx", "main"),
    { owner: "acme", repo: "skills", ref: "main", path: "skills/docx/SKILL.md" },
  );
});

test("blob links keep the exact file path and unknown refs remain unknown", () => {
  assert.deepEqual(
    resolveSkillSource("https://github.com/acme/skills/blob/main/tools/SKILL.md", "main"),
    { owner: "acme", repo: "skills", ref: "main", path: "tools/SKILL.md" },
  );
  assert.deepEqual(
    resolveSkillSource("https://github.com/acme/skills/blob/undefined/.agent/skills/pdf/SKILL.md", "master"),
    { owner: "acme", repo: "skills", ref: "master", path: ".agent/skills/pdf/SKILL.md" },
  );
  assert.equal(
    canonicalSkillSourceURL(
      "https://github.com/acme/skills/blob/undefined/.agent/skills/pdf/SKILL.md",
      { owner: "acme", repo: "skills", ref: "master", path: ".agent/skills/pdf/SKILL.md" },
    ),
    "https://github.com/acme/skills/blob/master/.agent/skills/pdf/SKILL.md",
  );
  assert.deepEqual(
    resolveSkillSource("https://github.com/acme/skills/tree/main/tools/pdf", "master"),
    { owner: "acme", repo: "skills", ref: "main", path: "tools/pdf/SKILL.md" },
  );
  assert.equal(resolveSkillSource("https://github.com/acme/skills/tree/topic/feature/tools", "main"), null);
  assert.equal(resolveSkillSource("https://example.com/acme/skills/tree/main/tools", "main"), null);
});

test("latest file commit uses its committer date and never invents missing dates", () => {
  assert.equal(latestCommitDate([{ commit: { committer: { date: "2026-09-30T12:00:00Z" } } }]), "2026-09-30T12:00:00Z");
  assert.equal(latestCommitDate([]), null);
  assert.equal(latestCommitDate([{ commit: { committer: { date: "bad" } } }]), null);
});

test("deleted files show an unknown date without querying historical deletion commits", async () => {
  const source = resolveSkillSource("https://github.com/acme/skills/tree/main/tools/pdf", "main");
  assert.ok(source);
  const calls: string[] = [];
  const result = await fetchSkillFileDate(source, async (url) => {
    calls.push(url);
    return { status: 404, body: null };
  });
  assert.deepEqual(result, { updatedAt: null, missing: true });
  assert.equal(calls.length, 1);
});

test("two skills in one repo retain distinct file commit dates", async () => {
  const paths = ["tools/pdf", "tools/docx"];
  const dates = ["2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z"];
  const results = await Promise.all(paths.map(async (path, index) => {
    const source = resolveSkillSource(`https://github.com/acme/skills/tree/main/${path}`, "main");
    assert.ok(source);
    return fetchSkillFileDate(source, async (url) => url.includes("/contents/")
      ? { status: 200, body: { type: "file", name: "SKILL.md" } }
      : { status: 200, body: [{ commit: { committer: { date: dates[index] } } }] });
  }));
  assert.deepEqual(results.map((item) => item.updatedAt), dates);
});

test("same repository push is skipped, while a changed source URL is rechecked", () => {
  const skill = {
    github_url: "https://github.com/acme/skills/tree/main/tools/pdf",
    source_url_checked: "https://github.com/acme/skills/tree/main/tools/pdf",
    source_checked_at: "2026-10-01T00:00:00Z",
    source_repo_pushed_at: "2026-09-30T00:00:00Z",
  };
  assert.equal(needsSourceCheck(skill, "2026-09-30T00:00:00.000Z"), false);
  assert.equal(needsSourceCheck({ ...skill, github_url: "https://github.com/acme/skills/tree/main/tools/docx" }, "2026-09-30T00:00:00Z"), true);
  assert.equal(needsSourceCheck(skill, "2026-10-02T00:00:00Z"), true);
});
