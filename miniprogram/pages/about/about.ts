import * as config from '../../utils/config'
import * as favorites from '../../utils/favorites'
import * as recents from '../../utils/recents'
import * as format from '../../utils/format'
import { dict, t } from '../../utils/i18n'

const LINKS: Record<string, string> = {
  officialSkills: 'https://github.com/anthropics/skills',
  skillsDocs: 'https://docs.anthropic.com/en/docs/claude-code/skills-and-packages',
  privacy: config.legalBase + '/privacy.html',
  terms: config.legalBase + '/terms.html',
}

Page({
  data: {
    t: dict(),
    favoriteCount: 0,
    browsedCount: 0,
    topCategory: '',
    icpFilingNumber: config.icpFilingNumber,
    codeIcon: '</>',
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('about') })
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const history = recents.all()
    const top = recents.topCategory(history)
    this.setData({
      favoriteCount: favorites.ids().length,
      browsedCount: history.length,
      topCategory: top ? format.categoryName(top) : '',
    })
  },

  copyText(text: string, toastKey: string) {
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: t(toastKey), icon: 'none' }),
      fail: () => wx.showToast({ title: t('copyFailed'), icon: 'none' }),
    })
  },

  onOpenLink(e: WechatMiniprogram.BaseEvent) {
    const url = LINKS[e.currentTarget.dataset.key as string]
    if (url) this.copyText(url, 'linkCopied')
  },

  onFeedback() {
    this.copyText(config.feedbackEmail, 'emailCopied')
  },

  onClearHistory() {
    wx.showModal({
      title: t('clearHistory'),
      content: t('clearHistoryConfirm'),
      confirmColor: '#D97757',
      success: (res) => {
        if (!res.confirm) return
        recents.clear()
        this.refresh()
      },
    })
  },
})
