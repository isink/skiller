// 直接调用 Supabase 的 PostgREST 接口（小程序里跑不了 supabase-js）。
// 只做读取：表查询用 GET，只读 RPC 用 POST，请求头只带公开的 anon key。
// 使用前需在小程序后台把 supabaseUrl 的域名加入 request 合法域名。

import { supabaseAnonKey, supabaseUrl } from './config'

export type QueryParam = [string, string | number | null | undefined]

export function buildQuery(params: QueryParam[] = []): string {
  return params
    .filter((p) => p[1] !== undefined && p[1] !== null)
    .map((p) => encodeURIComponent(p[0]) + '=' + encodeURIComponent(String(p[1])))
    .join('&')
}

export function headerValue(header: Record<string, unknown> | undefined, name: string): string | undefined {
  if (!header) return undefined
  const lower = name.toLowerCase()
  const key = Object.keys(header).find((k) => k.toLowerCase() === lower)
  return key === undefined ? undefined : String(header[key])
}

export class SupabaseError extends Error {
  statusCode: number
  code?: string

  constructor(statusCode: number, body: unknown) {
    const b = (body || {}) as { message?: string; msg?: string; code?: string }
    super(b.message || b.msg || (statusCode ? 'HTTP ' + statusCode : 'Network error'))
    this.statusCode = statusCode
    this.code = b.code
  }
}

interface RequestOptions {
  path: string
  method?: 'GET' | 'POST'
  params?: QueryParam[]
  data?: Record<string, unknown>
  headers?: Record<string, string>
}

interface Response {
  data: unknown
  header: Record<string, unknown>
}

export function request({ path, method = 'GET', params, data, headers }: RequestOptions): Promise<Response> {
  const qs = buildQuery(params)
  const url = supabaseUrl + path + (qs ? '?' + qs : '')
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      timeout: 15000,
      header: Object.assign({
        apikey: supabaseAnonKey,
        Authorization: 'Bearer ' + supabaseAnonKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }, headers),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ data: res.data, header: (res.header || {}) as Record<string, unknown> })
        } else {
          reject(new SupabaseError(res.statusCode, res.data))
        }
      },
      fail(err) {
        // 断网、超时、域名未配置都会走到这里
        reject(new SupabaseError(0, { message: (err && err.errMsg) || 'request:fail' }))
      },
    })
  })
}

/** GET /rest/v1/<table>，返回行数组。 */
export function select<T>(table: string, params?: QueryParam[]): Promise<T[]> {
  return request({ path: '/rest/v1/' + table, params }).then((res) => (res.data as T[]) || [])
}

export function parseContentRangeTotal(range: string | undefined): number {
  if (!range) return 0
  const total = Number(String(range).split('/')[1])
  return Number.isFinite(total) ? total : 0
}

/** 精确计数：读取 Content-Range 头里“/”后面的总数。 */
export function count(table: string, params: QueryParam[] = []): Promise<number> {
  return request({
    path: '/rest/v1/' + table,
    params: ([['select', 'id'], ['limit', 1]] as QueryParam[]).concat(params),
    headers: { Prefer: 'count=exact' },
  }).then((res) => parseContentRangeTotal(headerValue(res.header, 'Content-Range')))
}

/** 只读 RPC：POST /rest/v1/rpc/<fn>。 */
export function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return request({ path: '/rest/v1/rpc/' + fn, method: 'POST', data: args })
    .then((res) => res.data as T)
}
