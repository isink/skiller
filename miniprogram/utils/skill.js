const i18n = require('./i18n')
const format = require('./format')

/** 中文用户优先中文简介，其他语言优先英文，缺失时互相回退。 */
function localizedDescription(skill) {
  if (i18n.isChinese() && skill.description_zh) return skill.description_zh
  if (skill.description) return skill.description
  return skill.description_zh || ''
}

function localizedUseCases(skill) {
  const zh = i18n.isChinese()
  const preferred = zh ? skill.use_cases : skill.use_cases_en
  if (preferred && preferred.length) return preferred
  return (zh ? skill.use_cases_en : skill.use_cases) || []
}

function chips(skill) {
  const useCases = localizedUseCases(skill)
  if (useCases.length) return useCases.slice(0, 3)
  return (skill.tags || [])
    .filter((t) => ['claude', 'codex', 'cursor'].indexOf(t) < 0)
    .slice(0, 3)
}

/** 只接受 https://github.com/<owner>/<repo>... 形式的来源链接，其余视为不可用。 */
function githubRepositoryURL(raw) {
  if (typeof raw !== 'string') return null
  const m = /^https:\/\/github\.com(\/[^\s?#]*)?([?#][^\s]*)?$/i.exec(raw.trim())
  if (!m || !m[1]) return null
  const segments = m[1].split('/').filter(Boolean)
  if (segments.length < 2) return null
  return raw.trim()
}

/** 列表卡片用的展示字段，WXML 里不做逻辑。 */
function present(skill) {
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

/** YAML frontmatter 是给 Claude 解析的元数据，展示前剥掉。 */
function stripFrontmatter(md) {
  if (!md || md.indexOf('---') !== 0) return md || ''
  return md.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '').trim()
}

module.exports = {
  localizedDescription,
  localizedUseCases,
  chips,
  githubRepositoryURL,
  present,
  stripFrontmatter,
}
