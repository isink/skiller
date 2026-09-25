const i18n = require('./utils/i18n')

const TAB_KEYS = ['home', 'explore', 'favorites', 'profile']

App({
  onLaunch() {
    this.localizeTabBar()
  },

  /** app.json 里写的是中文，非中文客户端改成英文。需在 tab 页 onShow 后调用才生效。 */
  localizeTabBar() {
    if (i18n.isChinese()) return
    TAB_KEYS.forEach((key, index) => {
      wx.setTabBarItem({ index, text: i18n.t(key), fail() {} })
    })
  },
})
