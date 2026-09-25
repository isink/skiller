// 直接调用 Supabase 的 PostgREST 接口（小程序里跑不了 supabase-js）。
// 使用前需在小程序后台把 supabaseUrl 的域名加入 request 合法域名。

const config = require('./config')

function buildQuery(params) {
  return (params || [])
    .filter((p) => p[1] !== undefined && p[1] !== null)
    .map((p) => encodeURIComponent(p[0]) + '=' + encodeURIComponent(String(p[1])))
    .join('&')
}

function headerValue(header, name) {
  if (!header) return undefined
  const lower = name.toLowerCase()
  const key = Object.keys(header).find((k) => k.toLowerCase() === lower)
  return key ? header[key] : undefined
}

class SupabaseError extends Error {
  constructor(statusCode, body) {
    const message = (body && (body.message || body.msg)) || 'HTTP ' + statusCode
    super(message)
    this.statusCode = statusCode
    this.code = body && body.code
  }
}

function request({ path, method = 'GET', params, data, headers }) {
  const qs = buildQuery(params)
  const url = config.supabaseUrl + path + (qs ? '?' + qs : '')
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      timeout: 15000,
      header: Object.assign({
        apikey: config.supabaseAnonKey,
        Authorization: 'Bearer ' + config.supabaseAnonKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }, headers),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res)
        } else {
          reject(new SupabaseError(res.statusCode, res.data))
        }
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || 'request:fail'))
      },
    })
  })
}

/** GET /rest/v1/<table>，返回行数组。 */
function select(table, params) {
  return request({ path: '/rest/v1/' + table, params }).then((res) => res.data || [])
}

/** 精确计数：读取 Content-Range 头里 “/” 后面的总数。 */
function count(table, params) {
  return request({
    path: '/rest/v1/' + table,
    params: [['select', 'id'], ['limit', 1]].concat(params || []),
    headers: { Prefer: 'count=exact' },
  }).then((res) => parseContentRangeTotal(headerValue(res.header, 'Content-Range')))
}

function parseContentRangeTotal(range) {
  if (!range) return 0
  const total = Number(String(range).split('/')[1])
  return Number.isFinite(total) ? total : 0
}

/** POST /rest/v1/rpc/<fn>。 */
function rpc(fn, args) {
  return request({ path: '/rest/v1/rpc/' + fn, method: 'POST', data: args || {} })
    .then((res) => res.data)
}

module.exports = {
  buildQuery,
  headerValue,
  parseContentRangeTotal,
  request,
  select,
  count,
  rpc,
  SupabaseError,
}
