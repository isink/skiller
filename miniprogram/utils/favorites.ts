// 本机收藏，对应 iOS 端未登录时的游客收藏。按收藏时间倒序保存，
// 同时保存技能的列表字段快照，断网时收藏页也能展示。

import { toListItem } from './skill'
import { FavoriteEntry, Skill } from './types'

export const KEY = 'skiller.favorites.v1'

type Listener = (list: FavoriteEntry[]) => void
const listeners: Listener[] = []

export function all(): FavoriteEntry[] {
  try {
    const v = wx.getStorageSync(KEY)
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === 'string') : []
  } catch (e) {
    return []
  }
}

function writeAll(list: FavoriteEntry[]): void {
  try {
    wx.setStorageSync(KEY, list)
  } catch (e) {
    wx.showToast({ title: 'Storage error', icon: 'none' })
  }
  listeners.slice().forEach((fn) => fn(list))
}

export function ids(): string[] {
  return all().map((e) => e.id)
}

export function has(id: string): boolean {
  return all().some((e) => e.id === id)
}

/** 切换收藏状态，返回切换后是否已收藏。传入 skill 时一并保存快照。 */
export function toggle(id: string, skill?: Skill | null): boolean {
  const list = all()
  const idx = list.findIndex((e) => e.id === id)
  if (idx >= 0) {
    list.splice(idx, 1)
    writeAll(list)
    return false
  }
  const entry: FavoriteEntry = { id, createdAt: Date.now() }
  if (skill && skill.id === id) entry.skill = toListItem(skill)
  list.unshift(entry)
  writeAll(list)
  return true
}

/** 用最新读到的数据刷新快照，不改变收藏顺序，也不通知订阅者。 */
export function refreshSnapshots(skills: Skill[]): void {
  const byId: Record<string, Skill> = {}
  skills.forEach((s) => { byId[s.id] = s })
  const list = all()
  let changed = false
  list.forEach((e) => {
    const s = byId[e.id]
    if (s) { e.skill = toListItem(s); changed = true }
  })
  if (!changed) return
  try { wx.setStorageSync(KEY, list) } catch (e) { /* 快照刷新失败不影响使用 */ }
}

/** 订阅收藏变化，返回取消订阅函数。 */
export function subscribe(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}
