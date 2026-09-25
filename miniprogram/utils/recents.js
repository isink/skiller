// 本机浏览记录，用于“我的足迹”统计，对应 iOS 端 RecentViewStore。

const KEY = 'skiller.recents.v1'
const MAX = 500

function all() {
  try {
    const v = wx.getStorageSync(KEY)
    return Array.isArray(v) ? v : []
  } catch (e) {
    return []
  }
}

function record(skillId, category) {
  const list = all().filter((e) => e.id !== skillId)
  list.unshift({ id: skillId, category, at: Date.now() })
  try {
    wx.setStorageSync(KEY, list.slice(0, MAX))
  } catch (e) { /* 足迹只是统计，写失败不影响使用 */ }
}

function clear() {
  try { wx.removeStorageSync(KEY) } catch (e) { /* ignore */ }
}

/** 浏览次数最多的分类 slug，没有记录时返回 null。 */
function topCategory(list = all()) {
  const counts = {}
  let best = null
  list.forEach((e) => {
    counts[e.category] = (counts[e.category] || 0) + 1
    if (best === null || counts[e.category] > counts[best]) best = e.category
  })
  return best
}

module.exports = { all, record, clear, topCategory, KEY }
