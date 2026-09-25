import { isChinese } from './i18n'
import * as format from './format'
import { Skill, SkillCardViewModel, SkillListItem } from './types'

/** 中文用户优先中文简介，其他语言优先英文，缺失时互相回退。 */
export function localizedDescription(skill: Pick<Skill, 'description' | 'description_zh'>): string {
  if (isChinese() && skill.description_zh) return skill.description_zh
  if (skill.description) return skill.description
  return skill.description_zh || ''
}

export function localizedUseCases(skill: Pick<Skill, 'use_cases' | 'use_cases_en'>): string[] {
  const zh = isChinese()
  const preferred = zh ? skill.use_cases : skill.use_cases_en
  if (preferred && preferred.length) return preferred
  return (zh ? skill.use_cases_en : skill.use_cases) || []
}

const HIDDEN_TAGS = ['claude', 'codex', 'cursor']

/** 去掉平台类通用标签后的展示标签。 */
export function displayTags(skill: Pick<Skill, 'tags'>): string[] {
  return (skill.tags || []).filter((tag) => HIDDEN_TAGS.indexOf(tag) < 0)
}

export function chips(skill: Pick<Skill, 'use_cases' | 'use_cases_en' | 'tags'>): string[] {
  const useCases = localizedUseCases(skill)
  if (useCases.length) return useCases.slice(0, 3)
  return displayTags(skill).slice(0, 3)
}

/** 只接受 https://github.com/<owner>/<repo>... 形式的来源链接，其余视为不可用。 */
export function githubRepositoryURL(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = /^https:\/\/github\.com(\/[^\s?#]*)?([?#][^\s]*)?$/i.exec(raw.trim())
  if (!m || !m[1]) return null
  const segments = m[1].split('/').filter(Boolean)
  if (segments.length < 2) return null
  return raw.trim()
}

export function present(skill: Skill): SkillCardViewModel {
  return {
    id: skill.id,
    name: skill.name,
    featured: !!skill.featured,
    category: skill.category,
    categoryName: format.categoryName(skill.category),
    stars: format.stars(skill.github_stars),
    authorName: format.author(skill.author),
    timeAgo: format.timeAgo(skill.published_at || skill.created_at),
    description: localizedDescription(skill),
    chips: chips(skill),
  }
}

/** 只保留列表字段，收藏快照不存 SKILL.md 正文，避免占满本地存储。 */
export function toListItem(skill: Skill): SkillListItem {
  return {
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    description_zh: skill.description_zh,
    category: skill.category,
    tags: skill.tags,
    use_cases: skill.use_cases,
    use_cases_en: skill.use_cases_en,
    author: skill.author,
    github_url: skill.github_url,
    github_stars: skill.github_stars,
    rank: skill.rank,
    score: skill.score,
    featured: skill.featured,
    created_at: skill.created_at,
    published_at: skill.published_at,
  }
}

/** YAML frontmatter 是给 Claude 解析的元数据，展示前剥掉。 */
export function stripFrontmatter(md: string | null | undefined): string {
  if (!md || md.indexOf('---') !== 0) return md || ''
  return md.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '').trim()
}
