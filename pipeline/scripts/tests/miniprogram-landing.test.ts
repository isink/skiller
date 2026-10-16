import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { hasEntryParams, shouldSkipLanding } from "../../../miniprogram/services/landing";

type LandingPage = {
  _redirected: boolean;
  onLoad(options: Record<string, string>): void;
  onShow(): void;
};

const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: LandingPage;
const originalPage = globals.Page;
globals.Page = (page: LandingPage) => { definition = page; };
require("../../../miniprogram/pages/landing/index");
globals.Page = originalPage;

const SEEN_KEY = "skiller.miniprogram.landing-seen.v1";

function harness(t: TestContext, options: { seen?: boolean; scene?: number } = {}) {
  const original = globals.wx;
  const storage = new Map<string, unknown>();
  if (options.seen) storage.set(SEEN_KEY, true);
  const redirects: string[] = [];
  const requests: Array<{ data: { event: string } }> = [];
  globals.wx = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    getEnterOptionsSync: () => ({ scene: options.scene ?? 1001 }),
    redirectTo: ({ url }: { url: string }) => { redirects.push(url); },
    request: (request: { data: { event: string } }) => { requests.push(request); },
  };
  t.after(() => { globals.wx = original; });
  return { storage, redirects, requests, page: { ...definition } };
}

test("first visit shows the landing page and marks it as seen", (t) => {
  const { page, storage, redirects } = harness(t);
  page.onLoad({});
  assert.deepEqual(redirects, []);
  assert.equal(storage.get(SEEN_KEY), true);
});

test("a returning visitor is redirected to home without a landing page view", (t) => {
  const { page, redirects, requests } = harness(t, { seen: true });
  page.onLoad({});
  page.onShow();
  assert.deepEqual(redirects, ["/pages/home/index"]);
  assert.equal(requests.length, 0);
});

test("a returning visitor with query parameters stays on the entry page", (t) => {
  const { page, redirects } = harness(t, { seen: true });
  page.onLoad({ id: "00000000-0000-0000-0000-000000000001" });
  assert.deepEqual(redirects, []);
});

test("a returning visitor arriving from a share card is not redirected", (t) => {
  const { page, redirects } = harness(t, { seen: true, scene: 1007 });
  page.onLoad({});
  assert.deepEqual(redirects, []);
});

test("entry parameter detection covers queries and share scenes only", () => {
  assert.equal(hasEntryParams({}, 1001), false);
  assert.equal(hasEntryParams(undefined, undefined), false);
  assert.equal(hasEntryParams({ from: "share" }), true);
  for (const scene of [1007, 1008, 1044, 1155]) assert.equal(hasEntryParams({}, scene), true);
});

test("an unseen landing page is never skipped", (t) => {
  harness(t);
  assert.equal(shouldSkipLanding({}, 1001), false);
});
