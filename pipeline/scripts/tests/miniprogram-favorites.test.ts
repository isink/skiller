import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { toggleFavorite } from "../../../miniprogram/services/storage";
import type { Skill } from "../../../miniprogram/types/skill";

type FavoritePage = {
  data: { skills: Skill[]; loading: boolean; error: string };
  _favoriteRequestSequence: number;
  onShow(): Promise<void>;
  onHide(): void;
  onUnload(): void;
  loadFavorites(): Promise<void>;
  setData(patch: Partial<FavoritePage["data"]>): void;
};
type PendingRequest = {
  success(response: { statusCode: number; data: Skill[] }): void;
  fail(error: { errMsg: string }): void;
};

const globals = globalThis as typeof globalThis & { wx: unknown; Page: unknown };
let definition: Omit<FavoritePage, "setData">;
const originalPage = globals.Page;
globals.Page = (page: typeof definition) => { definition = page; };
// Load the actual Page definition through tsx without importing it into the
// pipeline TypeScript program, which has different WeChat lifecycle typings.
require("../../../miniprogram/pages/favorites/index");
globals.Page = originalPage;

const FAVORITES_KEY = "skiller.miniprogram.favorites.v1";
const CACHE_PREFIX = "skiller.miniprogram.cache.v1.skill:";
const first = makeSkill("00000001-0000-0000-0000-000000000001");
const second = makeSkill("00000002-0000-0000-0000-000000000002");

function makeSkill(id: string): Skill {
  return {
    id, slug: id, name: id, description: "Source", description_zh: "中文简介",
    category: "code", tags: [], use_cases: [], author: "owner", github_url: "https://github.com/owner/repo",
    github_stars: 1, rank: 0, score: 0, featured: false, created_at: "2026-10-01T00:00:00Z", published_at: null,
  };
}

function harness(t: TestContext, ids: string[], cached: Skill[] = []) {
  const originalWx = globals.wx;
  const storage = new Map<string, unknown>([[FAVORITES_KEY, ids]]);
  cached.forEach((skill) => storage.set(`${CACHE_PREFIX}${skill.id}`, skill));
  const requests: PendingRequest[] = [];
  globals.wx = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    showToast() {},
    request: (options: PendingRequest) => requests.push(options),
  };
  t.after(() => { globals.wx = originalWx; });
  const page: FavoritePage = {
    ...definition,
    data: { ...definition.data, skills: [] },
    setData(patch) { Object.assign(this.data, patch); },
  };
  return { page, storage, requests };
}

test("returning from detail immediately removes an unfavorited card and count", async (t) => {
  const { page, storage, requests } = harness(t, [first.id], [first]);
  const initial = page.onShow();
  requests[0].success({ statusCode: 200, data: [first] });
  await initial;
  assert.equal(page.data.skills.length, 1);

  page.onHide();
  toggleFavorite(first.id);
  await page.onShow();
  assert.deepEqual(storage.get(FAVORITES_KEY), []);
  assert.deepEqual(page.data.skills, []);
  assert.equal(page.data.loading, false);
  assert.equal(requests.length, 1);
});

test("a request started before unfavorite cannot restore the removed card", async (t) => {
  const { page, requests } = harness(t, [first.id], [first]);
  const oldRequest = page.onShow();
  page.onHide();
  toggleFavorite(first.id);
  await page.onShow();
  requests[0].success({ statusCode: 200, data: [first] });
  await oldRequest;
  assert.deepEqual(page.data.skills, []);
  assert.equal(page.data.error, "");
});

test("a newer favorites request wins and an older failure cannot replace its state", async (t) => {
  const { page, storage, requests } = harness(t, [first.id], [first]);
  const oldRequest = page.onShow();
  page.onHide();
  storage.set(FAVORITES_KEY, [second.id]);
  const currentRequest = page.onShow();
  assert.equal(page.data.skills.length, 0);
  assert.equal(page.data.loading, true);

  requests[1].success({ statusCode: 200, data: [second] });
  await currentRequest;
  requests[0].fail({ errMsg: "Old request failed" });
  await oldRequest;
  assert.deepEqual(page.data.skills.map((skill) => skill.id), [second.id]);
  assert.equal(page.data.error, "");
  assert.equal(page.data.loading, false);
});

test("unloading the page prevents an in-flight response from mutating it", async (t) => {
  const { page, requests } = harness(t, [first.id]);
  const inFlight = page.onShow();
  page.onUnload();
  requests[0].success({ statusCode: 200, data: [first] });
  await inFlight;
  assert.deepEqual(page.data.skills, []);
});
