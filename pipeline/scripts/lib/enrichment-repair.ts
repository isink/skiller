import {
  enrichmentNeeds,
  preservedUseCaseSide,
  validateEnrichmentForExisting,
  type Enrichment,
  type ExistingEnrichment,
} from "./enrichment";

/**
 * LLMs cannot count characters reliably, so a strict all-or-nothing validator
 * rejects most generations. The database function still enforces the hard
 * limits, so this module only repairs what can be repaired losslessly
 * (over-long prose, one bad tag among several) and reports everything else as
 * a precise problem that is fed back to the model for another attempt.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type RepairResult = {
  enrichment: Enrichment | null;
  problems: string[];
};

const DESCRIPTION_RANGE = [50, 80] as const;
const SUMMARY_RANGE = [150, 250] as const;
const TAG_COUNT_RANGE = [3, 5] as const;
const ZH_TAG_RANGE = [4, 8] as const;
const EN_TAG_WORDS = [1, 3] as const;

const SENTENCE_END = new Set(["。", "！", "？", "；", "!", "?", ";"]);
const CLAUSE_END = new Set(["，", "、", "：", ",", ":"]);

function charCount(text: string): number {
  return Array.from(text).length;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Shorten over-long prose to at most `maximum` characters, preferring a
 * sentence boundary, then a clause boundary, and never going below `minimum`.
 */
export function clampProse(text: string, minimum: number, maximum: number): string {
  const characters = Array.from(text.trim());
  if (characters.length <= maximum) return characters.join("");

  const window = characters.slice(0, maximum);
  for (let index = window.length - 1; index >= minimum - 1; index--) {
    if (SENTENCE_END.has(window[index])) return window.slice(0, index + 1).join("");
  }
  for (let index = window.length - 2; index >= minimum - 1; index--) {
    if (CLAUSE_END.has(window[index])) return `${window.slice(0, index).join("")}。`;
  }
  return window.join("");
}

function repairProse(
  value: unknown,
  field: string,
  [minimum, maximum]: readonly [number, number],
  problems: string[],
): string | null {
  if (typeof value !== "string" || !value.trim()) {
    problems.push(`${field} 缺失或为空，必须是 ${minimum}-${maximum} 个字符的字符串`);
    return null;
  }
  const length = charCount(value.trim());
  if (length < minimum) {
    problems.push(`${field} 只有 ${length} 个字符，太短了，必须是 ${minimum}-${maximum} 个字符，请补充内容`);
    return null;
  }
  return clampProse(value, minimum, maximum);
}

function stringItems(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((item) => (typeof item === "string" ? item.trim().replace(/\s+/g, " ") : ""));
}

function zhTagProblem(tag: string): string | null {
  const length = charCount(tag);
  return length >= ZH_TAG_RANGE[0] && length <= ZH_TAG_RANGE[1]
    ? null
    : `"${tag}" 有 ${length} 个字符，必须 ${ZH_TAG_RANGE[0]}-${ZH_TAG_RANGE[1]} 个字`;
}

function enTagProblem(tag: string): string | null {
  const words = wordCount(tag);
  return words >= EN_TAG_WORDS[0] && words <= EN_TAG_WORDS[1]
    ? null
    : `"${tag}" 有 ${words} 个单词，必须 ${EN_TAG_WORDS[0]}-${EN_TAG_WORDS[1]} 个单词`;
}

function repairUseCases(
  value: { use_cases?: unknown; use_cases_en?: unknown },
  existing: ExistingEnrichment,
  problems: string[],
): { use_cases: string[]; use_cases_en: string[] } | null {
  const zh = stringItems(value.use_cases);
  const en = stringItems(value.use_cases_en);
  if (!zh || !en) {
    problems.push("use_cases 和 use_cases_en 必须都是字符串数组");
    return null;
  }

  const preserved = preservedUseCaseSide(existing);
  if (preserved) {
    const generated = preserved.field === "use_cases" ? en : zh;
    const check = preserved.field === "use_cases" ? enTagProblem : zhTagProblem;
    const otherField = preserved.field === "use_cases" ? "use_cases_en" : "use_cases";
    if (generated.length !== preserved.values.length) {
      problems.push(`${otherField} 必须正好有 ${preserved.values.length} 项，与已有标签一一对应`);
      return null;
    }
    const bad = generated
      .map((tag, index) => (tag ? check(tag) : `第 ${index + 1} 项为空`))
      .filter((message): message is string => message !== null);
    if (bad.length > 0) {
      problems.push(`${otherField} 不合规：${bad.join("；")}`);
      return null;
    }
    return preserved.field === "use_cases"
      ? { use_cases: preserved.values, use_cases_en: generated }
      : { use_cases: generated, use_cases_en: preserved.values };
  }

  if (zh.length !== en.length) {
    problems.push(
      `use_cases 有 ${zh.length} 项而 use_cases_en 有 ${en.length} 项，必须逐项一一对应`,
    );
    return null;
  }

  const pairs: Array<[string, string]> = [];
  const dropped: string[] = [];
  zh.forEach((zhTag, index) => {
    const enTag = en[index];
    const issues = [
      zhTag ? zhTagProblem(zhTag) : "中文标签为空",
      enTag ? enTagProblem(enTag) : "英文标签为空",
    ].filter((message): message is string => message !== null);
    if (issues.length === 0) pairs.push([zhTag, enTag]);
    else dropped.push(issues.join("，"));
  });

  if (pairs.length < TAG_COUNT_RANGE[0]) {
    problems.push(
      `合规的使用场景标签对只有 ${pairs.length} 组，至少需要 ${TAG_COUNT_RANGE[0]} 组` +
        (dropped.length > 0 ? `（不合规：${dropped.join("；")}）` : ""),
    );
    return null;
  }
  const kept = pairs.slice(0, TAG_COUNT_RANGE[1]);
  return { use_cases: kept.map(([tag]) => tag), use_cases_en: kept.map(([, tag]) => tag) };
}

/**
 * Turn a raw model answer into an enrichment the database will accept, or a
 * list of problems. Fields the skill does not need keep their existing,
 * already valid value so an unneeded field can never block a needed one.
 */
export function repairEnrichment(value: unknown, existing: ExistingEnrichment): RepairResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { enrichment: null, problems: ["输出必须是一个 JSON 对象"] };
  }
  const record = value as Record<string, unknown>;
  const needs = enrichmentNeeds(existing);
  const problems: string[] = [];

  const description = needs.descriptionZh
    ? repairProse(record.description_zh, "description_zh", DESCRIPTION_RANGE, problems)
    : (existing.description_zh ?? "").trim();
  const summary = needs.summaryZh
    ? repairProse(record.skill_md_summary_zh, "skill_md_summary_zh", SUMMARY_RANGE, problems)
    : (existing.skill_md_summary_zh ?? "").trim();
  const tags = needs.useCasePair
    ? repairUseCases(record, existing, problems)
    : {
        use_cases: (existing.use_cases ?? []).map((tag) => tag.trim()),
        use_cases_en: (existing.use_cases_en ?? []).map((tag) => tag.trim()),
      };

  if (problems.length > 0 || description === null || summary === null || tags === null) {
    return { enrichment: null, problems };
  }

  try {
    return {
      enrichment: validateEnrichmentForExisting(
        {
          description_zh: description,
          skill_md_summary_zh: summary,
          use_cases: tags.use_cases,
          use_cases_en: tags.use_cases_en,
        },
        existing,
      ),
      problems: [],
    };
  } catch (error) {
    return { enrichment: null, problems: [(error as Error).message] };
  }
}

export function extractJsonObject(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("响应中没有 JSON 对象");
  return JSON.parse(match[0]);
}

function feedbackFor(problems: readonly string[]): string {
  return [
    "你上一次的输出没有通过校验，问题如下：",
    ...problems.map((problem) => `- ${problem}`),
    "请修正这些问题后，重新输出完整的 JSON（字段与格式不变，只输出 JSON）。",
  ].join("\n");
}

/**
 * Ask the model, repair what is repairable, and re-ask with concrete feedback
 * for the rest. Throws only after every attempt failed.
 */
export async function generateEnrichment(options: {
  chat: (messages: ChatMessage[]) => Promise<string>;
  prompt: string;
  existing: ExistingEnrichment;
  maxAttempts?: number;
}): Promise<Enrichment> {
  const maxAttempts = options.maxAttempts ?? 3;
  const messages: ChatMessage[] = [{ role: "user", content: options.prompt }];
  let lastProblems: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const reply = await options.chat(messages);
    let result: RepairResult;
    try {
      result = repairEnrichment(extractJsonObject(reply), options.existing);
    } catch (error) {
      result = {
        enrichment: null,
        problems: [`输出不是合法 JSON：${(error as Error).message}`],
      };
    }
    if (result.enrichment) return result.enrichment;

    lastProblems = result.problems;
    messages.push(
      { role: "assistant", content: reply },
      { role: "user", content: feedbackFor(result.problems) },
    );
  }

  throw new Error(`enrichment still invalid after ${maxAttempts} attempts: ${lastProblems.join("; ")}`);
}
