import assert from "node:assert/strict";
import test from "node:test";

import { planCuratedUpsert } from "../lib/curation";
import { checkedRepoStarsPatch, createGitHubRepoMetadataResolver } from "../lib/github-repo-metadata";

const checkedAt = "2026-10-12T04:00:00.000Z";

test("code-search items without stars resolve their stars from repository metadata", async () => {
  const searchItem = { repository: { full_name: "owner/repo", default_branch: "main" } };
  const requests: string[] = [];
  const resolve = createGitHubRepoMetadataResolver(async (fullName) => {
    requests.push(fullName);
    return { default_branch: "main", stargazers_count: 42 };
  }, () => new Date(checkedAt));

  const metadata = await resolve(searchItem.repository.full_name);
  assert.deepEqual(requests, ["owner/repo"]);
  assert.deepEqual(checkedRepoStarsPatch(metadata), {
    github_stars: 42, github_stars_checked_at: checkedAt,
  });
});

test("zero stars are a verified count and share the original check time across files", async () => {
  let requests = 0;
  let clockReads = 0;
  const resolve = createGitHubRepoMetadataResolver(async () => {
    requests++;
    return { default_branch: "master", stargazers_count: 0 };
  }, () => {
    clockReads++;
    return new Date(checkedAt);
  });

  const first = await resolve("owner/repo");
  const second = await resolve("Owner/Repo");
  assert.equal(first, second);
  assert.equal(requests, 1);
  assert.equal(clockReads, 1);
  assert.deepEqual(checkedRepoStarsPatch(first), {
    github_stars: 0, github_stars_checked_at: checkedAt,
  });
});

test("missing, malformed and failed metadata do not produce a freshness timestamp", async () => {
  for (const stars of [undefined, null, "42", -1, 1.5, NaN]) {
    let clockReads = 0;
    const resolve = createGitHubRepoMetadataResolver(async () => ({
      default_branch: "main", stargazers_count: stars,
    }), () => {
      clockReads++;
      return new Date(checkedAt);
    });
    await assert.rejects(resolve("owner/repo"), /no valid star count/);
    assert.equal(clockReads, 0);
  }

  await assert.rejects(
    createGitHubRepoMetadataResolver(async () => undefined)("owner/missing"),
    /no default branch/,
  );
  await assert.rejects(
    createGitHubRepoMetadataResolver(async () => ({ default_branch: "", stargazers_count: 42 }))("owner/repo"),
    /no default branch/,
  );
  let failedRequests = 0;
  const failingResolve = createGitHubRepoMetadataResolver(async () => {
    failedRequests++;
    throw new Error("GitHub 429 after retries");
  });
  await assert.rejects(failingResolve("owner/rate-limited"), /429/);
  await assert.rejects(failingResolve("owner/rate-limited"), /429/);
  assert.equal(failedRequests, 1);
});

test("a full import updates verified stars on existing skills while preserving curation", async () => {
  const resolve = createGitHubRepoMetadataResolver(async () => ({
    default_branch: "main", stargazers_count: 42,
  }), () => new Date(checkedAt));
  const metadata = await resolve("owner/repo");
  const plan = planCuratedUpsert([{
    slug: "owner-repo-skill",
    github_url: `https://github.com/owner/repo/blob/${metadata.defaultBranch}/skills/test/SKILL.md`,
    ...checkedRepoStarsPatch(metadata),
    rank: 0, score: 0, featured: false,
  }], new Set(["owner-repo-skill"]), { newOnly: false });

  assert.deepEqual(plan.update, [{
    slug: "owner-repo-skill",
    github_url: "https://github.com/owner/repo/blob/main/skills/test/SKILL.md",
    github_stars: 42,
    github_stars_checked_at: checkedAt,
  }]);
  assert.deepEqual(plan.insert, []);
});
