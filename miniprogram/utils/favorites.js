// 本机收藏，对应 iOS 端未登录时的游客收藏。按收藏时间倒序保存。

const KEY = 'skiller.favorites.v1'
const listeners = []

function readAll() {
  try {
    const v = wx.getStorageSync(KEY)
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === 'string') : []
  } catch (e) {
    return []
  }
}

function writeAll(list) {
  try {
    wx.setStorageSync(KEY, list)
  } catch (e) {
    wx.showToast({ title: 'Storage error', icon: 'none' })
  }
  listeners.slice().forEach((fn) => fn(list))
}

function ids() {
  return readAll().map((e) => e.id)
}

function has(id) {
  return readAll().some((e) => e.id === id)
}

/** 切换收藏状态，返回切换后是否已收藏。 */
function toggle(id) {
  const list = readAll()
  const idx = list.findIndex((e) => e.id === id)
  if (idx >= 0) {
    list.splice(idx, 1)
    writeAll(list)
    return false
  }
  list.unshift({ id, createdAt: Date.now() })
  writeAll(list)
  return true
}

/** 订阅收藏变化，返回取消订阅函数。 */
function subscribe(fn) {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

module.exports = { ids, has, toggle, subscribe, KEY }
