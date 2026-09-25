const cache = require('../../utils/cache')
const favorites = require('../../utils/favorites')
const recents = require('../../utils/recents')
const skillUtil = require('../../utils/skill')
const markdown = require('../../utils/markdown')
const i18n = require('../../utils/i18n')

Page({
  data: {
    t: i18n.dict(),
    id: '',
    vm: null,
    sourceURL: '',
    html: '',
    hasMarkdown: false,
    loading: true,
    favorited: false,
    copiedSource: false,
    copiedRaw: false,
  },

  onLoad(options) {
    const id = options.id || ''
    this.setData({ id, favorited: favorites.has(id) })
    this.load(id)
  },

  onShow() {
    if (this.data.id) this.setData({ favorited: favorites.has(this.data.id) })
  },

  onUnload() {
    clearTimeout(this.sourceTimer)
    clearTimeout(this.rawTimer)
  },

  onShareAppMessage() {
    const vm = this.data.vm
    return {
      title: vm ? vm.name + ' · Skiller' : 'Skiller',
      path: '/pages/detail/detail?id=' + this.data.id,
    }
  },

  onShareTimeline() {
    const vm = this.data.vm
    return { title: vm ? vm.name + ' · Skiller' : 'Skiller', query: 'id=' + this.data.id }
  },

  apply(skill) {
    this.skill = skill
    const md = skill.skill_md_content || ''
    const patch = {
      vm: skillUtil.present(skill),
      sourceURL: skillUtil.githubRepositoryURL(skill.github_url) || '',
      hasMarkdown: !!md,
    }
    // 列表缓存里的记录没有 SKILL.md，只在拿到完整记录后再渲染正文。
    if (md && md !== this.renderedMarkdown) {
      this.renderedMarkdown = md
      patch.html = markdown.toHTML(skillUtil.stripFrontmatter(md))
    }
    this.setData(patch)
    wx.setNavigationBarTitle({ title: skill.name })
  },

  load(id) {
    const { stale, fresh } = cache.skillById(id)
    if (stale) this.apply(stale)
    this.setData({ loading: !stale })
    fresh.then((skill) => {
      if (skill) this.apply(skill)
      this.setData({ loading: false })
      if (this.skill) recents.record(this.skill.id, this.skill.category)
    })
  },

  onToggleFavorite() {
    wx.vibrateShort && wx.vibrateShort({ type: 'light', fail() {} })
    this.setData({ favorited: favorites.toggle(this.data.id) })
  },

  copy(text, flag, timerKey) {
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.hideToast()
        this.setData({ [flag]: true })
        clearTimeout(this[timerKey])
        this[timerKey] = setTimeout(() => this.setData({ [flag]: false }), 1600)
      },
      fail: () => wx.showToast({ title: i18n.t('copyFailed'), icon: 'none' }),
    })
  },

  onCopySource() {
    if (this.data.sourceURL) this.copy(this.data.sourceURL, 'copiedSource', 'sourceTimer')
  },

  onCopyMarkdown() {
    const md = this.skill && this.skill.skill_md_content
    if (md) this.copy(md, 'copiedRaw', 'rawTimer')
  },
})
