import assert from "node:assert/strict";
import test from "node:test";
import { fetchProductHuntPosts, parseProductHuntResponse, PRODUCT_HUNT_API } from "../lib/product-hunt";

const node = (overrides: Record<string, unknown> = {}) => ({
  node: {
    id: "1001",
    name: "  Agent  Studio ",
    tagline: "Build AI agents\nvisually",
    slug: "agent-studio",
    url: "https://www.producthunt.com/posts/agent-studio?utm_campaign=x",
    votesCount: 412,
    topics: { edges: [{ node: { name: "Artificial Intelligence" } }, { node: { name: "Developer Tools" } }, { node: {} }] },
    ...overrides,
  },
});

test("maps posts to candidates with normalized text and topics", () => {
  const [item] = parseProductHuntResponse({ data: { posts: { edges: [node()] } } });
  assert.deepEqual(item, {
    source: "product_hunt",
    sourceId: "1001",
    sourceUrl: "https://www.producthunt.com/posts/agent-studio",
    fullName: null,
    title: "Agent Studio",
    summary: "Build AI agents visually",
    language: null,
    topics: ["Artificial Intelligence", "Developer Tools"],
    starsToday: null,
    starsTotal: null,
    votesCount: 412,
  });
});

test("falls back to the url path without tracking params and skips incomplete posts", () => {
  const items = parseProductHuntResponse({
    data: {
      posts: {
        edges: [
          node({ slug: "", id: "2" }),
          node({ id: "" }),
          node({ id: "3", name: "" }),
          node({ id: "4", slug: "", url: "https://evil.example/posts/x" }),
          node({ id: "5", votesCount: "many", tagline: null }),
          { node: null },
        ],
      },
    },
  });
  assert.deepEqual(items.map((item) => item.sourceId), ["2", "5"]);
  assert.equal(items[0].sourceUrl, "https://www.producthunt.com/posts/agent-studio");
  assert.equal(items[1].votesCount, null);
  assert.equal(items[1].summary, null);
});

test("API errors and malformed bodies are errors, not empty results", () => {
  assert.throws(() => parseProductHuntResponse({ errors: [{ message: "invalid token" }] }), /invalid token/);
  assert.throws(() => parseProductHuntResponse({ data: {} }), /no posts/);
  assert.throws(() => parseProductHuntResponse(null), /no posts/);
});

test("fetch posts the ordered-by-votes query with a bearer token and time window", async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  const items = await fetchProductHuntPosts({
    token: "secret-token",
    windowHours: 24,
    first: 500,
    now: new Date("2026-10-29T06:00:00Z"),
    fetchImpl: (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ data: { posts: { edges: [node()] } } }), { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(items.length, 1);
  assert.equal(captured?.url, PRODUCT_HUNT_API);
  assert.equal(captured?.init.method, "POST");
  assert.equal((captured?.init.headers as Record<string, string>).Authorization, "Bearer secret-token");
  const body = JSON.parse(String(captured?.init.body));
  assert.match(body.query, /order: VOTES/);
  assert.deepEqual(body.variables, { after: "2026-10-28T06:00:00.000Z", first: 100 });
});

test("HTTP failures surface the status", async () => {
  await assert.rejects(
    fetchProductHuntPosts({ token: "t", fetchImpl: (async () => new Response("", { status: 401, statusText: "Unauthorized" })) as unknown as typeof fetch }),
    /401/,
  );
});
