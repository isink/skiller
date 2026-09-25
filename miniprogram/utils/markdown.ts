// 把 SKILL.md 转成 <rich-text> 的节点数组（不是 HTML 字符串）。
// - 原文中的 HTML 一律当作文字显示，不会被解析成标签；
// - rich-text 不支持外部样式表，样式全部内联；
// - rich-text 里的链接不能点击，链接只保留文字，图片显示为 [alt]。

export interface TextNode {
  type: 'text'
  text: string
}

export interface ElementNode {
  name: string
  attrs?: { style?: string }
  children?: RichNode[]
}

export type RichNode = TextNode | ElementNode

const C = {
  text: '#9A9AA8',
  primary: '#F5F5F7',
  subtle: '#6B6B78',
  brand: '#D97757',
  elevated: '#14141B',
  border: '#2A2A36',
}
const MONO = 'Menlo,Monaco,Consolas,monospace'

export const STYLES = {
  p: `margin:0 0 12px;color:${C.text};font-size:16px;line-height:1.6;word-break:break-word;`,
  h: [
    `margin:16px 0 6px;color:${C.primary};font-size:24px;font-weight:700;line-height:1.3;`,
    `margin:14px 0 6px;color:${C.primary};font-size:20px;font-weight:600;line-height:1.35;`,
    `margin:10px 0 6px;color:${C.primary};font-size:17px;font-weight:600;line-height:1.4;`,
    `margin:10px 0 6px;color:${C.primary};font-size:16px;font-weight:600;line-height:1.4;`,
  ],
  li: `margin:0 0 6px;color:${C.text};font-size:16px;line-height:1.6;word-break:break-word;text-indent:-20px;`,
  bullet: `display:inline-block;width:20px;text-indent:0;color:${C.subtle};`,
  code: `font-family:${MONO};font-size:0.92em;color:${C.brand};background:${C.elevated};padding:0 4px;border-radius:4px;`,
  pre: `margin:0 0 12px;padding:12px;background:${C.elevated};border-radius:10px;color:${C.primary};font-family:${MONO};font-size:13px;line-height:1.5;word-break:break-all;`,
  quote: `margin:0 0 12px;padding-left:12px;border-left:3px solid ${C.border};`,
  hr: `margin:16px 0;border:none;border-top:1px solid ${C.border};height:0;`,
  table: `width:100%;margin:0 0 12px;border-collapse:collapse;font-size:14px;color:${C.text};`,
  th: `border:1px solid ${C.border};padding:6px 8px;color:${C.primary};font-weight:600;text-align:left;`,
  td: `border:1px solid ${C.border};padding:6px 8px;text-align:left;word-break:break-word;`,
  link: `color:${C.brand};`,
  img: `color:${C.subtle};`,
}

/** rich-text 的文本节点会解码 HTML 实体，所以把 & < > 转义，保证原样显示。 */
function text(s: string): TextNode {
  return { type: 'text', text: s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
}

function el(name: string, style: string | null, children: RichNode[] = []): ElementNode {
  const node: ElementNode = { name, children }
  if (style) node.attrs = { style }
  return node
}

// ---------- 行内 ----------

interface InlineRule {
  re: RegExp
  /** 匹配开头有多少字符是前导上下文（不属于这个标记） */
  lead?: (m: RegExpExecArray) => number
  build: (m: RegExpExecArray) => RichNode
}

const INLINE_RULES: InlineRule[] = [
  // 行内代码优先级最高，里面不再解析其他标记
  { re: /(`+)([\s\S]*?[^`])\1(?!`)/, build: (m) => el('code', STYLES.code, [text(m[2].trim())]) },
  { re: /!\[([^\]]*)\]\([^)]*\)/, build: (m) => el('span', STYLES.img, [text('[' + (m[1] || 'image') + ']')]) },
  { re: /\[([^\]]+)\]\([^)]*\)/, build: (m) => el('span', STYLES.link, parseInline(m[1])) },
  { re: /<(https?:\/\/[^\s>]+)>/, build: (m) => el('span', STYLES.link, [text(m[1])]) },
  { re: /\*\*(?=\S)([\s\S]*?\S)\*\*/, build: (m) => el('strong', null, parseInline(m[1])) },
  {
    re: /(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/,
    lead: (m) => m[1].length,
    build: (m) => el('strong', null, parseInline(m[2])),
  },
  { re: /~~(?=\S)([\s\S]*?\S)~~/, build: (m) => el('del', null, parseInline(m[1])) },
  {
    re: /(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?![*\w])/,
    lead: (m) => m[1].length,
    build: (m) => el('em', null, parseInline(m[2])),
  },
  {
    re: /(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?!\w)/,
    lead: (m) => m[1].length,
    build: (m) => el('em', null, parseInline(m[2])),
  },
]

/** 每次取最靠前的一个标记（同位置按规则顺序），前面的部分作为纯文本。 */
export function parseInline(src: string): RichNode[] {
  const out: RichNode[] = []
  let rest = src
  while (rest) {
    let best: { start: number; end: number; node: RichNode } | null = null
    for (const rule of INLINE_RULES) {
      const m = rule.re.exec(rest)
      if (!m) continue
      const start = m.index + (rule.lead ? rule.lead(m) : 0)
      if (!best || start < best.start) {
        best = { start, end: m.index + m[0].length, node: rule.build(m) }
      }
    }
    if (!best) {
      out.push(text(rest))
      break
    }
    if (best.start > 0) out.push(text(rest.slice(0, best.start)))
    out.push(best.node)
    rest = rest.slice(best.end)
  }
  return out
}

// ---------- 块级 ----------

const RE = {
  fence: /^ {0,3}(`{3,}|~{3,})/,
  heading: /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/,
  hr: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
  quote: /^ {0,3}> ?/,
  listItem: /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/,
  tableSep: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
  blank: /^\s*$/,
}

function codeBlock(lines: string[]): ElementNode {
  const children: RichNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) children.push(el('br', null))
    // 用不换行空格保留缩进；rich-text 会折叠普通空格
    children.push(text(line.replace(/\t/g, '    ').replace(/ /g, ' ')))
  })
  if (!children.length) children.push(text(' '))
  return el('div', STYLES.pre, children)
}

// 不用正则后行断言：iOS 16.4 以下的 JavaScriptCore 不支持，会导致整个模块解析失败。
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '\\' && s[k + 1] === '|') { cur += '|'; k++ } else if (s[k] === '|') { cells.push(cur.trim()); cur = '' } else cur += s[k]
  }
  cells.push(cur.trim())
  return cells
}

function isTableStart(lines: string[], i: number): boolean {
  return lines[i].indexOf('|') >= 0 && i + 1 < lines.length &&
    RE.tableSep.test(lines[i + 1]) && lines[i + 1].indexOf('-') >= 0
}

function startsBlock(lines: string[], i: number): boolean {
  const l = lines[i]
  return RE.fence.test(l) || RE.heading.test(l) || RE.hr.test(l) || RE.quote.test(l) ||
    RE.listItem.test(l) || isTableStart(lines, i)
}

interface ListItem {
  indent: number
  marker: string
  text: string
}

function renderBlocks(lines: string[]): RichNode[] {
  const out: RichNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    let m: RegExpExecArray | null

    if (RE.blank.test(line)) { i++; continue }

    if ((m = RE.fence.exec(line))) {
      const marker = m[1]
      const close = new RegExp('^ {0,3}' + (marker[0] === '`' ? '`' : '~') + '{' + marker.length + ',}\\s*$')
      const buf: string[] = []
      i++
      while (i < lines.length && !close.test(lines[i])) buf.push(lines[i++])
      i++
      out.push(codeBlock(buf))
      continue
    }

    if ((m = RE.heading.exec(line))) {
      const level = Math.min(m[1].length, 4)
      out.push(el('div', STYLES.h[level - 1], parseInline(m[2])))
      i++
      continue
    }

    if (RE.hr.test(line)) {
      out.push(el('hr', STYLES.hr))
      i++
      continue
    }

    if (RE.quote.test(line)) {
      const buf: string[] = []
      while (i < lines.length && !RE.blank.test(lines[i]) && (RE.quote.test(lines[i]) || !startsBlock(lines, i))) {
        buf.push(lines[i].replace(RE.quote, ''))
        i++
      }
      out.push(el('div', STYLES.quote, renderBlocks(buf)))
      continue
    }

    if (RE.listItem.test(line)) {
      const items: ListItem[] = []
      while (i < lines.length) {
        const cur = lines[i]
        const li = RE.listItem.exec(cur)
        if (li) {
          items.push({ indent: li[1].replace(/\t/g, '    ').length, marker: li[2], text: li[3] })
          i++
        } else if (RE.blank.test(cur)) {
          if (i + 1 < lines.length && RE.listItem.test(lines[i + 1])) { i++; continue }
          break
        } else if (items.length && !startsBlock(lines, i)) {
          items[items.length - 1].text += ' ' + cur.trim()
          i++
        } else {
          break
        }
      }
      const base = Math.min(...items.map((it) => it.indent))
      items.forEach((it) => {
        const level = Math.min(Math.floor((it.indent - base) / 2), 4)
        const bullet = /\d/.test(it.marker) ? it.marker.replace(')', '.') : '•'
        const task = /^\[([ xX])\]\s+/.exec(it.text)
        const body = task ? (task[1] === ' ' ? '☐ ' : '☑ ') + it.text.slice(task[0].length) : it.text
        const pad = 20 + level * 18
        out.push(el('div', STYLES.li + `padding-left:${pad}px;`, [
          el('span', STYLES.bullet, [text(bullet)]),
          ...parseInline(body),
        ]))
      })
      continue
    }

    if (isTableStart(lines, i)) {
      const head = splitRow(lines[i])
      i += 2
      const rows: string[][] = []
      while (i < lines.length && !RE.blank.test(lines[i]) && lines[i].indexOf('|') >= 0) {
        rows.push(splitRow(lines[i]))
        i++
      }
      out.push(el('table', STYLES.table, [
        el('thead', null, [el('tr', null, head.map((c) => el('th', STYLES.th, parseInline(c))))]),
        el('tbody', null, rows.map((r) => el('tr', null, head.map((_, k) => el('td', STYLES.td, parseInline(r[k] || '')))))),
      ]))
      continue
    }

    const para: string[] = []
    while (i < lines.length && !RE.blank.test(lines[i]) && (para.length === 0 || !startsBlock(lines, i))) {
      para.push(lines[i].trim())
      i++
    }
    out.push(el('div', STYLES.p, parseInline(para.join(' '))))
  }
  return out
}

export function toNodes(md: string | null | undefined): RichNode[] {
  const src = String(md || '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
  return renderBlocks(src.split('\n'))
}
