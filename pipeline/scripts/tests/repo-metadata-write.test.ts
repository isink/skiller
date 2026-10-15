import assert from "node:assert/strict";
import test from "node:test";

import { applyRepositoryMetadata } from "../lib/repo-metadata-write";

test("fallback repository refresh uses the snapshot-aware transaction", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { error: null };
    },
    from: () => { throw new Error("repository metadata must not write tables directly"); },
  };
  const state = await applyRepositoryMetadata(client, "owner/repo", {
    status: 200,
    body: {
      default_branch: "main",
      stargazers_count: 42,
      pushed_at: "2026-10-12T01:00:00Z",
    },
  });

  assert.deepEqual(calls, [{
    name: "apply_skill_repo_metadata",
    args: {
      p_repo_key: "owner/repo", p_found: true, p_stars: 42,
      p_default_branch: "main", p_pushed_at: "2026-10-12T01:00:00Z",
    },
  }]);
  assert.deepEqual({ ...state, checked_at: null }, {
    repo_key: "owner/repo", stars: 42, default_branch: "main",
    pushed_at: "2026-10-12T01:00:00Z", checked_at: null,
  });
  assert.ok(Number.isFinite(Date.parse(state.checked_at)));
});

test("a confirmed missing repository clears metadata through the same RPC", async () => {
  const calls: unknown[] = [];
  const state = await applyRepositoryMetadata({
    rpc: async (_name, args) => { calls.push(args); return { error: null }; },
  }, "owner/deleted", { status: 404, body: null });

  assert.deepEqual(calls, [{
    p_repo_key: "owner/deleted", p_found: false, p_stars: null,
    p_default_branch: "", p_pushed_at: null,
  }]);
  assert.equal(state.stars, null);
  assert.equal(state.default_branch, "");
  assert.equal(state.pushed_at, null);
});

test("zero stars and a null repository pushed_at are valid metadata", async () => {
  const state = await applyRepositoryMetadata({
    rpc: async (_name, args) => {
      assert.equal(args.p_found, true);
      assert.equal(args.p_stars, 0);
      assert.equal(args.p_pushed_at, null);
      return { error: null };
    },
  }, "owner/empty", {
    status: 200, body: { default_branch: "main", stargazers_count: 0, pushed_at: null },
  });
  assert.equal(state.stars, 0);
});

test("invalid repository payloads never publish successful refresh progress", async () => {
  const client = { rpc: async () => { throw new Error("RPC must not be called"); } };
  for (const payload of [
    null,
    undefined,
    {},
    { default_branch: "main", stargazers_count: -1, pushed_at: null },
    { default_branch: "main", stargazers_count: 1.5, pushed_at: null },
    { default_branch: "main", stargazers_count: 1, pushed_at: "invalid" },
    { default_branch: "", stargazers_count: 1, pushed_at: null },
  ]) {
    await assert.rejects(
      applyRepositoryMetadata(client, "owner/repo", { status: 200, body: payload }),
      /Invalid GitHub repository metadata/,
    );
  }
});

test("a 200 null response cannot clear a repository or publish successful progress", async () => {
  let writes = 0;
  const progress = new Map();
  await assert.rejects(async () => {
    const state = await applyRepositoryMetadata({
      rpc: async () => { writes++; return { error: null }; },
    }, "owner/repo", { status: 200, body: null });
    progress.set("owner/repo", state);
  }, /Invalid GitHub repository metadata/);
  assert.equal(writes, 0);
  assert.equal(progress.size, 0);
});

test("statuses other than 200 and confirmed 404 cannot write refresh metadata", async () => {
  let writes = 0;
  const client = { rpc: async () => { writes++; return { error: null }; } };
  for (const status of [201, 204, 403, 409, 429, 500, 503]) {
    await assert.rejects(
      applyRepositoryMetadata(client, "owner/repo", { status, body: null }),
      new RegExp(`Unexpected GitHub repository status ${status}`),
    );
  }
  assert.equal(writes, 0);
});

test("a failed metadata transaction cannot advance the caller's progress", async () => {
  const progress = new Map();
  await assert.rejects(async () => {
    const state = await applyRepositoryMetadata({
      rpc: async () => ({ error: { message: "snapshot insert failed" } }),
    }, "owner/repo", {
      status: 200, body: { default_branch: "main", stargazers_count: 42, pushed_at: null },
    });
    progress.set("owner/repo", state);
  }, /snapshot insert failed/);
  assert.equal(progress.size, 0);
});
