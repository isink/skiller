// 简体中文与 English 两套文案，按微信客户端语言选择，非中文一律用英文。

type Pair = [string, string]

export const STRINGS: Record<string, Pair> = {
  home: ['Home', '首页'],
  categories: ['Categories', '分类'],
  favorites: ['Favorites', '收藏'],
  about: ['About Skiller', '关于 Skiller'],

  more: ['More', '更多'],
  retry: ['Retry', '重试'],
  copied: ['Copied', '已复制'],
  copyFailed: ['Copy failed', '复制失败'],
  official: ['Official', '官方'],
  community: ['Community', '社区'],
  loading: ['Loading…', '加载中…'],
  loadMore: ['Load more', '加载更多'],
  noMore: ['No more results', '没有更多了'],
  offlineBanner: ['Offline · showing content from %s', '网络不可用，显示的是%s加载的内容'],
  networkError: ['Network error, tap to retry', '网络异常，点击重试'],

  today: ['Today', '今天'],
  yesterday: ['Yesterday', '昨天'],
  daysAgo: ['%s days ago', '%s 天前'],
  weekAgo: ['1 week ago', '1 周前'],
  weeksAgo: ['%s weeks ago', '%s 周前'],
  monthAgo: ['1 month ago', '1 个月前'],
  monthsAgo: ['%s months ago', '%s 个月前'],
  minutesAgo: ['%s minutes ago', '%s 分钟前'],
  hoursAgo: ['%s hours ago', '%s 小时前'],

  cat_official: ['Official', '官方'],
  cat_ai: ['AI', 'AI'],
  cat_code: ['Coding', '编码'],
  cat_data: ['Data', '数据'],
  cat_devops: ['DevOps', '运维'],
  cat_security: ['Security', '安全'],
  cat_design: ['Design', '设计'],
  cat_docs: ['Docs', '文档'],
  cat_office: ['Office', '办公'],
  cat_research: ['Research', '研究'],
  cat_misc: ['Other', '其他'],

  tagline: ['Discover quality Claude skills', '发现优质 Claude 技能'],
  updatedAt: ['Updated %s', '%s更新'],
  totalSkills: ['Total skills', '技能总数'],
  newToday: ['New today', '今日新增'],
  searchPlaceholder: ['Search skills, tags, authors', '搜索技能、标签、作者'],
  latest: ['Latest', '最新收录'],
  popular: ['Popular', '热门技能'],
  loadFailed: ['Loading failed, check your network', '加载失败，请检查网络'],
  foundResults: ['Found %s results for "%s"', '找到 %s 个关于 "%s" 的结果'],
  searchFailed: ['Search failed, check your network', '搜索失败，请检查网络'],
  noResults: ['No matching results', '没有匹配结果'],
  tryOtherKeywords: ['Try other keywords', '试试其他关键词'],

  all: ['All', '全部'],
  repos: ['Repos', '仓库'],
  skills: ['Skills', '技能'],
  noSkills: ['No skills yet', '还没有技能'],
  noRepos: ['No repos yet', '还没有仓库'],
  repoSkillCount: ['%s · %s skills', '%s · %s 个 skill'],
  pageOf: ['Page %s / %s', '第 %s / %s 页'],

  batchSummary: ['%s in this batch · sorted by ★', '本次收录 %s 个 · 按 ★ 排序'],
  nothingInBatch: ['Nothing in this batch', '本次没有收录'],

  skillNotFound: ['Skill not found', '找不到该技能'],
  skillLoadFailed: ['Could not load this skill', '技能加载失败'],
  category: ['Category', '分类'],
  tags: ['Tags', '标签'],
  sourceRepo: ['Source Repository', '源码仓库'],
  sourceHint: [
    'Review the repository instructions before installing third-party code.',
    '安装第三方代码前，请先查看仓库中的说明。',
  ],
  copyLink: ['Copy Link', '复制链接'],
  copyLinkHint: [
    'Mini Programs cannot open external sites. Copy the link and open it in a browser.',
    '小程序内无法直接打开外部网站，请复制链接后在浏览器中打开。',
  ],
  sourceUnavailable: ['Source repository unavailable', '源码仓库暂不可用'],
  copyMarkdown: ['Copy', '复制全文'],

  noFavorites: ['No favorites yet', '还没有收藏'],
  noFavoritesHint: ['Tap the heart on a skill to favorite it', '点击技能卡片或详情页上的心形即可收藏'],
  favoritesLocalNote: ['Favorites are saved on this device', '收藏保存在本机'],
  favoritesOffline: ['Offline · showing saved copies', '网络不可用，显示的是收藏时保存的信息'],

  appSubtitle: ['Discover and install Claude AI skills', '发现并安装 Claude AI 技能'],
  myFootprint: ['My footprint', '我的足迹'],
  favorited: ['Favorited', '已收藏'],
  browsed: ['Browsed', '浏览过'],
  mostViewed: ['Most viewed', '最常看'],
  clearHistory: ['Clear browsing history', '清除浏览记录'],
  clearHistoryConfirm: [
    'Browsing history on this device will be removed. Favorites are kept.',
    '将清除本机的浏览记录，收藏不受影响。',
  ],
  resources: ['Resources', '社区'],
  officialSkills: ['Anthropic Official Skills', 'Anthropic 官方技能库'],
  skillsDocs: ['Claude Skills Documentation', 'Claude Skills 文档'],
  privacyPolicy: ['Privacy Policy', '隐私政策'],
  termsOfUse: ['Terms of Use', '使用条款'],
  feedback: ['Feedback', '意见反馈'],
  linkCopied: ['Link copied, open it in a browser', '链接已复制，请在浏览器中打开'],
  emailCopied: ['Email address copied', '邮箱地址已复制'],
}

export type Language = 'zh' | 'en'
export type Dict = Record<string, string>

// 界面以简体中文为主；只有微信语言明确不是中文时才切到英文。
function detectLanguage(): Language {
  try {
    const info = typeof wx.getAppBaseInfo === 'function'
      ? wx.getAppBaseInfo()
      : wx.getSystemInfoSync()
    const language = info.language || ''
    return !language || /^zh/i.test(language) ? 'zh' : 'en'
  } catch (e) {
    return 'zh'
  }
}

let lang: Language = typeof wx === 'undefined' ? 'zh' : detectLanguage()
let cachedDict: Dict | null = null

export function setLanguage(next: Language): void {
  lang = next === 'en' ? 'en' : 'zh'
  cachedDict = null
}

export function getLanguage(): Language {
  return lang
}

export function isChinese(): boolean {
  return lang === 'zh'
}

/** 当前语言的完整文案表，页面放进 data.t 供 WXML 使用。 */
export function dict(): Dict {
  if (!cachedDict) {
    const idx = lang === 'zh' ? 1 : 0
    const out: Dict = {}
    Object.keys(STRINGS).forEach((k) => { out[k] = STRINGS[k][idx] })
    cachedDict = out
  }
  return cachedDict
}

/** 取文案并依次替换 %s 占位符。 */
export function t(key: string, ...args: Array<string | number>): string {
  let s = dict()[key]
  if (s === undefined) return key
  args.forEach((a) => { s = s.replace('%s', String(a)) })
  return s
}
