// stale-while-revalidate 缓存，对应 iOS 端 SkillsCache。
// 模块是单例，各页面共享同一份内存缓存；首页等关键数据额外写入本地存储，
// 断网或冷启动时先展示最近一次成功读取的内容。

import * as api from './api'
import { Category, CategoryCounts, FetchResult, HomeStats, RepoGroup, Skill, SkillDetail, SkillListItem } from './types'

interface Entry<T> {
  value: T
  at: number
}

export interface SWR<T, S = T> {
  /** 已缓存的值（可能为 null） */
  stale: S | null
  /** stale 的读取时间，用于提示“显示的是 X 前的内容” */
  staleAt: number | null
  /** TTL 内直接复用缓存，否则重新请求；从不 reject */
  fresh: Promise<FetchResult<T>>
}

interface Options {
  force?: boolean
  persist?: boolean
}

export const PERSIST_PREFIX = 'skiller.cache.v1:'

const memory: Record<string, Entry<unknown>> = {}
const skillIndex: Record<string, Skill> = {}

function readPersisted<T>(key: string): Entry<T> | null {
  try {
    const v = wx.getStorageSync(PERSIST_PREFIX + key)
    return v && typeof v === 'object' && 'value' in v && typeof v.at === 'number' ? (v as Entry<T>) : null
  } catch (e) {
    return null
  }
}

function writePersisted<T>(key: string, entry: Entry<T>): void {
  try {
    wx.setStorageSync(PERSIST_PREFIX + key, entry)
  } catch (e) { /* 存储满或不可用时只丢失离线能力 */ }
}

function isSkill(v: unknown): v is Skill {
  return !!v && typeof v === 'object' && typeof (v as Skill).id === 'string' && typeof (v as Skill).slug === 'string'
}

function seedSkill(s: Skill): void {
  // 已有完整详情（含 SKILL.md）时，不要被列表里的精简记录覆盖。
  const existing = skillIndex[s.id] as SkillDetail | undefined
  if (existing && existing.skill_md_content != null && (s as SkillDetail).skill_md_content == null) return
  skillIndex[s.id] = s
}

function seed(value: unknown): void {
  if (Array.isArray(value)) value.forEach((v) => { if (isSkill(v)) seedSkill(v) })
  else if (isSkill(value)) seedSkill(value)
}

export function swr<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>, options: Options = {}): SWR<T> {
  let entry = memory[key] as Entry<T> | undefined
  if (!entry && options.persist) {
    const persisted = readPersisted<T>(key)
    if (persisted) {
      entry = persisted
      memory[key] = persisted
    }
  }
  const stale = entry ? entry.value : null
  if (stale) seed(stale)
  const isFresh = !options.force && !!entry && Date.now() - entry.at < ttlSeconds * 1000

  const fresh: Promise<FetchResult<T>> = isFresh
    ? Promise.resolve({ value: stale, error: false })
    : fetcher().then((value) => {
      const next = { value, at: Date.now() }
      memory[key] = next
      if (options.persist) writePersisted(key, next)
      seed(value)
      return { value, error: false }
    }, () => ({ value: null, error: true }))

  return { stale, staleAt: entry ? entry.at : null, fresh }
}

/** 清空内存缓存（下拉刷新用）。本地持久化的离线数据保留，直到被新数据覆盖。 */
export function clear(): void {
  Object.keys(memory).forEach((k) => { delete memory[k] })
  Object.keys(skillIndex).forEach((k) => { delete skillIndex[k] })
}

export function peekSkill(id: string): Skill | null {
  return skillIndex[id] || null
}

export const homeStats = (force?: boolean): SWR<HomeStats> =>
  swr('homeStats', 60, api.fetchHomeStats, { force, persist: true })

export const newSkills = (limit = 10, force?: boolean): SWR<SkillListItem[]> =>
  swr('new:' + limit, 60, () => api.fetchNewSkills(limit), { force, persist: true })

export const popularSkills = (limit = 10, force?: boolean): SWR<SkillListItem[]> =>
  swr('popular:' + limit, 300, () => api.fetchPopularSkills(limit), { force, persist: true })

export const latestBatch = (force?: boolean): SWR<SkillListItem[]> =>
  swr('latestBatch', 120, () => api.fetchLatestBatch(), { force })

export const allSkills = (offset = 0, limit = 50, force?: boolean): SWR<SkillListItem[]> =>
  swr('all:' + offset + ':' + limit, 60, () => api.fetchAllSkills(offset, limit), { force })

export const skillsByCategory = (cat: string, offset = 0, limit = 50, force?: boolean): SWR<SkillListItem[]> =>
  swr('cat:' + cat + ':' + offset + ':' + limit, 60, () => api.fetchSkillsByCategory(cat, offset, limit), { force })

export const skillsInRepo = (repo: string): SWR<SkillListItem[]> =>
  swr('repo:' + repo, 300, () => api.fetchSkillsInRepo(repo))

export const categories = (force?: boolean): SWR<Category[]> =>
  swr('categories', 600, api.fetchCategories, { force, persist: true })

export const categoryCounts = (force?: boolean): SWR<CategoryCounts> =>
  swr('categoryCounts', 300, api.fetchCategoryCounts, { force, persist: true })

export const repoGroups = (limit = 30, force?: boolean): SWR<RepoGroup[]> =>
  swr('repos:' + limit, 300, () => api.fetchRepoGroups(0, limit), { force })

/**
 * 详情：stale 可以来自之前的完整请求，也可以来自任意列表里的同一条记录。
 * fresh 的 value 为 null 且 error 为 false 表示技能不存在。
 */
export function skillById(id: string): SWR<SkillDetail | null, Skill> {
  const key = 'detail:' + id
  const entry = memory[key] as Entry<SkillDetail> | undefined
  const staleFull = entry ? entry.value : null
  const stale: Skill | null = staleFull || skillIndex[id] || null
  const isFresh = !!entry && Date.now() - entry.at < 300 * 1000

  const fresh: Promise<FetchResult<SkillDetail | null>> = isFresh
    ? Promise.resolve({ value: staleFull, error: false })
    : api.fetchSkillById(id).then((value) => {
      if (value) {
        memory[key] = { value, at: Date.now() }
        seed(value)
      }
      return { value, error: false }
    }, () => ({ value: null, error: true }))

  return { stale, staleAt: entry ? entry.at : null, fresh }
}
