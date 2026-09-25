const h = require('./helpers')
const test = require('node:test')
const assert = require('node:assert')
const skill = require('../utils/skill')
const favorites = require('../utils/favorites')
const recents = require('../utils/recents')
const cache = require('../utils/cache')

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

test('cache serves stale values and seeds the skill index', async () => {
  cache.clear()
  let calls = 0
  const fetcher = () => { calls++; return Promise.resolve([{ id: 'x', slug: 's', name: 'n' }]) }
  const first = cache.swr('k', 60, fetcher)
  assert.strictEqual(first.stale, null)
  await first.fresh
  const second = cache.swr('k', 60, fetcher)
  assert.strictEqual(second.stale.length, 1)
  assert.strictEqual((await second.fresh).length, 1)
  assert.strictEqual(calls, 1)
  await cache.swr('k', 60, fetcher, true).fresh
  assert.strictEqual(calls, 2)
  assert.strictEqual(cache.peekSkill('x').name, 'n')
  const failed = cache.swr('bad', 60, () => Promise.reject(new Error('x')))
  assert.strictEqual(await failed.fresh, null)
})
