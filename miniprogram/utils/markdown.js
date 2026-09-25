// 把 SKILL.md 转成 <rich-text> 可渲染的 HTML 字符串。
// rich-text 不支持外部样式表，也不能点击跳转链接，所以样式全部内联，
// 链接只保留文字。原文中的 HTML 一律转义显示，不直接透传。

const C = {
  text: '#9A9AA8',
  primary: '#F5F5F7',
  subtle: '#6B6B78',
  brand: '#D97757',
  elevated: '#14141B',
  border: '#2A2A36',
}
const MONO = 'Menlo,Monaco,Consolas,monospace'

const S = {
  p: `margin:0 0 12px;color:${C.text};font-size:16px;line-height:1.6;word-break:break-word;`,
  h: [
    `margin:16px 0 6px;color:${C.primary};font-size:24px;font-weight:700;line-height:1.3;`,
    `margin:14px 0 6px;color:${C.primary};font-size:20px;font-weight:600;line-height:1.35;`,
    `margin:10px 0 6px;color:${C.primary};font-size:17px;font-weight:600;line-height:1.4;`,
    `margin:10px 0 6px;color:${C.primary};font-size:16px;font-weight:600;line-height:1.4;`,
  ],
  li: `margin:0 0 6px;color:${C.text};font-size:16px;line-height:1.6;word-break:break-word;`,
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

function escapeHTML(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(src) {
  const codes = []
  let s = src.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _t, code) => {
    codes.push(code.trim())
    return '\u0000' + (codes.length - 1) + '\u0000'
  })
  s = escapeHTML(s)
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => `<span style="${S.img}">[${alt || 'image'}]</span>`)
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, `<span style="${S.link}">$1</span>`)
  s = s.replace(/&lt;(https?:\/\/[^\s&]+(?:&amp;[^\s&]+)*)&gt;/g, `<span style="${S.link}">$1</span>`)
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?![\w])/g, '$1<strong>$2</strong>')
  s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?![*\w])/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?![\w])/g, '$1<em>$2</em>')
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code style="${S.code}">${escapeHTML(codes[+i])}</code>`)
  return s
}

function codeBlock(lines) {
  const body = lines
    .map((l) => escapeHTML(l.replace(/\t/g, '    ')).replace(/ /g, '&nbsp;'))
    .join('<br/>')
  return `<div style="${S.pre}">${body || '&nbsp;'}</div>`
}

const RE = {
  fence: /^ {0,3}(`{3,}|~{3,})/,
  heading: /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/,
  hr: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
  quote: /^ {0,3}> ?/,
  listItem: /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/,
  tableSep: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
  blank: /^\s*$/,
}

function splitRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  // 不用正则后行断言：iOS 16.4 以下的 JavaScriptCore 不支持，会导致整个模块解析失败。
  const cells = []
  let cur = ''
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '\\' && s[k + 1] === '|') { cur += '|'; k++ }
    else if (s[k] === '|') { cells.push(cur.trim()); cur = '' }
    else cur += s[k]
  }
  cells.push(cur.trim())
  return cells
}

function isTableStart(lines, i) {
  return lines[i].indexOf('|') >= 0 && i + 1 < lines.length && RE.tableSep.test(lines[i + 1]) &&
    lines[i + 1].indexOf('-') >= 0
}

function startsBlock(lines, i) {
  const l = lines[i]
  return RE.fence.test(l) || RE.heading.test(l) || RE.hr.test(l) || RE.quote.test(l) ||
    RE.listItem.test(l) || isTableStart(lines, i)
}

function renderBlocks(lines) {
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    let m

    if (RE.blank.test(line)) { i++; continue }

    if ((m = RE.fence.exec(line))) {
      const marker = m[1]
      const close = new RegExp('^ {0,3}' + (marker[0] === '`' ? '`' : '~') + '{' + marker.length + ',}\\s*$')
      const buf = []
      i++
      while (i < lines.length && !close.test(lines[i])) buf.push(lines[i++])
      i++
      out.push(codeBlock(buf))
      continue
    }

    if ((m = RE.heading.exec(line))) {
      const level = Math.min(m[1].length, 4)
      out.push(`<div style="${S.h[level - 1]}">${inline(m[2])}</div>`)
      i++
      continue
    }

    if (RE.hr.test(line)) {
      out.push(`<hr style="${S.hr}"/>`)
      i++
      continue
    }

    if (RE.quote.test(line)) {
      const buf = []
      while (i < lines.length && !RE.blank.test(lines[i]) && (RE.quote.test(lines[i]) || !startsBlock(lines, i))) {
        buf.push(lines[i].replace(RE.quote, ''))
        i++
      }
      out.push(`<div style="${S.quote}">${renderBlocks(buf)}</div>`)
      continue
    }

    if (RE.listItem.test(line)) {
      const items = []
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
      const base = Math.min.apply(null, items.map((it) => it.indent))
      items.forEach((it) => {
        const level = Math.min(Math.floor((it.indent - base) / 2), 4)
        const bullet = /\d/.test(it.marker) ? it.marker.replace(')', '.') : '•'
        const task = /^\[([ xX])\]\s+/.exec(it.text)
        const text = task ? (task[1] === ' ' ? '☐ ' : '☑ ') + it.text.slice(task[0].length) : it.text
        const pad = 20 + level * 18
        out.push(`<div style="${S.li}padding-left:${pad}px;text-indent:-20px;">` +
          `<span style="display:inline-block;width:20px;text-indent:0;color:${C.subtle};">${bullet}</span>` +
          `${inline(text)}</div>`)
      })
      continue
    }

    if (isTableStart(lines, i)) {
      const head = splitRow(lines[i])
      i += 2
      const rows = []
      while (i < lines.length && !RE.blank.test(lines[i]) && lines[i].indexOf('|') >= 0) {
        rows.push(splitRow(lines[i]))
        i++
      }
      const th = head.map((c) => `<th style="${S.th}">${inline(c)}</th>`).join('')
      const tb = rows.map((r) => '<tr>' + head.map((_, k) =>
        `<td style="${S.td}">${inline(r[k] || '')}</td>`).join('') + '</tr>').join('')
      out.push(`<table style="${S.table}"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`)
      continue
    }

    const para = []
    while (i < lines.length && !RE.blank.test(lines[i]) && (para.length === 0 || !startsBlock(lines, i))) {
      para.push(lines[i].trim())
      i++
    }
    out.push(`<div style="${S.p}">${inline(para.join(' '))}</div>`)
  }
  return out.join('')
}

function toHTML(md) {
  const src = String(md || '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
  return renderBlocks(src.split('\n'))
}

module.exports = { toHTML, inline, escapeHTML }
