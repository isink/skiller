const cache = require('../../utils/cache')
const format = require('../../utils/format')
const i18n = require('../../utils/i18n')

Page({
  data: {
    t: i18n.dict(),
    loading: true,
    summary: '',
    category: '',
    chips: [],
    visible: [],
    total: 0,
  },

  batch: [],

  onLoad() {
    wx.setNavigationBarTitle({ title: i18n.t('latest') })
    const cats = cache.categories()
    if (cats.stale) this.allCategories = cats.stale
    cats.fresh.then((rows) => {
      if (rows) { this.allCategories = rows; this.render() }
    })

    const { stale, fresh } = cache.latestBatch()
    if (stale) this.batch = stale
    this.setData({ loading: !stale })
    this.render()
    fresh.then((rows) => {
      if (rows) this.batch = rows
      this.setData({ loading: false })
      this.render()
    })
  },

  render() {
    const batch = this.batch
    const counts = {}
    batch.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1 })

    // 按分类表的顺序排，只显示这一批里出现过的分类
    const known = (this.allCategories || []).map((c) => c.slug)
    const extra = Object.keys(counts).filter((slug) => known.indexOf(slug) < 0)
    const chips = known.concat(extra)
      .filter((slug) => counts[slug] > 0)
      .map((slug) => ({ slug, label: format.categoryName(slug), count: counts[slug] }))

    const category = this.data.category
    const visible = (category ? batch.filter((s) => s.category === category) : batch.slice())
      .sort((a, b) => (b.github_stars == null ? -1 : b.github_stars) - (a.github_stars == null ? -1 : a.github_stars))

    let summary = ''
    if (batch.length) {
      summary = i18n.t('batchSummary', batch.length)
      const when = format.parseISO(batch[0].created_at)
      if (when !== null) summary += ' · ' + format.timeAgoShort(when)
    }

    this.setData({ chips, visible, summary, total: batch.length })
  },

  onSelectCategory(e) {
    this.setData({ category: e.detail.value })
    this.render()
  },
})
