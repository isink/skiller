// 内存级 stale-while-revalidate 缓存，对应 iOS 端 SkillsCache。
// 小程序里模块是单例，各页面共享同一份缓存。

const api = require('./api')

const store = {}
const skillIndex = {}

function seedSkill(s) {
  if (!s || !s.id) return
  // 已有完整详情（含 SKILL.md）时，不要被列表里的精简记录覆盖。
  const existing = skillIndex[s.id]
  if (existing && existing.skill_md_content != null && s.skill_md_content == null) return
  skillIndex[s.id] = s
}

function seed(value) {
  if (Array.isArray(value)) value.forEach(seedSkill)
  else if (value && value.id && value.slug) seedSkill(value)
}

/**
 * 返回 { stale, fresh }：stale 为已缓存的值（可能为 null），
 * fresh 是一个 Promise，TTL 内直接复用缓存，否则重新请求；失败时 resolve 为 null。
 */
function swr(key, ttlSeconds, fetcher, force) {
  const entry = store[key]
  const stale = entry ? entry.value : null
  const isFresh = !force && entry && Date.now() - entry.at < ttlSeconds * 1000
  if (stale) seed(stale)
  const fresh = isFresh
    ? Promise.resolve(stale)
    : fetcher().then((value) => {
      store[key] = { value, at: Date.now() }
      seed(value)
      return value
    }).catch(() => null)
  return { stale, fresh }
}

function clear() {
  Object.keys(store).forEach((k) => { delete store[k] })
  Object.keys(skillIndex).forEach((k) => { delete skillIndex[k] })
}

module.exports = {
  swr,
  clear,
  peekSkill: (id) => skillIndex[id] || null,

  newSkills: (limit = 10, force) =>
    swr('new:' + limit, 60, () => api.fetchNewSkills(limit), force),
  latestBatch: (force) =>
    swr('latestBatch', 120, () => api.fetchLatestBatch(), force),
  allSkills: (offset = 0, limit = 50, force) =>
    swr('all:' + offset + ':' + limit, 60, () => api.fetchAllSkills(offset, limit), force),
  skillsByCategory: (cat, offset = 0, limit = 50, force) =>
    swr('cat:' + cat + ':' + offset + ':' + limit, 60, () => api.fetchSkillsByCategory(cat, offset, limit), force),
  skillsInRepo: (repo) =>
    swr('repo:' + repo, 300, () => api.fetchSkillsInRepo(repo)),
  categories: () =>
    swr('categories', 600, () => api.fetchCategories()),
  categoryCounts: () =>
    swr('categoryCounts', 300, () => api.fetchCategoryCounts()),
  repoGroups: (limit = 30, force) =>
    swr('repos:' + limit, 300, () => api.fetchRepoGroups(0, limit), force),
  homeStats: (force) =>
    swr('homeStats', 60, () => api.fetchHomeStats(), force),

  /** 详情：stale 可以来自之前的完整请求，也可以来自任意列表里的同一条记录。 */
  skillById(id) {
    const key = 'detail:' + id
    const entry = store[key]
    const staleFull = entry ? entry.value : null
    const stale = staleFull || skillIndex[id] || null
    const isFresh = entry && Date.now() - entry.at < 300 * 1000
    const fresh = isFresh && staleFull
      ? Promise.resolve(staleFull)
      : api.fetchSkillById(id).then((v) => {
        if (v) { store[key] = { value: v, at: Date.now() }; seed(v) }
        return v
      }).catch(() => null)
    return { stale, fresh }
  },
}
