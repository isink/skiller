const api = require('../../utils/api')
const favorites = require('../../utils/favorites')
const i18n = require('../../utils/i18n')

Page({
  data: {
    t: i18n.dict(),
    loading: true,
    loadError: false,
    skills: [],
    empty: false,
  },

  loaded: {},

  onLoad() {
    wx.setNavigationBarTitle({ title: i18n.t('favorites') })
    // 在本页取消收藏时立即移除，不必重新请求
    this.unsubscribe = favorites.subscribe(() => this.render())
  },

  onUnload() {
    if (this.unsubscribe) this.unsubscribe()
  },

  onShow() {
    getApp().localizeTabBar()
    this.load()
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh())
  },

  render() {
    const ids = favorites.ids()
    this.setData({
      skills: ids.map((id) => this.loaded[id]).filter(Boolean),
      empty: ids.length === 0,
    })
  },

  load(force) {
    const ids = favorites.ids()
    const missing = force ? ids : ids.filter((id) => !this.loaded[id])
    if (!missing.length) {
      this.setData({ loading: false, loadError: false })
      this.render()
      return Promise.resolve()
    }
    this.setData({ loading: this.data.skills.length === 0, loadError: false })
    return api.fetchSkillsByIds(missing)
      .then((rows) => {
        rows.forEach((s) => { this.loaded[s.id] = s })
        this.setData({ loading: false })
        this.render()
      })
      .catch(() => {
        this.setData({ loading: false, loadError: true })
        this.render()
      })
  },

  onRetry() {
    this.load(true)
  },
})
