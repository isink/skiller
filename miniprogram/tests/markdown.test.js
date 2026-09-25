require('./helpers')
const test = require('node:test')
const assert = require('node:assert')
const { toHTML } = require('../utils/markdown')
const { stripFrontmatter } = require('../utils/skill')

const text = (html) => html.replace(/<[^>]+>/g, '')

test('headings, paragraphs and soft line breaks', () => {
  const html = toHTML('# Title\n\nline one\nline two\n\n## Sub')
  assert.match(html, /font-size:24px[^>]*>Title</)
  assert.match(html, />line one line two</)
  assert.match(html, /font-size:20px[^>]*>Sub</)
})

test('raw HTML in markdown is escaped, not rendered', () => {
  const html = toHTML('<script>alert(1)</script> & <img src=x onerror=y>')
  assert.ok(!/<script|<img/.test(html))
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&amp;/)
})

test('fenced code keeps indentation and is not parsed as markdown', () => {
  const html = toHTML('```js\nif (a) {\n  **b** <c>\n}\n```\nafter')
  assert.match(html, /if&nbsp;\(a\)&nbsp;\{<br\/>&nbsp;&nbsp;\*\*b\*\*&nbsp;&lt;c&gt;<br\/>\}/)
  assert.ok(!html.includes('<strong>'))
  assert.match(html, />after</)
})

test('unterminated fence swallows the rest as code', () => {
  const html = toHTML('```\ncode')
  assert.match(html, />code</)
})

test('inline code, emphasis, links and images', () => {
  const html = toHTML('Use `a*b*c` and **bold**, *em*, _em2_, ~~del~~, [link](https://x.y) ![pic](p.png) snake_case_name')
  assert.match(html, /<code[^>]*>a\*b\*c<\/code>/)
  assert.match(html, /<strong>bold<\/strong>/)
  assert.match(html, /<em>em<\/em>/)
  assert.match(html, /<em>em2<\/em>/)
  assert.match(html, /<del>del<\/del>/)
  assert.match(html, /<span style="color:#D97757;">link<\/span>/)
  assert.match(html, /\[pic\]/)
  assert.match(html, /snake_case_name/)
  assert.ok(!html.includes('https://x.y'))
})

test('lists: bullets, ordered, nesting, tasks and continuation lines', () => {
  const html = toHTML('- one\n  continued\n- two\n  - nested\n\n1. first\n2) second\n- [x] done\n- [ ] todo')
  const t = text(html)
  assert.match(t, /•one continued/)
  assert.match(t, /•two/)
  assert.match(html, /padding-left:38px[^>]*>.*nested/)
  assert.match(t, /1\.first/)
  assert.match(t, /2\.second/)
  assert.match(t, /☑ done/)
  assert.match(t, /☐ todo/)
})

test('tables render header and body cells, including escaped pipes', () => {
  const html = toHTML('| a | b |\n|---|:-:|\n| 1 | x \\| y |\n| 2 |\n\nafter')
  assert.match(html, /<th[^>]*>a<\/th><th[^>]*>b<\/th>/)
  assert.match(html, /<td[^>]*>1<\/td><td[^>]*>x \| y<\/td>/)
  assert.match(html, /<td[^>]*>2<\/td><td[^>]*><\/td>/)
  assert.match(html, />after</)
})

test('blockquotes, rules and HTML comments', () => {
  const html = toHTML('> quoted\n> more\n\n---\n<!-- hidden -->\ntext')
  assert.match(html, /border-left:3px[^>]*><div[^>]*>quoted more</)
  assert.match(html, /<hr /)
  assert.ok(!html.includes('hidden'))
})

test('stripFrontmatter removes the YAML header only', () => {
  assert.strictEqual(stripFrontmatter('---\nname: x\ndescription: y\n---\n\n# Body'), '# Body')
  assert.strictEqual(stripFrontmatter('# No frontmatter\n---'), '# No frontmatter\n---')
  assert.strictEqual(stripFrontmatter(''), '')
  assert.strictEqual(stripFrontmatter(null), '')
})

test('empty input renders nothing', () => {
  assert.strictEqual(toHTML(''), '')
  assert.strictEqual(toHTML(null), '')
})
