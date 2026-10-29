import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { fetchOpenRadarItem, fetchOpenRadarList } from "../../../miniprogram/services/open-radar";

type Reply = { statusCode: number; data: unknown } | { fail: string };
type Call = { url: string; header: Record<string, string> };

const globals = globalThis as typeof globalThis & { wx: unknown };
const ID = "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b";

function mockRequest(t: TestContext, reply: Reply): Call[] {
  const original = globals.wx;
  const calls: Call[] = [];
  globals.wx = {
    request(options: { url: string; header: Record<string, string>; success(r: unknown): void; fail(e: unknown): void }) {
      calls.push({ url: options.url, header: options.header });
      if ("fail" in reply) options.fail({ errMsg: reply.fail });
      else options.success(reply);
    },
  };
  t.after(() => { globals.wx = original; });
  return calls;
}

test("the list reads only the published view, newest first, with a bounded size", async (t) => {
  const calls = mockRequest(t, { statusCode: 200, data: [{ id: ID, title_zh: " 示例项目 ", summary: "一句话" }] });
  const items = await fetchOpenRadarList();
  assert.deepEqual(items, [{ id: ID, titleZh: "示例项目", summary: "一句话" }]);
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/rest/v1/open_radar_published");
  assert.equal(url.searchParams.get("select"), "id,title_zh,summary");
  assert.equal(url.searchParams.get("order"), "published_at.desc.nullslast,id.asc");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.ok(calls[0].header.apikey);
  assert.ok(!/open_radar_items/.test(calls[0].url));
});

test("an empty or unexpected response gives an empty list", async (t) => {
  mockRequest(t, { statusCode: 200, data: [] });
  assert.deepEqual(await fetchOpenRadarList(), []);
  mockRequest(t, { statusCode: 201, data: undefined });
  assert.deepEqual(await fetchOpenRadarList(), []);
});

test("rows without a valid id or title are dropped", async (t) => {
  mockRequest(t, { statusCode: 200, data: [{ id: "x", title_zh: "A", summary: "s" }, { id: ID, title_zh: "  " }, null] });
  assert.deepEqual(await fetchOpenRadarList(), []);
});

test("a missing view (migration not applied yet) counts as no entries, other failures are errors", async (t) => {
  mockRequest(t, { statusCode: 404, data: { code: "PGRST205", message: "Could not find the table" } });
  assert.deepEqual(await fetchOpenRadarList(), []);
  mockRequest(t, { statusCode: 404, data: { code: "PGRST205", message: "missing" } });
  assert.equal(await fetchOpenRadarItem(ID), null);

  mockRequest(t, { statusCode: 500, data: { message: "boom" } });
  await assert.rejects(fetchOpenRadarList(), /boom/);
  mockRequest(t, { fail: "request:fail timeout" });
  await assert.rejects(fetchOpenRadarList(), /timeout/);
});

test("detail maps the README as the body and ignores summary and pitfalls", async (t) => {
  const calls = mockRequest(t, {
    statusCode: 200,
    data: [{
      id: ID, title_zh: "示例项目", summary: "中文摘要", readme_md: "\n# Demo\n\nInstall it.\n", pitfalls: ["先装依赖"],
      install_command: " npm i demo ", article_url: "https://mp.weixin.qq.com/s/demo", package_url: null,
    }],
  });
  const item = await fetchOpenRadarItem(ID);
  assert.deepEqual(item, {
    id: ID, titleZh: "示例项目", readmeMd: "# Demo\n\nInstall it.",
    installCommand: "npm i demo", articleUrl: "https://mp.weixin.qq.com/s/demo", packageUrl: "",
  });
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("id"), `eq.${ID}`);
  assert.equal(url.searchParams.get("select"), "id,title_zh,readme_md,install_command,article_url,package_url");
  assert.equal(url.searchParams.get("limit"), "1");
});

test("detail without a README (not backfilled yet) maps to an empty body, never to the summary", async (t) => {
  mockRequest(t, { statusCode: 200, data: [{ id: ID, title_zh: "示例项目", summary: "中文摘要", readme_md: null }] });
  const item = await fetchOpenRadarItem(ID);
  assert.equal(item?.readmeMd, "");
  assert.ok(item && !("summary" in item));
});

test("the list keeps the short Chinese summary and does not request the README", async (t) => {
  const calls = mockRequest(t, { statusCode: 200, data: [{ id: ID, title_zh: "示例项目", summary: "一句话", readme_md: "# long" }] });
  assert.deepEqual(await fetchOpenRadarList(), [{ id: ID, titleZh: "示例项目", summary: "一句话" }]);
  assert.ok(!new URL(calls[0].url).searchParams.get("select")?.includes("readme_md"));
});

test("detail returns null for unknown ids without calling the network", async (t) => {
  const calls = mockRequest(t, { statusCode: 200, data: [] });
  assert.equal(await fetchOpenRadarItem("demo"), null);
  assert.equal(await fetchOpenRadarItem(""), null);
  assert.equal(await fetchOpenRadarItem(`${ID}&select=*`), null);
  assert.equal(calls.length, 0);
  assert.equal(await fetchOpenRadarItem(ID), null);
  assert.equal(calls.length, 1);
});

test("the client never references base-table or source columns", () => {
  const source = readFileSync(join(__dirname, "../../../miniprogram/services/open-radar.ts"), "utf8");
  for (const internal of ["open_radar_items", "full_name", "source_url", "source_id"]) assert.ok(!source.includes(internal), internal);
  assert.ok(!/github/i.test(source));
});
