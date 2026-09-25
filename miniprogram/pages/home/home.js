const api = require('../../utils/api')
const cache = require('../../utils/cache')
const format = require('../../utils/format')
const i18n = require('../../utils/i18n')

Page({
  data: {
    t: i18n.dict(),
    query: '',
    searching: false,
    results: [],
    resultsLabel: '',
    stats: null,
    totalText: '—',
    updatedText: '',
    fresh: [],
    loading: true,
    loadError: false,
  },

  onLoad() {
    this.loadHome(false)
  },

  onShow() {
    getApp().localizeTabBar()
  },

  onPullDownRefresh() {
    this.loadHome(true).then(() => wx.stopPullDownRefresh())
  },

  onShareAppMessage() {
    return { title: 'Skiller · ' + i18n.t('tagline'), path: '/pages/home/home' }
  },

  onShareTimeline() {
    return { title: 'Skiller · ' + i18n.t('tagline') }
  },

  applyStats(stats) {
    this.setData({
      stats,
      totalText: String(stats.total),
      updatedText: stats.lastSyncAt ? i18n.t('updatedAt', format.timeAgoShort(stats.lastSyncAt)) : '',
    })
  },

  loadHome(force) {
    if (force) cache.clear()
    this.setData({ loadError: false })

    const s = cache.homeStats(force)
    const n = cache.newSkills(10, force)
    if (s.stale) this.applyStats(s.stale)
    if (n.stale) this.setData({ fresh: n.stale })
    const hadStale = !!(s.stale || n.stale)
    this.setData({ loading: !hadStale })

    return Promise.all([s.fresh, n.fresh]).then(([stats, fresh]) => {
      if (stats) this.applyStats(stats)
      if (fresh) this.setData({ fresh })
      this.setData({ loading: false, loadError: !hadStale && !stats && !fresh })
    })
  },

  onRetry() {
    this.loadHome(false)
  },

  onMore() {
    wx.navigateTo({ url: '/pages/latest/latest' })
  },

  onInput(e) {
    const query = e.detail.value
    const searching = query.trim().length > 0
    this.setData({ query, searching })
    clearTimeout(this.debounce)
    if (!searching) {
      this.searchToken = (this.searchToken || 0) + 1
      this.setData({ results: [] })
      return
    }
    this.debounce = setTimeout(() => this.runSearch(query), 300)
  },

  onClear() {
    clearTimeout(this.debounce)
    this.searchToken = (this.searchToken || 0) + 1
    this.setData({ query: '', searching: false, results: [] })
  },

  runSearch(query) {
    const token = (this.searchToken || 0) + 1
    this.searchToken = token
    api.searchSkills(query)
      .catch(() => [])
      .then((results) => {
        if (token !== this.searchToken) return
        this.setData({
          results,
          resultsLabel: i18n.t('foundResults', results.length, query.trim()),
        })
      })
  },
})
