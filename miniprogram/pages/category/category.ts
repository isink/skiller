import * as cache from '../../utils/cache'
import { SWR } from '../../utils/cache'
import * as format from '../../utils/format'
import { dict, t } from '../../utils/i18n'
import { localizeTabBar } from '../../utils/tabbar'
import { Category, CategoryCounts, RepoGroup, SkillListItem } from '../../utils/types'

const PAGE_SIZE = 50

type Mode = 'skills' | 'repos'

interface ChipItem {
  slug: string
  label: string
  count: number
}

let rawCategories: Category[] = []
let counts: CategoryCounts = {}
let loadToken = 0

function sum(c: CategoryCounts): number {
  return Object.keys(c).reduce((acc, k) => acc + c[k], 0)
}

Page({
  data: {
    t: dict(),
    mode: 'skills' as Mode,
    category: '',
    categories: [] as ChipItem[],
    totalCount: -1,
    skills: [] as SkillListItem[],
    repos: [] as RepoGroup[],
    loading: true,
    loadError: false,
    page: 0,
    totalPages: 1,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('categories') })
    this.loadCategories(false)
    this.loadCurrent(false)
  },

  onShow() {
    localizeTabBar()
  },

  onPullDownRefresh() {
    this.loadCategories(true)
    this.loadCurrent(true).then(() => wx.stopPullDownRefresh())
  },

  onShareAppMessage() {
    return { title: 'Skiller · ' + t('categories'), path: '/pages/category/category' }
  },

  renderCategories() {
    const categories = rawCategories.map((row) => ({
      slug: row.slug,
      label: format.categoryName(row.slug),
      count: counts[row.slug] === undefined ? -1 : counts[row.slug],
    }))
    this.setData({
      categories,
      totalCount: Object.keys(counts).length ? sum(counts) : -1,
      totalPages: this.computeTotalPages(this.data.category),
    })
  },

  loadCategories(force: boolean) {
    const cats = cache.categories(force)
    const cnt = cache.categoryCounts(force)
    if (cats.stale) rawCategories = cats.stale
    if (cnt.stale) counts = cnt.stale
    this.renderCategories()
    cats.fresh.then((res) => { if (res.value) { rawCategories = res.value; this.renderCategories() } })
    cnt.fresh.then((res) => { if (res.value) { counts = res.value; this.renderCategories() } })
  },

  computeTotalPages(category: string): number {
    const total = category ? (counts[category] || 0) : sum(counts)
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  },

  loadCurrent(force: boolean): Promise<void> {
    const { mode, category, page } = this.data
    const token = ++loadToken

    if (mode === 'repos') {
      return this.apply(token, cache.repoGroups(1000, force), 'repos')
    }
    const pair = category
      ? cache.skillsByCategory(category, page * PAGE_SIZE, PAGE_SIZE, force)
      : cache.allSkills(page * PAGE_SIZE, PAGE_SIZE, force)
    return this.apply(token, pair, 'skills')
  },

  apply<T>(token: number, pair: SWR<T[]>, field: 'skills' | 'repos'): Promise<void> {
    this.setData({ [field]: pair.stale || [], loading: !pair.stale, loadError: false })
    return pair.fresh.then((res) => {
      if (token !== loadToken) return
      if (res.value) this.setData({ [field]: res.value })
      this.setData({ loading: false, loadError: res.error && !pair.stale })
    })
  },

  onRetry() {
    this.loadCurrent(false)
  },

  onSelectCategory(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const category = e.detail.value
    // 仓库列表不按分类筛选，选了分类就切到技能列表
    this.setData({ category, mode: 'skills', page: 0, totalPages: this.computeTotalPages(category) })
    this.loadCurrent(false)
  },

  onSelectMode(e: WechatMiniprogram.BaseEvent) {
    const mode = e.currentTarget.dataset.mode as Mode
    if (mode === this.data.mode) return
    this.setData({ mode, page: 0 })
    this.loadCurrent(false)
  },

  onPageChange(e: WechatMiniprogram.CustomEvent<{ page: number }>) {
    this.setData({ page: e.detail.page })
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    this.loadCurrent(false)
  },
})
