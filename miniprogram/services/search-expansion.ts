/**
 * Related-query expansion for searches that match nothing.
 *
 * Users type intent words ("武打", "功夫") that no skill description contains.
 * Each group maps such words to terms that really occur in the catalog, most
 * specific first. The terms were checked against the live catalog, so a hit is
 * a genuinely related skill rather than an invented one.
 */
export interface IntentGroup {
  /** Normalized (lower case, no spaces) words that trigger the group. */
  triggers: string[];
  /** Search terms to try, in priority order. */
  related: string[];
}

export const MAX_RELATED_TERMS = 5;

export const INTENT_GROUPS: IntentGroup[] = [
  {
    triggers: ["武打", "武打动作", "武术", "功夫", "格斗", "打斗", "打戏", "武侠", "kungfu", "martialarts", "fight", "combat"],
    related: ["分镜", "视频生成", "短剧", "游戏动画", "角色动画"],
  },
  {
    triggers: ["战斗", "战斗动作", "技能特效", "游戏战斗", "游戏角色", "角色动作"],
    related: ["游戏动画", "角色动画", "特效", "动作", "角色"],
  },
  {
    triggers: ["舞蹈", "跳舞", "舞蹈动作", "dance"],
    related: ["角色动画", "视频生成", "游戏动画", "动作", "动画"],
  },
  {
    triggers: ["动漫", "二次元", "番剧", "动漫角色", "anime", "manga"],
    related: ["漫画", "anime", "分镜", "角色", "动画"],
  },
  {
    triggers: ["电影", "电影特效", "影视特效", "镜头", "运镜", "拍摄", "导演", "影视剪辑"],
    related: ["分镜", "视频生成", "短剧", "特效", "影视"],
  },
  {
    triggers: ["电视剧", "网剧", "编剧", "编导", "微电影"],
    related: ["短剧", "剧本", "分镜", "视频生成"],
  },
];

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "");
}

function matches(normalized: string, trigger: string): boolean {
  // A query that is a fragment of a trigger ("武打动" of "武打动作") still signals the intent.
  return normalized.includes(trigger) || (normalized.length >= 2 && trigger.includes(normalized));
}

/**
 * Related terms to try after `input` returned nothing. Never includes the query
 * itself and is empty for queries outside every intent group.
 */
export function relatedQueriesFor(input: string, limit = MAX_RELATED_TERMS): string[] {
  const normalized = normalize(input);
  if (!normalized) return [];
  const terms: string[] = [];
  for (const group of INTENT_GROUPS) {
    if (!group.triggers.some((trigger) => matches(normalized, trigger))) continue;
    for (const term of group.related) {
      if (normalize(term) === normalized || terms.includes(term)) continue;
      terms.push(term);
    }
  }
  return terms.slice(0, Math.max(0, limit));
}

/** Interleaves per-term result lists so every related term is represented, dropping duplicate ids. */
export function mergeRelated<T extends { id: string }>(lists: T[][], limit: number): T[] {
  const merged: T[] = [];
  const seen = new Set<string>();
  const longest = lists.reduce((max, list) => Math.max(max, list.length), 0);
  for (let index = 0; index < longest && merged.length < limit; index++) {
    for (const list of lists) {
      const item = list[index];
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
      if (merged.length >= limit) break;
    }
  }
  return merged;
}
