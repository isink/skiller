// 与 iOS 端 SkillsAPI 一一对应的只读查询。

const db = require('./supabase')
const format = require('./format')

const LIST_COLUMNS = [
  'id', 'slug', 'name', 'description', 'description_zh', 'category', 'tags',
  'use_cases', 'use_cases_en', 'author', 'github_url', 'github_stars', 'rank',
  'score', 'featured', 'created_at', 'published_at',
].join(',')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function range(offset, limit) {
  return [['offset', offset], ['limit', limit]]
}

function fetchAllSkills(offset = 0, limit = 50) {
  return db.select('skills', [
    ['select', LIST_COLUMNS],
    ['order', 'github_stars.desc.nullslast'],
  ].concat(range(offset, limit)))
}

function fetchSkillsByCategory(category, offset = 0, limit = 50) {
  return db.select('skills', [
    ['select', LIST_COLUMNS],
    ['category', 'eq.' + category],
    ['order', 'github_stars.desc.nullslast'],
  ].concat(range(offset, limit)))
}

/** 同一作者在不同目录重复发布同名 skill 不算不同内容，按 (author, name) 去重。 */
function dedupeByAuthorName(rows, limit) {
  const seen = {}
  const out = []
  for (const s of rows) {
    const key = String(s.author).toLowerCase() + '|' + String(s.name).toLowerCase()
    if (seen[key]) continue
    seen[key] = true
    out.push(s)
    if (out.length >= limit) break
  }
  return out
}

function fetchNewSkills(limit = 10) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  return db.select('skills', [
    ['select', LIST_COLUMNS],
    ['created_at', 'gte.' + since],
    ['order', 'created_at.desc'],
    ['limit', limit * 4],
  ]).then((rows) => dedupeByAuthorName(rows, limit))
}

/**
 * “最新收录”整批：同一次同步的入库时间通常相差几分钟，
 * 与上一次同步至少相隔 gapHours，据此切出最新一批。
 */
function trimToLatestBatch(skills, gapHours = 1) {
  const out = []
  let last = null
  for (const s of skills) {
    const t = format.parseISO(s.created_at)
    if (t === null) { out.push(s); continue }
    if (last !== null && last - t > gapHours * 3600000) break
    out.push(s)
    last = t
  }
  return out
}

function fetchLatestBatch(probe = 300, gapHours = 1) {
  return db.select('skills', [
    ['select', LIST_COLUMNS],
    ['order', 'created_at.desc'],
    ['limit', probe],
  ]).then((rows) => trimToLatestBatch(rows, gapHours))
}

/** 去掉 PostgREST or 过滤语法里的保留字符，返回可安全拼接的关键词。 */
function sanitizeSearch(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .replace(/[,()*"\\%:]/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
}

function searchFilter(safe) {
  return '(' + ['name', 'description', 'description_zh', 'author']
    .map((col) => col + '.ilike.*' + safe + '*')
    .join(',') + ')'
}

function searchSkills(query) {
  const safe = sanitizeSearch(query)
  if (!safe) return Promise.resolve([])
  return db.select('skills', [
    ['select', LIST_COLUMNS],
    ['or', searchFilter(safe)],
    ['order', 'rank.desc'],
    ['limit', 50],
  ])
}

function fetchSkillById(id) {
  if (!UUID_RE.test(id || '')) return Promise.resolve(null)
  return db.select('skills', [
    ['select', '*'],
    ['id', 'eq.' + id],
    ['limit', 1],
  ]).then((rows) => rows[0] || null)
}

function fetchSkillsByIds(ids) {
  const valid = (ids || []).filter((id) => UUID_RE.test(id))
  if (!valid.length) return Promise.resolve([])
  return db.select('skills', [
    ['select', LIST_COLUMNS],
    ['id', 'in.(' + valid.join(',') + ')'],
  ])
}

function fetchSkillsInRepo(repo) {
  const safe = String(repo || '').replace(/[,()*"\\%]/g, '')
  return db.select('skills', [
    ['select', LIST_COLUMNS],
    ['github_url', 'ilike.*github.com/' + safe + '/*'],
    ['order', 'featured.desc,rank.desc'],
  ])
}

function sortCategories(rows) {
  const idx = (slug) => {
    const i = format.CATEGORY_ORDER.indexOf(slug)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return rows.slice().sort((a, b) => idx(a.slug) - idx(b.slug))
}

function fetchCategories() {
  return db.select('categories', [['select', 'id,slug,name,icon']]).then(sortCategories)
}

function fetchCategoryCounts() {
  return db.rpc('get_category_counts').then((rows) => {
    const out = {}
    ;(rows || []).forEach((r) => { out[r.category] = Number(r.count) })
    return out
  })
}

function fetchRepoGroups(offset = 0, limit = 30) {
  return db.rpc('get_repo_groups', { p_category: null, p_offset: offset, p_limit: limit })
    .then((rows) => (rows || []).map((r) => Object.assign({}, r, { skill_count: Number(r.skill_count) })))
}

function fetchHomeStats() {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return Promise.all([
    db.count('skills'),
    db.count('skills', [['created_at', 'gte.' + startOfDay.toISOString()]]),
    db.select('skills', [['select', 'created_at'], ['order', 'created_at.desc'], ['limit', 1]]),
  ]).then(([total, newToday, last]) => ({
    total,
    newToday,
    lastSyncAt: last[0] ? format.parseISO(last[0].created_at) : null,
  }))
}

module.exports = {
  LIST_COLUMNS,
  fetchAllSkills,
  fetchSkillsByCategory,
  fetchNewSkills,
  fetchLatestBatch,
  searchSkills,
  fetchSkillById,
  fetchSkillsByIds,
  fetchSkillsInRepo,
  fetchCategories,
  fetchCategoryCounts,
  fetchRepoGroups,
  fetchHomeStats,
  // 以下导出供测试
  dedupeByAuthorName,
  trimToLatestBatch,
  sanitizeSearch,
  searchFilter,
  sortCategories,
}
