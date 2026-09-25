// 静态检查：页面/组件文件齐全、组件引用存在、WXML 里绑定的事件处理函数都已定义，
// 并禁止 iOS 旧版 JavaScriptCore 不支持的正则后行断言。
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))

const componentPaths = Object.values(app.usingComponents).map((p) => p.replace(/^\//, ''))
const units = app.pages.concat(componentPaths)

test('every page and component has js/json/wxml/wxss', () => {
  for (const unit of units) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      assert.ok(exists(`${unit}.${ext}`), `missing ${unit}.${ext}`)
    }
  }
})

test('tabBar pages and icons exist', () => {
  for (const item of app.tabBar.list) {
    assert.ok(app.pages.includes(item.pagePath), item.pagePath)
    assert.ok(exists(item.iconPath), item.iconPath)
    assert.ok(exists(item.selectedIconPath), item.selectedIconPath)
  }
})

test('component references resolve', () => {
  for (const unit of units) {
    const json = JSON.parse(read(`${unit}.json`))
    for (const p of Object.values(json.usingComponents || {})) {
      assert.ok(exists(p.replace(/^\//, '') + '.js'), `${unit} -> ${p}`)
    }
  }
})

test('WXML event handlers are defined', () => {
  for (const unit of units) {
    const wxml = read(`${unit}.wxml`)
    const js = read(`${unit}.js`)
    const handlers = [...wxml.matchAll(/\b(?:bind|catch)(?::)?\w+="(\w+)"/g)].map((m) => m[1])
    for (const h of handlers) {
      assert.match(js, new RegExp(`\\b${h}\\s*\\(`), `${unit}: handler ${h} not defined`)
    }
  }
})

test('WXML tags are balanced', () => {
  for (const unit of units) {
    const wxml = read(`${unit}.wxml`).replace(/<!--[\s\S]*?-->/g, '').replace(/\{\{[\s\S]*?\}\}/g, '')
    const stack = []
    for (const m of wxml.matchAll(/<(\/?)([a-z-]+)[^>]*?(\/?)>/g)) {
      const [, closing, tag, selfClosing] = m
      if (selfClosing) continue
      if (closing) assert.strictEqual(stack.pop(), tag, `${unit}: unexpected </${tag}>`)
      else stack.push(tag)
    }
    assert.deepStrictEqual(stack, [], `${unit}: unclosed ${stack.join(', ')}`)
  }
})

test('no regex lookbehind in shipped JS', () => {
  const files = []
  const walk = (dir) => {
    for (const name of fs.readdirSync(path.join(root, dir))) {
      const rel = path.join(dir, name)
      if (['tests', 'scripts', 'node_modules'].includes(name)) continue
      if (fs.statSync(path.join(root, rel)).isDirectory()) walk(rel)
      else if (rel.endsWith('.js')) files.push(rel)
    }
  }
  walk('.')
  for (const f of files) assert.ok(!/\(\?<[=!]/.test(read(f)), `${f} uses lookbehind`)
})
