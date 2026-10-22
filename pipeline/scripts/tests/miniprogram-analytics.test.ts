/// <reference path="../../../miniprogram/types/wx.d.ts" />
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../miniprogram/services/config";
import {
  getAnonId,
  isEmptySearch,
  trackError,
  trackEvent,
  trackPageView,
  trackCopyInstall,
  trackSearch,
  trackShare,
} from "../../../miniprogram/services/analytics";

interface RequestOptions {
  url: string;
  method: string;
  header: Record<string, string>;
  data: Record<string, unknown>;
  success(response: { statusCode: number }): void;
  fail(error: { errMsg: string }): void;
}

const globals = globalThis as typeof globalThis & { wx: unknown };
let sequence = 0;
const unique = (label: string) => `${label}-${Date.now()}-${++sequence}`;

function mockWx(t: TestContext, behaviour: (options: RequestOptions) => void = (options) => options.success({ statusCode: 201 })) {
  const original = globals.wx;
  const requests: RequestOptions[] = [];
  const storage = new Map<string, unknown>();
  t.after(() => { globals.wx = original; });
  globals.wx = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    request(options: RequestOptions) { requests.push(options); behaviour(options); },
  };
  return { requests, storage };
}

test("page views post a minimal event row with the anon key", async (t) => {
  const { requests } = mockWx(t);
  const page = unique("pages/detail/index");
  await trackPageView(page, { id: "skill-1" });

  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.url, `${SUPABASE_URL}/rest/v1/mp_events`);
  assert.equal(request.method, "POST");
  assert.equal(request.header.apikey, SUPABASE_ANON_KEY);
  assert.equal(request.header.Authorization, `Bearer ${SUPABASE_ANON_KEY}`);
  assert.equal(request.header.Prefer, "return=minimal");
  assert.equal(request.header["Content-Type"], "application/json");
  assert.equal(request.data.event, "page_view");
  assert.equal(request.data.page, page);
  assert.deepEqual(request.data.meta, { id: "skill-1" });
  assert.equal(request.data.anon_id, getAnonId());
  assert.deepEqual(Object.keys(request.data).sort(), ["anon_id", "event", "meta", "page"]);
});

test("the anonymous id is generated once and persisted in storage", (t) => {
  const { storage } = mockWx(t);
  const first = getAnonId();
  assert.match(first, /^a[0-9a-z]+$/);
  assert.equal(storage.get("skiller.miniprogram.anon-id.v1"), first);
  assert.equal(getAnonId(), first);
});

test("a stored anonymous id is reused", (t) => {
  const { storage } = mockWx(t);
  storage.set("skiller.miniprogram.anon-id.v1", "a-existing-id");
  assert.equal(getAnonId(), "a-existing-id");
});

test("network failures, bad statuses and thrown errors are swallowed", async (t) => {
  mockWx(t, (options) => options.fail({ errMsg: "request:fail" }));
  await assert.doesNotReject(trackEvent("page_view", { page: unique("fail") }));

  mockWx(t, (options) => options.success({ statusCode: 401 }));
  await assert.doesNotReject(trackEvent("page_view", { page: unique("401") }));

  mockWx(t, () => { throw new Error("wx.request exploded"); });
  await assert.doesNotReject(trackEvent("page_view", { page: unique("throw") }));
  await assert.doesNotReject(trackError(new Error("boom")));

  globals.wx = undefined;
  await assert.doesNotReject(trackEvent("page_view", { page: unique("no-wx") }));
});

test("empty search detection requires a real query with zero results", () => {
  assert.equal(isEmptySearch("claude", 0), true);
  assert.equal(isEmptySearch("claude", 3), false);
  assert.equal(isEmptySearch("   ", 0), false);
  assert.equal(isEmptySearch("", 0), false);
});

test("a search with results reports only `search`", async (t) => {
  const { requests } = mockWx(t);
  const query = unique("pdf");
  await trackSearch("pages/home/index", `  ${query}  `, 4);

  assert.deepEqual(requests.map((request) => request.data.event), ["search"]);
  assert.equal(requests[0].data.query, query);
  assert.equal(requests[0].data.result_count, 4);
});

test("a search with no results reports `search` and `search_empty`", async (t) => {
  const { requests } = mockWx(t);
  const query = unique("zzzz");
  await trackSearch("pages/home/index", query, 0);

  assert.deepEqual(requests.map((request) => request.data.event), ["search", "search_empty"]);
  assert.ok(requests.every((request) => request.data.result_count === 0 && request.data.query === query));
});

test("long queries and errors are clipped to the database limits", async (t) => {
  const { requests } = mockWx(t);
  await trackSearch("pages/home/index", "q".repeat(500), 1);
  await trackError("e".repeat(5000), "pages/home/index");

  const search = requests.find((request) => request.data.event === "search");
  const error = requests.find((request) => request.data.event === "js_error");
  assert.equal((search?.data.query as string).length, 200);
  assert.equal((error?.data.error as string).length, 2000);
  assert.equal(error?.data.page, "pages/home/index");
});

test("errors are described from Error objects and rejection reasons", async (t) => {
  const { requests } = mockWx(t);
  const message = unique("reason");
  await trackError({ message }, "pages/radar/index");
  await trackError(unique("plain string"), "pages/radar/index");

  assert.equal(requests[0].data.error, message);
  assert.match(requests[1].data.error as string, /^plain string-/);
});

test("repeated events are throttled but distinct events still go through", async (t) => {
  const { requests } = mockWx(t);
  const clock = t.mock.method(Date, "now", () => 1_000_000);
  const page = unique("pages/home/index");

  await trackPageView(page);
  await trackPageView(page);
  assert.equal(requests.length, 1);

  await trackPageView(unique("pages/other/index"));
  assert.equal(requests.length, 2);

  clock.mock.mockImplementation(() => 1_000_000 + 60_000);
  await trackPageView(page);
  assert.equal(requests.length, 3);
});

test("share events name the page and omit skill fields when a page shares itself", async (t) => {
  const { requests } = mockWx(t);
  const skill = { id: unique("skill"), slug: "pdf" };
  await trackShare(null, "menu", false, "pages/landing/index");
  await trackShare(skill, "button", true);
  await trackShare(skill, "menu", false, "pages/landing/index");

  const [pageShare, detailShare, landingShare] = requests.map((request) => request.data);
  assert.equal(pageShare.event, "share");
  assert.equal(pageShare.page, "pages/landing/index");
  assert.deepEqual(pageShare.meta, { action: "share", channel: "menu", card: false });
  assert.equal(detailShare.page, "pages/detail/index");
  assert.deepEqual(detailShare.meta, { action: "share", id: skill.id, slug: "pdf", channel: "button", card: true });
  assert.equal(landingShare.page, "pages/landing/index");
});

test("copy_install events default to the detail page and accept another page", async (t) => {
  const { requests } = mockWx(t);
  const skill = { id: unique("skill"), slug: "pdf" };
  await trackCopyInstall(skill, "npx", "primary");
  await trackCopyInstall(skill, "npx", "primary", "pages/landing/index");
  assert.deepEqual(requests.map((request) => request.data.page), ["pages/detail/index", "pages/landing/index"]);
  assert.deepEqual(requests[1].data.meta, { action: "copy_install", id: skill.id, slug: "pdf", kind: "npx", target: "primary" });
});
