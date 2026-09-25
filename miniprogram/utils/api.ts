// 数据适配层：与 iOS 端 SkillsAPI 对应的只读查询。页面只调这里，不直接拼 REST 请求。

import * as db from './supabase'
import { QueryParam } from './supabase'
import * as format from './format'
import { Category, CategoryCounts, HomeStats, RepoGroup, SkillDetail, SkillListItem } from './types'

export const LIST_COLUMNS = [
  'id', 'slug', 'name', 'description', 'description_zh', 'category', 'tags',
  'use_cases', 'use_cases_en', 'author', 'github_url', 'github_stars', 'rank',
  'score', 'featured', 'created_at', 'published_at',
].join(',')

export const SEARCH_PAGE_SIZE = 20

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isSkillId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id)
}

function page(offset: number, limit: number): QueryParam[] {
  return [['offset', offset], ['limit', limit]]
}

function listSkills(params: QueryParam[]): Promise<SkillListItem[]> {
  return db.select<SkillListItem>('skills', ([['select', LIST_COLUMNS]] as QueryParam[]).concat(params))
}

export function fetchAllSkills(offset = 0, limit = 50): Promise<SkillListItem[]> {
  return listSkills([['order', 'github_stars.desc.nullslast'], ...page(offset, limit)])
}

export function fetchSkillsByCategory(category: string, offset = 0, limit = 50): Promise<SkillListItem[]> {
  return listSkills([
    ['category', 'eq.' + category],
    ['order', 'github_stars.desc.nullslast'],
    ...page(offset, limit),
  ])
}

/** 同一作者在不同目录重复发布同名 skill 不算不同内容，按 (author, name) 去重。 */
export function dedupeByAuthorName<T extends { author: string; name: string }>(rows: T[], limit: number): T[] {
  const seen: Record<string, boolean> = {}
  const out: T[] = []
  for (const s of rows) {
    const key = String(s.author).toLowerCase() + '|' + String(s.name).toLowerCase()
    if (seen[key]) continue
    seen[key] = true
    out.push(s)
    if (out.length >= limit) break
  }
  return out
}

/** 首页“热门技能”：GitHub stars 最高的若干个，去掉同作者同名的重复项。 */
export function fetchPopularSkills(limit = 10): Promise<SkillListItem[]> {
  return listSkills([['order', 'github_stars.desc.nullslast'], ['limit', limit * 3]])
    .then((rows) => dedupeByAuthorName(rows, limit))
}

export function fetchNewSkills(limit = 10): Promise<SkillListItem[]> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  return listSkills([
    ['created_at', 'gte.' + since],
    ['order', 'created_at.desc'],
    ['limit', limit * 4],
  ]).then((rows) => dedupeByAuthorName(rows, limit))
}

/**
 * “最新收录”整批：同一次同步的入库时间通常相差几分钟，
 * 与上一次同步至少相隔 gapHours，据此切出最新一批。
 */
export function trimToLatestBatch<T extends { created_at: string }>(skills: T[], gapHours = 1): T[] {
  const out: T[] = []
  let last: number | null = null
  for (const s of skills) {
    const time = format.parseISO(s.created_at)
    if (time === null) { out.push(s); continue }
    if (last !== null && last - time > gapHours * 3600000) break
    out.push(s)
    last = time
  }
  return out
}

export function fetchLatestBatch(probe = 300, gapHours = 1): Promise<SkillListItem[]> {
  return listSkills([['order', 'created_at.desc'], ['limit', probe]])
    .then((rows) => trimToLatestBatch(rows, gapHours))
}

/** 去掉 PostgREST or 过滤语法里的保留字符，返回可安全拼接的关键词。 */
export function sanitizeSearch(query: string): string {
  return String(query || '')
    .trim()
    .toLowerCase()
    .replace(/[,()*"\\%:]/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
}

export function searchFilter(safe: string): string {
  return '(' + ['name', 'description', 'description_zh', 'author']
    .map((col) => col + '.ilike.*' + safe + '*')
    .join(',') + ')'
}

/** 关键词搜索，按 rank 排序分页；id 作为次序键保证翻页稳定。 */
export function searchSkills(query: string, offset = 0, limit = SEARCH_PAGE_SIZE): Promise<SkillListItem[]> {
  const safe = sanitizeSearch(query)
  if (!safe) return Promise.resolve([])
  return listSkills([
    ['or', searchFilter(safe)],
    ['order', 'rank.desc,id.asc'],
    ...page(offset, limit),
  ])
}

export function fetchSkillById(id: string): Promise<SkillDetail | null> {
  if (!isSkillId(id)) return Promise.resolve(null)
  return db.select<SkillDetail>('skills', [
    ['select', '*'],
    ['id', 'eq.' + id],
    ['limit', 1],
  ]).then((rows) => rows[0] || null)
}

export function fetchSkillsByIds(ids: string[]): Promise<SkillListItem[]> {
  const valid = (ids || []).filter(isSkillId)
  if (!valid.length) return Promise.resolve([])
  return listSkills([['id', 'in.(' + valid.join(',') + ')']])
}

export function fetchSkillsInRepo(repo: string): Promise<SkillListItem[]> {
  const safe = String(repo || '').replace(/[,()*"\\%]/g, '')
  return listSkills([
    ['github_url', 'ilike.*github.com/' + safe + '/*'],
    ['order', 'featured.desc,rank.desc'],
  ])
}

export function sortCategories(rows: Category[]): Category[] {
  const idx = (slug: string) => {
    const i = format.CATEGORY_ORDER.indexOf(slug)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return rows.slice().sort((a, b) => idx(a.slug) - idx(b.slug))
}

export function fetchCategories(): Promise<Category[]> {
  return db.select<Category>('categories', [['select', 'id,slug,name,icon']]).then(sortCategories)
}

export function fetchCategoryCounts(): Promise<CategoryCounts> {
  return db.rpc<Array<{ category: string; count: number | string }>>('get_category_counts').then((rows) => {
    const out: CategoryCounts = {}
    ;(rows || []).forEach((r) => { out[r.category] = Number(r.count) })
    return out
  })
}

export function fetchRepoGroups(offset = 0, limit = 30): Promise<RepoGroup[]> {
  return db.rpc<RepoGroup[]>('get_repo_groups', { p_category: null, p_offset: offset, p_limit: limit })
    .then((rows) => (rows || []).map((r) => Object.assign({}, r, { skill_count: Number(r.skill_count) })))
}

export function fetchHomeStats(): Promise<HomeStats> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return Promise.all([
    db.count('skills'),
    db.count('skills', [['created_at', 'gte.' + startOfDay.toISOString()]]),
    db.select<{ created_at: string }>('skills', [['select', 'created_at'], ['order', 'created_at.desc'], ['limit', 1]]),
  ]).then(([total, newToday, last]) => ({
    total,
    newToday,
    lastSyncAt: last[0] ? format.parseISO(last[0].created_at) : null,
  }))
}
