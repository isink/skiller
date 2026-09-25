import { isChinese, t } from './i18n'

const TAB_KEYS = ['home', 'categories', 'favorites']

/** app.json 里写的是中文；非中文微信改成英文。只能在 tab 页 onShow 之后调用。 */
export function localizeTabBar(): void {
  if (isChinese()) return
  TAB_KEYS.forEach((key, index) => {
    wx.setTabBarItem({ index, text: t(key), fail() { /* 非 tab 页调用时忽略 */ } })
  })
}
