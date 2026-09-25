// 在 Node 里模拟最小的 wx 全局对象，供单元测试使用。
const storage = {}
const requests = []
let responder = () => ({ statusCode: 200, data: [], header: {} })

global.wx = {
  getAppBaseInfo: () => ({ language: 'zh_CN' }),
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = JSON.parse(JSON.stringify(v)) },
  removeStorageSync: (k) => { delete storage[k] },
  showToast: () => {},
  request(opts) {
    requests.push(opts)
    const res = responder(opts)
    setTimeout(() => (res.fail ? opts.fail(res) : opts.success(res)), 0)
  },
}

module.exports = {
  storage,
  requests,
  respond(fn) { responder = fn },
  reset() {
    requests.length = 0
    Object.keys(storage).forEach((k) => delete storage[k])
    responder = () => ({ statusCode: 200, data: [], header: {} })
  },
}
