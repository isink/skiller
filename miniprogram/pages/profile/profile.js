const config = require('../../utils/config')
const favorites = require('../../utils/favorites')
const recents = require('../../utils/recents')
const format = require('../../utils/format')
const i18n = require('../../utils/i18n')

const LINKS = {
  officialSkills: 'https://github.com/anthropics/skills',
  skillsDocs: 'https://docs.anthropic.com/en/docs/claude-code/skills-and-packages',
  privacy: config.legalBase + '/privacy.html',
  terms: config.legalBase + '/terms.html',
}

Page({
  data: {
    t: i18n.dict(),
    favoriteCount: 0,
    browsedCount: 0,
    topCategory: '',
    icpFilingNumber: config.icpFilingNumber,
    codeIcon: '</>',
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: i18n.t('profile') })
  },

  onShow() {
    getApp().localizeTabBar()
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

  copyText(text, toastKey) {
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: i18n.t(toastKey), icon: 'none' }),
      fail: () => wx.showToast({ title: i18n.t('copyFailed'), icon: 'none' }),
    })
  },

  onOpenLink(e) {
    const url = LINKS[e.currentTarget.dataset.key]
    if (url) this.copyText(url, 'linkCopied')
  },

  onFeedback() {
    this.copyText(config.feedbackEmail, 'emailCopied')
  },

  onClearHistory() {
    wx.showModal({
      title: i18n.t('clearHistory'),
      content: i18n.t('clearHistoryConfirm'),
      confirmColor: '#D97757',
      success: (res) => {
        if (!res.confirm) return
        recents.clear()
        this.refresh()
      },
    })
  },
})
