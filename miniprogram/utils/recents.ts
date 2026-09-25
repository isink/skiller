// 本机浏览记录，用于“足迹”统计，对应 iOS 端 RecentViewStore。

import { RecentEntry } from './types'

export const KEY = 'skiller.recents.v1'
const MAX = 500

export function all(): RecentEntry[] {
  try {
    const v = wx.getStorageSync(KEY)
    return Array.isArray(v) ? v : []
  } catch (e) {
    return []
  }
}

export function record(skillId: string, category: string): void {
  const list = all().filter((e) => e.id !== skillId)
  list.unshift({ id: skillId, category, at: Date.now() })
  try {
    wx.setStorageSync(KEY, list.slice(0, MAX))
  } catch (e) { /* 足迹只是统计，写失败不影响使用 */ }
}

export function clear(): void {
  try { wx.removeStorageSync(KEY) } catch (e) { /* ignore */ }
}

/** 浏览次数最多的分类 slug，没有记录时返回 null。 */
export function topCategory(list: RecentEntry[] = all()): string | null {
  const counts: Record<string, number> = {}
  let best: string | null = null
  list.forEach((e) => {
    counts[e.category] = (counts[e.category] || 0) + 1
    if (best === null || counts[e.category] > counts[best]) best = e.category
  })
  return best
}
