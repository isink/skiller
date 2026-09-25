require('./helpers')
const test = require('node:test')
const assert = require('node:assert')
const format = require('../.test-build/utils/format')

test('parseISO handles Postgres microsecond timestamps with offsets', () => {
  assert.strictEqual(format.parseISO('2025-06-01T12:00:00.123456+00:00'), Date.UTC(2025, 5, 1, 12, 0, 0, 123))
  assert.strictEqual(format.parseISO('2025-06-01T20:00:00+08:00'), Date.UTC(2025, 5, 1, 12))
  assert.strictEqual(format.parseISO('2025-06-01T12:00:00Z'), Date.UTC(2025, 5, 1, 12))
  assert.strictEqual(format.parseISO('2025-06-01 12:00:00'), Date.UTC(2025, 5, 1, 12))
  assert.strictEqual(format.parseISO('2025-06-01T07:30:00-0430'), Date.UTC(2025, 5, 1, 12))
  assert.strictEqual(format.parseISO('nope'), null)
  assert.strictEqual(format.parseISO(null), null)
})

test('stars and count match the iOS formatting', () => {
  assert.strictEqual(format.stars(null), '')
  assert.strictEqual(format.stars(0), '')
  assert.strictEqual(format.stars(999), '999')
  assert.strictEqual(format.stars(1234), '1.2k')
  assert.strictEqual(format.stars(2500000), '2.5M')
  assert.strictEqual(format.count(12), '12')
  assert.strictEqual(format.count(1500), '1.5k')
})

test('timeAgo buckets', () => {
  const now = Date.UTC(2025, 5, 30)
  const iso = (days) => new Date(now - days * 86400000).toISOString()
  assert.strictEqual(format.timeAgo(iso(0), now), '今天')
  assert.strictEqual(format.timeAgo(iso(1), now), '昨天')
  assert.strictEqual(format.timeAgo(iso(3), now), '3 天前')
  assert.strictEqual(format.timeAgo(iso(7), now), '1 周前')
  assert.strictEqual(format.timeAgo(iso(21), now), '3 周前')
  assert.strictEqual(format.timeAgo(iso(45), now), '1 个月前')
  assert.strictEqual(format.timeAgo(iso(95), now), '3 个月前')
  assert.strictEqual(format.timeAgo('', now), '')
})

test('timeAgoShort buckets', () => {
  const now = 1_000_000_000_000
  assert.strictEqual(format.timeAgoShort(now - 5 * 60000, now), '5 分钟前')
  assert.strictEqual(format.timeAgoShort(now - 3 * 3600000, now), '3 小时前')
  assert.strictEqual(format.timeAgoShort(now - 30 * 3600000, now), '昨天')
  assert.strictEqual(format.timeAgoShort(now - 72 * 3600000, now), '3 天前')
  assert.strictEqual(format.timeAgoShort(null, now), '')
})

test('author and category names', () => {
  assert.strictEqual(format.author('anthropics'), 'Anthropic')
  assert.strictEqual(format.author('community'), '社区')
  assert.strictEqual(format.author('alice'), 'alice')
  assert.strictEqual(format.categoryName('code'), '编码')
  assert.strictEqual(format.categoryName('unknown'), 'unknown')
})
