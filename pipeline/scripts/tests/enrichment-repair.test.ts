import assert from "node:assert/strict";
import test from "node:test";

import {
  clampProse,
  generateEnrichment,
  repairEnrichment,
  type ChatMessage,
} from "../lib/enrichment-repair";
import type { ExistingEnrichment } from "../lib/enrichment";

const blank: ExistingEnrichment = {
  description_zh: null,
  use_cases: [],
  use_cases_en: [],
  skill_md_summary_zh: null,
};

const description = "这是一段准确自然并能清楚说明技能核心能力和适用方式的中文简介".padEnd(60, "好");
const summary = "这是一段面向中文用户的完整技能摘要，说明主要功能、使用方法和适用场景。".padEnd(200, "好");

const good = {
  description_zh: description,
  use_cases: ["代码审查", "文档生成", "数据分析"],
  use_cases_en: ["Code Review", "Docs", "Data Analysis"],
  skill_md_summary_zh: summary,
};

test("a valid answer passes through unchanged", () => {
  const result = repairEnrichment(good, blank);
  assert.deepEqual(result.problems, []);
  assert.equal(result.enrichment?.description_zh, description);
  assert.deepEqual(result.enrichment?.use_cases, good.use_cases);
});

test("one over-long tag is dropped instead of failing the whole skill", () => {
  const result = repairEnrichment({
    ...good,
    use_cases: ["代码审查", "这是一个特别特别长的标签", "文档生成", "数据分析"],
    use_cases_en: ["Code Review", "Long One", "Docs", "Data Analysis"],
  }, blank);

  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.enrichment?.use_cases, ["代码审查", "文档生成", "数据分析"]);
  assert.deepEqual(result.enrichment?.use_cases_en, ["Code Review", "Docs", "Data Analysis"]);
});

test("an English tag with too many words drops its Chinese partner too", () => {
  const result = repairEnrichment({
    ...good,
    use_cases: ["代码审查", "文档生成", "数据分析", "测试生成"],
    use_cases_en: ["Code Review", "Docs", "Data Analysis", "Generate Unit Tests Fast"],
  }, blank);

  assert.deepEqual(result.enrichment?.use_cases, ["代码审查", "文档生成", "数据分析"]);
  assert.equal(result.enrichment?.use_cases.length, result.enrichment?.use_cases_en.length);
});

test("more than five valid tag pairs are trimmed to five", () => {
  const zh = ["代码审查", "文档生成", "数据分析", "测试生成", "性能优化", "安全审计"];
  const en = ["A", "B", "C", "D", "E", "F"];
  const result = repairEnrichment({ ...good, use_cases: zh, use_cases_en: en }, blank);
  assert.deepEqual(result.enrichment?.use_cases, zh.slice(0, 5));
  assert.deepEqual(result.enrichment?.use_cases_en, en.slice(0, 5));
});

test("too few valid tag pairs is reported with the offending tags", () => {
  const result = repairEnrichment({
    ...good,
    use_cases: ["短", "文档生成", "数据分析"],
    use_cases_en: ["Code Review", "Docs", "Data Analysis"],
  }, blank);

  assert.equal(result.enrichment, null);
  assert.match(result.problems.join("\n"), /只有 2 组/);
  assert.match(result.problems.join("\n"), /"短" 有 1 个字符/);
});

test("mismatched tag list lengths are a problem, not a guess", () => {
  const result = repairEnrichment({
    ...good,
    use_cases_en: ["Code Review", "Docs", "Data Analysis", "Extra Tag"],
  }, blank);
  assert.equal(result.enrichment, null);
  assert.match(result.problems[0], /一一对应/);
});

test("over-long prose is cut at a sentence boundary within the limit", () => {
  const sentences = Array.from({ length: 12 }, (_, index) => `第${index}句话用来说明技能的功能。`).join("");
  const result = repairEnrichment({
    ...good,
    description_zh: sentences,
    skill_md_summary_zh: sentences.repeat(3),
  }, blank);

  const out = result.enrichment!;
  assert.ok(Array.from(out.description_zh).length <= 80);
  assert.ok(Array.from(out.description_zh).length >= 50);
  assert.ok(out.description_zh.endsWith("。"));
  assert.ok(Array.from(out.skill_md_summary_zh).length <= 250);
  assert.ok(Array.from(out.skill_md_summary_zh).length >= 150);
  assert.ok(out.skill_md_summary_zh.endsWith("。"));
});

test("clampProse hard-cuts text without any punctuation", () => {
  assert.equal(Array.from(clampProse("好".repeat(300), 150, 250)).length, 250);
  assert.equal(clampProse("  短文本  ", 1, 10), "短文本");
});

test("too-short prose cannot be repaired and says how short it is", () => {
  const result = repairEnrichment({ ...good, skill_md_summary_zh: "太短了" }, blank);
  assert.equal(result.enrichment, null);
  assert.match(result.problems[0], /skill_md_summary_zh 只有 3 个字符/);
});

test("fields the skill does not need keep their existing valid value", () => {
  const existing: ExistingEnrichment = {
    description_zh: description,
    use_cases: ["代码审查", "文档生成", "数据分析"],
    use_cases_en: ["Code Review", "Docs", "Data Analysis"],
    skill_md_summary_zh: "太短",
  };
  const result = repairEnrichment({
    description_zh: "模型把这个字段写坏了",
    use_cases: ["坏"],
    use_cases_en: [],
    skill_md_summary_zh: summary,
  }, existing);

  assert.deepEqual(result.problems, []);
  assert.equal(result.enrichment?.description_zh, description);
  assert.deepEqual(result.enrichment?.use_cases, existing.use_cases);
  assert.equal(result.enrichment?.skill_md_summary_zh, summary);
});

test("a preserved Chinese side is restored and only the English side is checked", () => {
  const existing: ExistingEnrichment = {
    ...blank,
    use_cases: ["代码审查", "文档生成", "数据分析"],
    use_cases_en: [],
  };

  const reworded = repairEnrichment({
    ...good,
    use_cases: ["完全不同", "另外几个", "标签内容"],
  }, existing);
  assert.deepEqual(reworded.enrichment?.use_cases, existing.use_cases);

  const wrongLength = repairEnrichment({ ...good, use_cases_en: ["Code Review", "Docs"] }, existing);
  assert.equal(wrongLength.enrichment, null);
  assert.match(wrongLength.problems[0], /use_cases_en 必须正好有 3 项/);
});

test("generateEnrichment retries with concrete feedback and then succeeds", async () => {
  const seen: ChatMessage[][] = [];
  const replies = [
    JSON.stringify({ ...good, skill_md_summary_zh: "太短" }),
    "not json at all",
    JSON.stringify(good),
  ];
  const result = await generateEnrichment({
    prompt: "生成",
    existing: blank,
    chat: async (messages) => {
      seen.push(messages.map((message) => ({ ...message })));
      return replies[seen.length - 1];
    },
  });

  assert.equal(result.skill_md_summary_zh, summary);
  assert.equal(seen.length, 3);
  assert.equal(seen[0].length, 1);
  assert.equal(seen[1].length, 3);
  assert.match(seen[1][2].content, /skill_md_summary_zh 只有 2 个字符/);
  assert.match(seen[2][4].content, /不是合法 JSON/);
});

test("generateEnrichment gives up after the last attempt with the final problems", async () => {
  let calls = 0;
  await assert.rejects(
    generateEnrichment({
      prompt: "生成",
      existing: blank,
      maxAttempts: 2,
      chat: async () => {
        calls++;
        return JSON.stringify({ ...good, skill_md_summary_zh: "太短" });
      },
    }),
    /still invalid after 2 attempts: .*skill_md_summary_zh 只有 2 个字符/,
  );
  assert.equal(calls, 2);
});

test("generateEnrichment accepts JSON wrapped in a markdown fence", async () => {
  const result = await generateEnrichment({
    prompt: "生成",
    existing: blank,
    chat: async () => `\`\`\`json\n${JSON.stringify(good)}\n\`\`\``,
  });
  assert.deepEqual(result.use_cases, good.use_cases);
});
