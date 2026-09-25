import * as api from '../../utils/api'
import * as cache from '../../utils/cache'
import * as format from '../../utils/format'
import { dict, t } from '../../utils/i18n'
import { localizeTabBar } from '../../utils/tabbar'
import { HomeStats, SkillListItem } from '../../utils/types'

type SearchStatus = 'idle' | 'loading' | 'done' | 'error'

let debounceTimer = 0
let searchToken = 0

Page({
  data: {
    t: dict(),

    // 首页数据
    stats: null as HomeStats | null,
    totalText: '—',
    updatedText: '',
    fresh: [] as SkillListItem[],
    popular: [] as SkillListItem[],
    loading: true,
    loadError: false,
    offlineText: '',

    // 搜索
    query: '',
    searching: false,
    searchStatus: 'idle' as SearchStatus,
    results: [] as SkillListItem[],
    resultsLabel: '',
    hasMore: false,
    loadingMore: false,
    moreError: false,
  },

  onLoad() {
    this.loadHome(false)
  },

  onShow() {
    localizeTabBar()
  },

  onPullDownRefresh() {
    const done = this.data.searching ? this.runSearch(this.data.query) : this.loadHome(true)
    done.then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.searching) this.loadMoreResults()
  },

  onShareAppMessage() {
    return { title: 'Skiller · ' + t('tagline'), path: '/pages/home/home' }
  },

  onShareTimeline() {
    return { title: 'Skiller · ' + t('tagline') }
  },

  applyStats(stats: HomeStats) {
    this.setData({
      stats,
      totalText: String(stats.total),
      updatedText: stats.lastSyncAt ? t('updatedAt', format.timeAgoShort(stats.lastSyncAt)) : '',
    })
  },

  loadHome(force: boolean): Promise<void> {
    if (force) cache.clear()
    this.setData({ loadError: false })

    const s = cache.homeStats(force)
    const n = cache.newSkills(10, force)
    const p = cache.popularSkills(10, force)
    if (s.stale) this.applyStats(s.stale)
    if (n.stale) this.setData({ fresh: n.stale })
    if (p.stale) this.setData({ popular: p.stale })
    const hadStale = !!(s.stale || n.stale || p.stale)
    this.setData({ loading: !hadStale })

    return Promise.all([s.fresh, n.fresh, p.fresh]).then(([stats, fresh, popular]) => {
      if (stats.value) this.applyStats(stats.value)
      if (fresh.value) this.setData({ fresh: fresh.value })
      if (popular.value) this.setData({ popular: popular.value })

      const allFailed = stats.error && fresh.error && popular.error
      // 全部请求失败但有本地缓存时，提示用户看到的是离线数据
      const staleAt = Math.max(s.staleAt || 0, n.staleAt || 0, p.staleAt || 0)
      this.setData({
        loading: false,
        loadError: allFailed && !hadStale,
        offlineText: allFailed && hadStale ? t('offlineBanner', format.timeAgoShort(staleAt)) : '',
      })
    })
  },

  onRetry() {
    this.loadHome(false)
  },

  onMore() {
    wx.navigateTo({ url: '/pages/latest/latest' })
  },

  onAbout() {
    wx.navigateTo({ url: '/pages/about/about' })
  },

  onInput(e: WechatMiniprogram.Input) {
    const query = e.detail.value
    const searching = query.trim().length > 0
    this.setData({ query, searching })
    clearTimeout(debounceTimer)
    if (!searching) {
      searchToken++
      this.setData({ results: [], searchStatus: 'idle', resultsLabel: '' })
      return
    }
    debounceTimer = setTimeout(() => this.runSearch(query), 300) as unknown as number
  },

  onClear() {
    clearTimeout(debounceTimer)
    searchToken++
    this.setData({ query: '', searching: false, results: [], searchStatus: 'idle', resultsLabel: '' })
  },

  runSearch(query: string): Promise<void> {
    const token = ++searchToken
    this.setData({ searchStatus: 'loading', moreError: false })
    return api.searchSkills(query, 0).then(
      (results) => {
        if (token !== searchToken) return
        this.setData({
          results,
          searchStatus: 'done',
          hasMore: results.length === api.SEARCH_PAGE_SIZE,
          resultsLabel: t('foundResults', results.length + (results.length === api.SEARCH_PAGE_SIZE ? '+' : ''), query.trim()),
        })
      },
      () => {
        if (token !== searchToken) return
        this.setData({ searchStatus: 'error', results: [], hasMore: false, resultsLabel: '' })
      },
    )
  },

  onRetrySearch() {
    this.runSearch(this.data.query)
  },

  loadMoreResults() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.searchStatus !== 'done') return
    const token = searchToken
    const query = this.data.query
    const offset = this.data.results.length
    this.setData({ loadingMore: true, moreError: false })
    api.searchSkills(query, offset).then(
      (more) => {
        if (token !== searchToken) return
        const results = this.data.results.concat(more)
        const hasMore = more.length === api.SEARCH_PAGE_SIZE
        this.setData({
          results,
          hasMore,
          loadingMore: false,
          resultsLabel: t('foundResults', results.length + (hasMore ? '+' : ''), query.trim()),
        })
      },
      () => {
        if (token !== searchToken) return
        this.setData({ loadingMore: false, moreError: true })
      },
    )
  },
})
