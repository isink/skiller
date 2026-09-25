require('./helpers')
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { toNodes, parseInline } = require('../.test-build/utils/markdown')
const { stripFrontmatter } = require('../.test-build/utils/skill')

// rich-text 会解码文本节点里的实体，这里模拟它的显示结果
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const plain = (nodes) => nodes.map((n) => (n.type === 'text' ? decode(n.text) : plain(n.children || []))).join('')
const find = (nodes, name, out = []) => {
  nodes.forEach((n) => {
    if (n.name === name) out.push(n)
    if (n.children) find(n.children, name, out)
  })
  return out
}
const allNames = (nodes, out = new Set()) => {
  nodes.forEach((n) => { if (n.name) out.add(n.name); if (n.children) allNames(n.children, out) })
  return out
}

const fixture = stripFrontmatter(fs.readFileSync(path.join(__dirname, 'fixtures/sample-skill.md'), 'utf8'))
const nodes = toNodes(fixture)
const shown = plain(nodes)

test('fixture: only whitelisted element names are produced', () => {
  const allowed = new Set(['div', 'span', 'strong', 'em', 'del', 'code', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'])
  for (const name of allNames(nodes)) assert.ok(allowed.has(name), 'unexpected element ' + name)
  // 除 style 外不输出任何属性（没有 src、onerror、href）
  const walk = (ns) => ns.forEach((n) => {
    if (n.attrs) assert.deepStrictEqual(Object.keys(n.attrs), ['style'])
    if (n.children) walk(n.children)
  })
  walk(nodes)
})

test('fixture: raw HTML is shown as text, comments are dropped', () => {
  assert.ok(shown.includes('<script>alert("xss")</script>'))
  assert.ok(shown.includes('<img src="https://example.com/x.png" onerror="alert(1)">'))
  assert.ok(shown.includes('<details><summary>Click</summary>hidden?</details>'))
  assert.ok(!shown.includes('an HTML comment'))
})

test('fixture: special characters survive entity decoding', () => {
  assert.ok(shown.includes(`5 < 6 > 4, "quotes", 'single', &amp; literal, 100% done, a\\b.`))
  assert.ok(shown.includes('& friends'))
})

test('fixture: frontmatter is stripped and headings rendered', () => {
  assert.ok(!shown.includes('sample-skill.md'))
  assert.ok(!shown.includes('description: Fixture'))
  assert.match(nodes[0].attrs.style, /font-size:24px/)
  assert.strictEqual(plain([nodes[0]]), 'Sample Skill')
})

test('fixture: code block keeps indentation and content verbatim', () => {
  const pre = nodes.find((n) => n.attrs && /Menlo/.test(n.attrs.style) && n.name === 'div')
  const code = pre.children.filter((n) => n.type === 'text').map((n) => decode(n.text).replace(/ /g, ' '))
  assert.deepStrictEqual(code, ['pip install pdfplumber', 'python -c "print(\'<ok>\')"', '    indented_with_tab()'])
  assert.strictEqual(find([pre], 'br').length, 2)
})

test('fixture: lists, tasks, quote, table, rule and inline marks', () => {
  assert.ok(shown.includes('1.Install the package'))
  assert.ok(shown.includes('•Supports inline <code> spans'))
  assert.ok(shown.includes('•child item with a link'))
  assert.ok(shown.includes('☑ finished task'))
  assert.ok(shown.includes('☐ open task'))
  assert.ok(shown.includes('Note: keep originals. Second line.'))
  assert.deepStrictEqual(find(nodes, 'th').map((n) => plain([n])), ['Tool', 'Purpose'])
  assert.deepStrictEqual(find(nodes, 'td').map((n) => plain([n])), ['pdfplumber', 'text | tables', 'pypdf', 'merge'])
  assert.strictEqual(find(nodes, 'hr').length, 1)
  assert.deepStrictEqual(find(nodes, 'del').map((n) => plain([n])), ['deprecated'])
  assert.ok(find(nodes, 'strong').map((n) => plain([n])).includes('strong'))
  assert.ok(find(nodes, 'em').map((n) => plain([n])).includes('em'))
  assert.ok(shown.includes('[diagram]'))
  assert.ok(shown.includes('https://example.com/auto?a=1&b=2'))
  assert.ok(shown.includes('snake_case_word'))
  // 链接地址不输出，只保留文字
  assert.ok(!shown.includes('github.com/anthropics/skills'))
})

test('inline code is not parsed further', () => {
  const out = parseInline('a `**b** <c>` d')
  assert.strictEqual(out[1].name, 'code')
  assert.strictEqual(plain(out[1].children), '**b** <c>')
  assert.strictEqual(find(out, 'strong').length, 0)
})

test('nested emphasis inside links and bold', () => {
  const out = parseInline('**bold _and em_** [x *y*](u)')
  const strong = find(out, 'strong')[0]
  assert.strictEqual(find([strong], 'em').length, 1)
  assert.strictEqual(plain(out), 'bold and em x y')
})

test('soft line breaks join paragraph lines with spaces', () => {
  assert.strictEqual(plain(toNodes('line one\nline two')), 'line one line two')
})

test('unterminated fence swallows the rest as code', () => {
  assert.strictEqual(plain(toNodes('```\ncode')), 'code')
})

test('nested list indentation', () => {
  const out = toNodes('- a\n  - b\n    - c')
  assert.deepStrictEqual(out.map((n) => /padding-left:(\d+)px/.exec(n.attrs.style)[1]), ['20', '38', '56'])
})

test('stripFrontmatter removes the YAML header only', () => {
  assert.strictEqual(stripFrontmatter('---\nname: x\ndescription: y\n---\n\n# Body'), '# Body')
  assert.strictEqual(stripFrontmatter('# No frontmatter\n---'), '# No frontmatter\n---')
  assert.strictEqual(stripFrontmatter(''), '')
  assert.strictEqual(stripFrontmatter(null), '')
})

test('empty input renders nothing', () => {
  assert.deepStrictEqual(toNodes(''), [])
  assert.deepStrictEqual(toNodes(null), [])
})
