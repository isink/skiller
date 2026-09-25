// 小程序内部使用的数据接口。字段名与 Supabase 公开 schema 保持一致（snake_case）。

/** skills 表列表查询返回的字段（不含 SKILL.md 正文）。 */
export interface SkillListItem {
  id: string
  slug: string
  name: string
  description: string
  description_zh: string | null
  category: string
  tags: string[]
  use_cases: string[] | null
  use_cases_en: string[] | null
  author: string
  github_url: string
  github_stars: number | null
  rank: number
  score: number
  featured: boolean
  created_at: string
  published_at: string | null
}

/** 详情查询（select=*）额外带回 SKILL.md 原文。 */
export interface SkillDetail extends SkillListItem {
  skill_md_content: string | null
}

export type Skill = SkillListItem | SkillDetail

export interface Category {
  id: string
  slug: string
  name: string
  icon: string
}

/** get_repo_groups RPC 的一行。skill_count 在 Postgres 里是 bigint，JSON 里可能是字符串，读取时转成 number。 */
export interface RepoGroup {
  repo: string
  author: string
  stars: number | null
  skill_count: number
  rep_skill_id: string
}

export type CategoryCounts = Record<string, number>

export interface HomeStats {
  total: number
  newToday: number
  /** 最近一次入库时间（毫秒时间戳） */
  lastSyncAt: number | null
}

/** 本机收藏存储的一项。skill 是收藏时的快照，离线时用它展示列表。 */
export interface FavoriteEntry {
  id: string
  createdAt: number
  skill?: SkillListItem
}

export interface RecentEntry {
  id: string
  category: string
  at: number
}

/** 卡片组件使用的展示字段，WXML 里不做逻辑。 */
export interface SkillCardViewModel {
  id: string
  name: string
  featured: boolean
  category: string
  categoryName: string
  stars: string
  authorName: string
  timeAgo: string
  description: string
  chips: string[]
}

/** 一次网络读取的结果：value 为 null 且 error 为 false 表示“确实没有”（如详情不存在）。 */
export interface FetchResult<T> {
  value: T | null
  error: boolean
}
