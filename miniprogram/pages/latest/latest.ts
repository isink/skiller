import * as cache from '../../utils/cache'
import * as format from '../../utils/format'
import { dict, t } from '../../utils/i18n'
import { Category, SkillListItem } from '../../utils/types'

interface ChipItem {
  slug: string
  label: string
  count: number
}

let batch: SkillListItem[] = []
let allCategories: Category[] = []

function byStarsDesc(a: SkillListItem, b: SkillListItem): number {
  const sa = a.github_stars == null ? -1 : a.github_stars
  const sb = b.github_stars == null ? -1 : b.github_stars
  return sb - sa
}

Page({
  data: {
    t: dict(),
    loading: true,
    loadError: false,
    summary: '',
    category: '',
    chips: [] as ChipItem[],
    visible: [] as SkillListItem[],
    total: 0,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('latest') })
    batch = []
    const cats = cache.categories()
    if (cats.stale) allCategories = cats.stale
    cats.fresh.then((res) => {
      if (res.value) { allCategories = res.value; this.render() }
    })
    this.load()
  },

  load() {
    const { stale, fresh } = cache.latestBatch()
    if (stale) batch = stale
    this.setData({ loading: !stale, loadError: false })
    this.render()
    fresh.then((res) => {
      if (res.value) batch = res.value
      this.setData({ loading: false, loadError: res.error && !batch.length })
      this.render()
    })
  },

  onRetry() {
    this.load()
  },

  render() {
    const counts: Record<string, number> = {}
    batch.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1 })

    // 按分类表的顺序排，只显示这一批里出现过的分类
    const known = allCategories.map((c) => c.slug)
    const extra = Object.keys(counts).filter((slug) => known.indexOf(slug) < 0)
    const chips = known.concat(extra)
      .filter((slug) => counts[slug] > 0)
      .map((slug) => ({ slug, label: format.categoryName(slug), count: counts[slug] }))

    const category = this.data.category
    const visible = (category ? batch.filter((s) => s.category === category) : batch.slice()).sort(byStarsDesc)

    let summary = ''
    if (batch.length) {
      summary = t('batchSummary', batch.length)
      const when = format.parseISO(batch[0].created_at)
      if (when !== null) summary += ' · ' + format.timeAgoShort(when)
    }

    this.setData({ chips, visible, summary, total: batch.length })
  },

  onSelectCategory(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ category: e.detail.value })
    this.render()
  },
})
