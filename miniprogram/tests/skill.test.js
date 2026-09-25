const h = require('./helpers')
const test = require('node:test')
const assert = require('node:assert')
const skill = require('../.test-build/utils/skill')
const favorites = require('../.test-build/utils/favorites')
const recents = require('../.test-build/utils/recents')
const cache = require('../.test-build/utils/cache')

test('githubRepositoryURL only accepts https github.com owner/repo links', () => {
  assert.strictEqual(skill.githubRepositoryURL('https://github.com/a/b/tree/main/x'), 'https://github.com/a/b/tree/main/x')
  assert.strictEqual(skill.githubRepositoryURL('https://GitHub.com/a/b'), 'https://GitHub.com/a/b')
  assert.strictEqual(skill.githubRepositoryURL('https://github.com/a'), null)
  assert.strictEqual(skill.githubRepositoryURL('http://github.com/a/b'), null)
  assert.strictEqual(skill.githubRepositoryURL('https://github.com.evil.com/a/b'), null)
  assert.strictEqual(skill.githubRepositoryURL('https://user@github.com/a/b'), null)
  assert.strictEqual(skill.githubRepositoryURL('https://github.com:8443/a/b'), null)
  assert.strictEqual(skill.githubRepositoryURL(null), null)
})

test('localized description and chips fall back across languages', () => {
  assert.strictEqual(skill.localizedDescription({ description: 'en', description_zh: '中' }), '中')
  assert.strictEqual(skill.localizedDescription({ description: 'en', description_zh: '' }), 'en')
  assert.deepStrictEqual(skill.chips({ use_cases: null, use_cases_en: ['a', 'b', 'c', 'd'] }), ['a', 'b', 'c'])
  assert.deepStrictEqual(skill.chips({ tags: ['claude', 'pdf', 'codex', 'x'] }), ['pdf', 'x'])
})

test('favorites toggle, order newest first, and notify subscribers', () => {
  h.reset()
  const seen = []
  const off = favorites.subscribe((list) => seen.push(list.length))
  assert.strictEqual(favorites.toggle('a'), true)
  assert.strictEqual(favorites.toggle('b'), true)
  assert.deepStrictEqual(favorites.ids(), ['b', 'a'])
  assert.strictEqual(favorites.has('a'), true)
  assert.strictEqual(favorites.toggle('a'), false)
  assert.deepStrictEqual(favorites.ids(), ['b'])
  off()
  favorites.toggle('c')
  assert.deepStrictEqual(seen, [1, 2, 1])
})

test('favorites ignore corrupted storage', () => {
  h.reset()
  h.storage[favorites.KEY] = 'garbage'
  assert.deepStrictEqual(favorites.ids(), [])
})

test('recents dedupe and report the most viewed category', () => {
  h.reset()
  recents.record('1', 'code')
  recents.record('2', 'data')
  recents.record('3', 'code')
  recents.record('2', 'data')
  assert.deepStrictEqual(recents.all().map((e) => e.id), ['2', '3', '1'])
  assert.strictEqual(recents.topCategory(), 'code')
  recents.clear()
  assert.strictEqual(recents.topCategory(), null)
})

test('favorites keep a list-field snapshot for offline display', () => {
  h.reset()
  const full = { id: 'x', slug: 's', name: 'n', skill_md_content: '# big', tags: [] }
  favorites.toggle('x', full)
  const [entry] = favorites.all()
  assert.strictEqual(entry.skill.name, 'n')
  assert.ok(!('skill_md_content' in entry.skill))

  favorites.refreshSnapshots([{ id: 'x', slug: 's', name: 'renamed', tags: [] }, { id: 'other', slug: 'o', name: 'o' }])
  assert.strictEqual(favorites.all()[0].skill.name, 'renamed')
  assert.deepStrictEqual(favorites.ids(), ['x'])
})

test('cache serves stale values and seeds the skill index', async () => {
  cache.clear()
  let calls = 0
  const fetcher = () => { calls++; return Promise.resolve([{ id: 'x', slug: 's', name: 'n' }]) }
  const first = cache.swr('k', 60, fetcher)
  assert.strictEqual(first.stale, null)
  assert.deepStrictEqual((await first.fresh).error, false)
  const second = cache.swr('k', 60, fetcher)
  assert.strictEqual(second.stale.length, 1)
  assert.strictEqual((await second.fresh).value.length, 1)
  assert.strictEqual(calls, 1)
  await cache.swr('k', 60, fetcher, { force: true }).fresh
  assert.strictEqual(calls, 2)
  assert.strictEqual(cache.peekSkill('x').name, 'n')
  assert.deepStrictEqual(await cache.swr('bad', 60, () => Promise.reject(new Error('x'))).fresh, { value: null, error: true })
})

test('persisted cache entries survive a restart and act as offline data', async () => {
  h.reset()
  cache.clear()
  await cache.swr('home', 60, () => Promise.resolve({ total: 3 }), { persist: true }).fresh
  assert.ok(h.storage[cache.PERSIST_PREFIX + 'home'])

  cache.clear() // 模拟冷启动：内存清空，本地存储还在
  const offline = cache.swr('home', 60, () => Promise.reject(new Error('offline')), { persist: true, force: true })
  assert.deepStrictEqual(offline.stale, { total: 3 })
  assert.ok(offline.staleAt > 0)
  assert.deepStrictEqual(await offline.fresh, { value: null, error: true })
})

test('skillById distinguishes not found from network errors', async () => {
  cache.clear()
  const id = '123e4567-e89b-12d3-a456-426614174000'
  h.reset()
  h.respond(() => ({ statusCode: 200, data: [], header: {} }))
  assert.deepStrictEqual(await cache.skillById(id).fresh, { value: null, error: false })
  h.respond(() => ({ fail: true, errMsg: 'request:fail' }))
  assert.deepStrictEqual(await cache.skillById(id).fresh, { value: null, error: true })
})
