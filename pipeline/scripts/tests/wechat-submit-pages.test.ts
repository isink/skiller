import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPages, chunk, fetchSkillIds, parseArgs, submitPages, type FetchLike,
} from "../lib/wechat-submit-pages";

const ids = [1, 2, 3, 4, 5].map((n) => `0000000${n}-0000-0000-0000-00000000000${n}`);

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("pages cover the main pages, categories and every skill detail with its id", () => {
  const pages = buildPages([...ids, ids[0], "not-an-id"], ["code", "code", "bad slug!"]);
  assert.deepEqual(pages.slice(0, 4).map((page) => page.path), [
    "pages/landing/index", "pages/home/index", "pages/explore/index", "pages/radar/index",
  ]);
  assert.deepEqual(pages.filter((page) => page.query?.startsWith("category=")), [{ path: "pages/explore/index", query: "category=code" }]);
  const details = pages.filter((page) => page.path === "pages/detail/index");
  assert.deepEqual(details.map((page) => page.query), ids.map((id) => `id=${id}`));
});

test("WorkBuddy scene collections are submitted by slug", () => {
  const pages = buildPages([], [], ["finance", "finance", "bad slug!"]);
  assert.deepEqual(pages.filter((page) => page.path === "pages/scene/index"), [{ path: "pages/scene/index", query: "slug=finance" }]);
});

test("batches keep order and never exceed the size", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
  assert.throws(() => chunk([1], 0));
});

test("arguments parse flags and reject bad values", () => {
  assert.deepEqual(parseArgs([]), { dryRun: false, batchSize: 100 });
  assert.deepEqual(parseArgs(["--dry-run", "--batch-size=50", "--limit=7"]), { dryRun: true, batchSize: 50, limit: 7 });
  assert.throws(() => parseArgs(["--batch-size=1001"]));
  assert.throws(() => parseArgs(["--limit=0"]));
  assert.throws(() => parseArgs(["--submit"]));
});

test("dry run never calls fetch and needs no credentials", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => { calls.push(url); return jsonResponse({}); };
  const logs: string[] = [];
  const result = await submitPages({ pages: buildPages(ids), batchSize: 4, dryRun: true, fetchImpl, log: (m) => logs.push(m) });
  assert.deepEqual(calls, []);
  assert.equal(result.dryRun, true);
  assert.equal(result.batches, 3);
  assert.equal(result.submitted, 0);
  assert.match(logs.join("\n"), /no WeChat API calls/);
});

test("submission exchanges a token, then posts each batch without logging the token", async () => {
  const calls: Array<{ url: string; body?: string; method?: string }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, body: init?.body, method: init?.method });
    return url.includes("/cgi-bin/token") ? jsonResponse({ access_token: "TOKEN123", expires_in: 7200 }) : jsonResponse({ errcode: 0, errmsg: "ok" });
  };
  const logs: string[] = [];
  const pages = buildPages(ids);
  const result = await submitPages({
    pages, batchSize: 5, dryRun: false, appId: "wx-app", appSecret: "s3cret", fetchImpl,
    log: (m) => logs.push(m), sleep: async () => {},
  });

  assert.equal(calls[0].url, "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=wx-app&secret=s3cret");
  const submits = calls.slice(1);
  assert.equal(submits.length, 2);
  assert.ok(submits.every((call) => call.url === "https://api.weixin.qq.com/wxa/search/wxaapi_submitpages?access_token=TOKEN123" && call.method === "POST"));
  assert.deepEqual(submits.flatMap((call) => JSON.parse(call.body!).pages), pages);
  assert.equal(JSON.parse(submits[0].body!).pages.length, 5);
  assert.equal(result.submitted, pages.length);
  assert.ok(!logs.join("\n").includes("TOKEN123") && !logs.join("\n").includes("s3cret"));
});

test("a rejected batch stops submission and reports the WeChat error", async () => {
  let submits = 0;
  const fetchImpl: FetchLike = async (url) => {
    if (url.includes("/cgi-bin/token")) return jsonResponse({ access_token: "T" });
    submits++;
    return jsonResponse(submits === 1 ? { errcode: 0, errmsg: "ok" } : { errcode: 45009, errmsg: "reach max api daily quota limit" });
  };
  await assert.rejects(
    submitPages({ pages: buildPages(ids), batchSize: 3, dryRun: false, appId: "a", appSecret: "b", fetchImpl, sleep: async () => {} }),
    /Batch 2\/3 rejected \(errcode 45009.*3 pages submitted/,
  );
  assert.equal(submits, 2);
});

test("token failures and missing credentials are rejected before any submission", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ errcode: 40013, errmsg: "invalid appid" });
  await assert.rejects(submitPages({ pages: buildPages(ids), batchSize: 5, dryRun: false, appId: "a", appSecret: "b", fetchImpl }), /errcode 40013/);
  await assert.rejects(submitPages({ pages: buildPages(ids), batchSize: 5, dryRun: false, fetchImpl }), /WECHAT_MP_APPID/);
});

test("skill ids are read with a keyset cursor and respect the limit", async () => {
  const urls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    urls.push(url);
    const after = new URL(url).searchParams.get("id")?.replace("gt.", "") ?? "";
    const limit = Number(new URL(url).searchParams.get("limit"));
    return jsonResponse(ids.filter((id) => id > after).slice(0, limit).map((id) => ({ id })));
  };
  assert.deepEqual(await fetchSkillIds(fetchImpl, "https://example.supabase.co", "key", undefined, 2), ids);
  assert.equal(urls.length, 3);
  assert.ok(urls.every((url) => url.includes("order=id.asc") && url.includes("select=id")));
  assert.deepEqual(await fetchSkillIds(fetchImpl, "https://example.supabase.co", "key", 3, 2), ids.slice(0, 3));
});
