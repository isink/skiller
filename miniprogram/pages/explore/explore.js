const cache = require('../../utils/cache')
const format = require('../../utils/format')
const i18n = require('../../utils/i18n')

const PAGE_SIZE = 50

Page({
  data: {
    t: i18n.dict(),
    mode: 'repos', // repos | skills
    category: '',
    categories: [],
    totalCount: -1,
    skills: [],
    repos: [],
    loading: true,
    page: 0,
    totalPages: 1,
  },

  counts: {},

  onLoad() {
    wx.setNavigationBarTitle({ title: i18n.t('explore') })
    this.loadCategories()
    this.loadCurrent()
  },

  onShow() {
    getApp().localizeTabBar()
  },

  onPullDownRefresh() {
    this.loadCurrent(true).then(() => wx.stopPullDownRefresh())
  },

  onShareAppMessage() {
    return { title: 'Skiller · ' + i18n.t('explore'), path: '/pages/explore/explore' }
  },

  applyCategories(rows, counts) {
    if (counts) this.counts = counts
    const c = this.counts
    const categories = (rows || this.rawCategories || []).map((row) => ({
      slug: row.slug,
      label: format.categoryName(row.slug),
      count: c[row.slug] === undefined ? -1 : c[row.slug],
    }))
    if (rows) this.rawCategories = rows
    const total = Object.keys(c).reduce((sum, k) => sum + c[k], 0)
    this.setData({ categories, totalCount: total, totalPages: this.computeTotalPages() })
  },

  loadCategories() {
    const cats = cache.categories()
    const counts = cache.categoryCounts()
    if (cats.stale || counts.stale) this.applyCategories(cats.stale, counts.stale)
    cats.fresh.then((rows) => { if (rows) this.applyCategories(rows, null) })
    counts.fresh.then((c) => { if (c) this.applyCategories(null, c) })
  },

  computeTotalPages() {
    const c = this.counts
    const category = this.data.category
    const total = category
      ? (c[category] || 0)
      : Object.keys(c).reduce((sum, k) => sum + c[k], 0)
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  },

  loadCurrent(force) {
    const { mode, category, page } = this.data
    const token = (this.loadToken || 0) + 1
    this.loadToken = token

    const pair = mode === 'repos'
      ? cache.repoGroups(1000, force)
      : category
        ? cache.skillsByCategory(category, page * PAGE_SIZE, PAGE_SIZE, force)
        : cache.allSkills(page * PAGE_SIZE, PAGE_SIZE, force)
    const field = mode === 'repos' ? 'repos' : 'skills'

    this.setData({ [field]: pair.stale || [], loading: !pair.stale })
    return pair.fresh.then((v) => {
      if (token !== this.loadToken) return
      const patch = { loading: false }
      if (v) patch[field] = v
      this.setData(patch)
    })
  },

  onSelectCategory(e) {
    const category = e.detail.value
    // 仓库列表不按分类筛选，选了分类就切到技能列表
    this.setData({ category, mode: 'skills', page: 0 })
    this.setData({ totalPages: this.computeTotalPages() })
    this.loadCurrent()
  },

  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.mode) return
    this.setData({ mode, page: 0 })
    this.loadCurrent()
  },

  onPageChange(e) {
    this.setData({ page: e.detail.page })
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    this.loadCurrent()
  },
})
