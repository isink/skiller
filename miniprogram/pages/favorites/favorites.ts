import * as api from '../../utils/api'
import * as favorites from '../../utils/favorites'
import { dict, t } from '../../utils/i18n'
import { localizeTabBar } from '../../utils/tabbar'
import { FavoriteEntry, SkillListItem } from '../../utils/types'

// 本次会话里从网络读到的最新数据；没有时用收藏时保存的快照
let latest: Record<string, SkillListItem> = {}
let unsubscribe: (() => void) | null = null
let loadToken = 0

function toItems(entries: FavoriteEntry[]): SkillListItem[] {
  return entries
    .map((e) => latest[e.id] || e.skill)
    .filter((s): s is SkillListItem => !!s)
}

Page({
  data: {
    t: dict(),
    loading: true,
    offline: false,
    empty: false,
    skills: [] as SkillListItem[],
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('favorites') })
    // 在本页取消收藏时立即移除，不必重新请求
    unsubscribe = favorites.subscribe(() => this.render())
  },

  onUnload() {
    if (unsubscribe) unsubscribe()
    unsubscribe = null
  },

  onShow() {
    localizeTabBar()
    this.render()
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh())
  },

  render() {
    const entries = favorites.all()
    this.setData({ skills: toItems(entries), empty: entries.length === 0 })
  },

  refresh(): Promise<void> {
    const entries = favorites.all()
    // 旧版本存下的收藏可能没有快照，这种情况下首次加载要等网络
    const needsNetwork = entries.some((e) => !latest[e.id] && !e.skill)
    this.setData({ loading: needsNetwork && this.data.skills.length === 0 })
    if (!entries.length) {
      this.setData({ loading: false, offline: false })
      return Promise.resolve()
    }
    const token = ++loadToken
    return api.fetchSkillsByIds(entries.map((e) => e.id)).then(
      (rows) => {
        if (token !== loadToken) return
        rows.forEach((s) => { latest[s.id] = s })
        favorites.refreshSnapshots(rows)
        this.setData({ loading: false, offline: false })
        this.render()
      },
      () => {
        if (token !== loadToken) return
        this.setData({ loading: false, offline: true })
        this.render()
      },
    )
  },

  onRetry() {
    this.refresh()
  },
})
