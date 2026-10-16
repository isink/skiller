import assert from "node:assert/strict";
import test from "node:test";

import { canonicalRepositoryURL, parseGitHubRepositoryURL, renamedRepoSlug } from "../lib/github-url";

test("GitHub repository URLs are parsed only from the exact HTTPS host", () => {
  assert.deepEqual(
    parseGitHubRepositoryURL("https://github.com/openai/codex/tree/main/example"),
    { owner: "openai", repo: "codex" },
  );
  assert.deepEqual(
    parseGitHubRepositoryURL("https://github.com/openai/codex.git"),
    { owner: "openai", repo: "codex" },
  );
});

test("missing URLs are skipped but malformed non-empty URLs fail", () => {
  assert.equal(parseGitHubRepositoryURL(null), undefined);
  assert.equal(parseGitHubRepositoryURL("  "), undefined);
  assert.throws(
    () => parseGitHubRepositoryURL("https://notgithub.com/openai/codex"),
    /Invalid GitHub repository URL/,
  );
  assert.throws(
    () => parseGitHubRepositoryURL("https://github.com/openai"),
    /Invalid GitHub repository URL/,
  );
});

test("renamed repositories map stored URLs and slugs to the canonical owner/repo", () => {
  const stored = "https://github.com/affaan-m/everything-claude-code/blob/main/skills/a b/SKILL.md";
  assert.equal(
    canonicalRepositoryURL(stored, "affaan-m/ECC"),
    "https://github.com/affaan-m/ECC/blob/main/skills/a b/SKILL.md",
  );
  assert.equal(
    canonicalRepositoryURL("https://github.com/Old/Repo/tree/main/x?y=1", "new/repo"),
    "https://github.com/new/repo/tree/main/x?y=1",
  );

  assert.equal(
    renamedRepoSlug(
      "affaan-m-everything-claude-code-skills-foo",
      "affaan-m/everything-claude-code",
      "affaan-m/ECC",
    ),
    "affaan-m-ecc-skills-foo",
  );
  assert.equal(renamedRepoSlug("pdf", "affaan-m/everything-claude-code", "affaan-m/ECC"), "pdf");
  assert.equal(renamedRepoSlug("owner-repository-x", "owner/repo", "owner/other"), "owner-repository-x");
});
