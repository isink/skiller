import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { MP_EVENT_NAMES } from "../../../miniprogram/services/analytics";
import { categoryName } from "../../../miniprogram/services/presentation";
import { pickEmptySearchRecommendations } from "../../../miniprogram/services/recommendations";
import { MP_SKILL_CATEGORY, MP_SKILL_TOPIC, topicCountText } from "../../../miniprogram/services/topics";
import { MP_SKILL_CATEGORY as PIPELINE_CATEGORY, MP_SKILL_CATEGORY_ROW } from "../lib/mp-skill";

const migrations = join(__dirname, "..", "..", "supabase", "migrations");
const sql = (name: string) => readFileSync(join(migrations, name), "utf8");

test("empty searches suggest weekly hot skills, or featured ones when growth data is thin", () => {
  const hot = ["h1", "h2", "h3", "h4", "h5", "h6", "h7"];
  const featured = ["f1", "f2"];
  const withHot = pickEmptySearchRecommendations(hot, featured);
  assert.equal(withHot.recommendTitle, "本周热门，先看看这些");
  assert.deepEqual(withHot.recommended, ["h1", "h2", "h3", "h4", "h5"]);

  const withoutHot = pickEmptySearchRecommendations(["h1", "h2"], featured);
  assert.equal(withoutHot.recommendTitle, "精选技能，先看看这些");
  assert.deepEqual(withoutHot.recommended, featured);
  assert.deepEqual(pickEmptySearchRecommendations([], []).recommended, []);
});

test("the home page tells users the empty search was recorded", () => {
  const wxml = readFileSync(join(__dirname, "..", "..", "..", "miniprogram", "pages", "home", "index.wxml"), "utf8");
  assert.match(wxml, /已记录，我们会尽快收录/);
  assert.doesNotMatch(wxml, /没有匹配的技能/);
});

test("the mini program topic uses one slug everywhere", () => {
  assert.equal(MP_SKILL_CATEGORY, "mp-skill");
  assert.equal(PIPELINE_CATEGORY, MP_SKILL_CATEGORY);
  assert.equal(categoryName(MP_SKILL_CATEGORY), "微信小程序 SKILL");
  assert.equal(MP_SKILL_CATEGORY_ROW.name, categoryName(MP_SKILL_CATEGORY));
  assert.match(MP_SKILL_TOPIC.title, /微信小程序 SKILL/);
  assert.equal(topicCountText(undefined), "即将收录");
  assert.equal(topicCountText(0), "即将收录");
  assert.equal(topicCountText(12), "12 个范例");
});

test("migration 026 creates the topic category without touching skills", () => {
  const text = sql("026_mp_skill_category.sql");
  assert.match(text, /insert into public\.categories[\s\S]*'mp-skill', '微信小程序 SKILL'/);
  assert.match(text, /on conflict \(slug\) do update/);
  assert.doesNotMatch(text, /(?:update|delete from|drop|truncate)\s+(?:table\s+)?public\.skills/i);
});

test("migration 025 allows every event name the mini program can send", () => {
  const text = sql("025_mp_events_install_share.sql");
  const allowed = [...text.matchAll(/check \(event in \(([^)]*)\)\)/g)][0]?.[1].match(/'([a-z_]+)'/g)?.map((name) => name.slice(1, -1)) ?? [];
  assert.deepEqual([...allowed].sort(), [...MP_EVENT_NAMES].sort());
  // 024 already whitelists the original five; 025 only extends it.
  for (const name of ["page_view", "search", "search_empty", "js_error", "perf"]) assert.match(sql("024_mp_events.sql"), new RegExp(`'${name}'`));
  assert.match(text, /mp_events_event_check/);
  assert.doesNotMatch(text, /drop table|truncate|delete from/i);
});
