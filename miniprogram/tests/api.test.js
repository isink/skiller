const h = require('./helpers')
const test = require('node:test')
const assert = require('node:assert')
const api = require('../utils/api')
const db = require('../utils/supabase')

function lastQuery() {
  const url = h.requests[h.requests.length - 1].url
  const [path, qs] = url.split('?')
  const params = {}
  ;(qs || '').split('&').filter(Boolean).forEach((kv) => {
    const [k, v] = kv.split('=')
    params[decodeURIComponent(k)] = decodeURIComponent(v)
  })
  return { path, params }
}

test('sanitizeSearch strips PostgREST filter syntax', () => {
  assert.strictEqual(api.sanitizeSearch('  PDF (tools), "x" *  '), 'pdf tools x')
  assert.strictEqual(api.sanitizeSearch('a%b\\c:d'), 'a b c d')
  assert.strictEqual(api.sanitizeSearch('(),*'), '')
})

test('searchSkills builds an or/ilike filter over the same columns as iOS', async () => {
  h.reset()
  await api.searchSkills('Pdf, tool')
  const { path, params } = lastQuery()
  assert.ok(path.endsWith('/rest/v1/skills'))
  assert.strictEqual(params.or, '(name.ilike.*pdf tool*,description.ilike.*pdf tool*,description_zh.ilike.*pdf tool*,author.ilike.*pdf tool*)')
  assert.strictEqual(params.order, 'rank.desc')
  assert.strictEqual(params.limit, '50')
  assert.strictEqual(params.select, api.LIST_COLUMNS)
})

test('searchSkills skips the request for blank queries', async () => {
  h.reset()
  assert.deepStrictEqual(await api.searchSkills('  ,, '), [])
  assert.strictEqual(h.requests.length, 0)
})

test('requests carry the anon key headers', async () => {
  h.reset()
  await api.fetchAllSkills(50, 50)
  const req = h.requests[0]
  assert.ok(req.header.apikey)
  assert.strictEqual(req.header.Authorization, 'Bearer ' + req.header.apikey)
  const { params } = lastQuery()
  assert.strictEqual(params.order, 'github_stars.desc.nullslast')
  assert.strictEqual(params.offset, '50')
  assert.strictEqual(params.limit, '50')
})

test('fetchSkillById rejects non-UUID ids without a request', async () => {
  h.reset()
  assert.strictEqual(await api.fetchSkillById('1,id.neq.0'), null)
  assert.strictEqual(h.requests.length, 0)

  const id = '123e4567-e89b-12d3-a456-426614174000'
  h.respond(() => ({ statusCode: 200, data: [{ id }], header: {} }))
  assert.deepStrictEqual(await api.fetchSkillById(id), { id })
  assert.strictEqual(lastQuery().params.id, 'eq.' + id)
})

test('fetchSkillsByIds uses an in() filter with only valid ids', async () => {
  h.reset()
  const a = '123e4567-e89b-12d3-a456-426614174000'
  const b = '223e4567-e89b-12d3-a456-426614174000'
  await api.fetchSkillsByIds([a, 'bad)', b])
  assert.strictEqual(lastQuery().params.id, 'in.(' + a + ',' + b + ')')
})

test('fetchSkillsInRepo matches github_url by repo path', async () => {
  h.reset()
  await api.fetchSkillsInRepo('anthropics/skills')
  const { params } = lastQuery()
  assert.strictEqual(params.github_url, 'ilike.*github.com/anthropics/skills/*')
  assert.strictEqual(params.order, 'featured.desc,rank.desc')
})

test('rpc calls POST with JSON args', async () => {
  h.reset()
  h.respond(() => ({ statusCode: 200, data: [{ category: 'code', count: '12' }], header: {} }))
  assert.deepStrictEqual(await api.fetchCategoryCounts(), { code: 12 })
  const req = h.requests[0]
  assert.strictEqual(req.method, 'POST')
  assert.ok(req.url.endsWith('/rest/v1/rpc/get_category_counts'))

  h.reset()
  h.respond(() => ({ statusCode: 200, data: [{ repo: 'a/b', skill_count: '3' }], header: {} }))
  const groups = await api.fetchRepoGroups(0, 1000)
  assert.strictEqual(groups[0].skill_count, 3)
  assert.deepStrictEqual(h.requests[0].data, { p_category: null, p_offset: 0, p_limit: 1000 })
})

test('fetchHomeStats reads exact counts from Content-Range', async () => {
  h.reset()
  h.respond((opts) => {
    if (opts.header.Prefer === 'count=exact') {
      const today = opts.url.indexOf('created_at=gte') >= 0
      return { statusCode: 200, data: [], header: { 'content-range': today ? '0-0/7' : '0-0/1234' } }
    }
    return { statusCode: 200, data: [{ created_at: '2025-06-01T12:00:00+00:00' }], header: {} }
  })
  const stats = await api.fetchHomeStats()
  assert.deepStrictEqual(stats, { total: 1234, newToday: 7, lastSyncAt: Date.UTC(2025, 5, 1, 12) })
})

test('HTTP errors reject with the PostgREST message', async () => {
  h.reset()
  h.respond(() => ({ statusCode: 400, data: { message: 'bad filter', code: 'PGRST100' }, header: {} }))
  await assert.rejects(api.fetchAllSkills(), (err) => err.message === 'bad filter' && err.code === 'PGRST100')
})

test('parseContentRangeTotal', () => {
  assert.strictEqual(db.parseContentRangeTotal('0-49/1234'), 1234)
  assert.strictEqual(db.parseContentRangeTotal('*/0'), 0)
  assert.strictEqual(db.parseContentRangeTotal('0-0/*'), 0)
  assert.strictEqual(db.parseContentRangeTotal(undefined), 0)
})

test('dedupeByAuthorName keeps the first of each author/name pair', () => {
  const rows = [
    { author: 'A', name: 'x' }, { author: 'a', name: 'X' }, { author: 'b', name: 'x' }, { author: 'c', name: 'y' },
  ]
  assert.deepStrictEqual(api.dedupeByAuthorName(rows, 2), [rows[0], rows[2]])
})

test('trimToLatestBatch cuts at the first gap longer than an hour', () => {
  const rows = [
    { created_at: '2025-06-01T12:00:00+00:00' },
    { created_at: '2025-06-01T11:40:00+00:00' },
    { created_at: 'garbage' },
    { created_at: '2025-06-01T11:00:00+00:00' },
    { created_at: '2025-06-01T09:30:00+00:00' },
    { created_at: '2025-06-01T09:20:00+00:00' },
  ]
  assert.deepStrictEqual(api.trimToLatestBatch(rows), rows.slice(0, 4))
  assert.deepStrictEqual(api.trimToLatestBatch([]), [])
})

test('sortCategories follows the fixed category order', () => {
  const rows = [{ slug: 'misc' }, { slug: 'zzz' }, { slug: 'code' }, { slug: 'official' }]
  assert.deepStrictEqual(api.sortCategories(rows).map((r) => r.slug), ['official', 'code', 'misc', 'zzz'])
})
