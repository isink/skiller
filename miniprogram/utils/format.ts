import { t } from './i18n'

export const CATEGORY_ORDER = [
  'official', 'ai', 'code', 'data', 'devops', 'security',
  'design', 'docs', 'office', 'research', 'misc',
]

export function categoryName(slug: string): string {
  const key = 'cat_' + slug
  const name = t(key)
  return name === key ? slug : name
}

export function stars(n: number | null | undefined): string {
  if (!n || n <= 0) return ''
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export function count(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export function author(a: string): string {
  if (a === 'anthropics') return 'Anthropic'
  if (a === 'community') return t('community')
  return a
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/i

/**
 * 解析 Postgres/ISO 8601 时间戳，返回毫秒时间戳或 null。
 * Postgres 返回微秒精度（6 位小数），iOS 上的 JavaScriptCore 对这种格式的
 * Date.parse 支持不稳定，所以手动解析。无时区后缀时按 UTC 处理。
 */
export function parseISO(s: string | null | undefined): number | null {
  if (!s || typeof s !== 'string') return null
  const m = ISO_RE.exec(s.trim())
  if (!m) return null
  const ms = m[7] ? Number((m[7] + '00').slice(0, 3)) : 0
  let time = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms)
  const tz = m[8]
  if (tz && tz.toUpperCase() !== 'Z') {
    const sign = tz[0] === '-' ? -1 : 1
    const digits = tz.slice(1).replace(':', '')
    const offset = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || 0)
    time -= sign * offset * 60000
  }
  return time
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  const time = parseISO(iso)
  if (time === null) return ''
  const days = Math.floor((now - time) / 86400000)
  if (days <= 0) return t('today')
  if (days === 1) return t('yesterday')
  if (days < 7) return t('daysAgo', days)
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? t('weekAgo') : t('weeksAgo', weeks)
  }
  const months = Math.floor(days / 30)
  return months === 1 ? t('monthAgo') : t('monthsAgo', months)
}

export function timeAgoShort(ms: number | null | undefined, now = Date.now()): string {
  if (ms === null || ms === undefined) return ''
  const mins = Math.max(0, Math.floor((now - ms) / 60000))
  if (mins < 60) return t('minutesAgo', mins)
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('hoursAgo', hours)
  const days = Math.floor(hours / 24)
  return days === 1 ? t('yesterday') : t('daysAgo', days)
}
