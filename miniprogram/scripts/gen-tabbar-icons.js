#!/usr/bin/env node
// 生成 tabBar 图标（81×81 PNG，普通态与选中态各一张）。
// 小程序 tabBar 只接受本地位图，这里用纯 Node 画几何图形并编码为 PNG，
// 不依赖任何图像库。运行：node scripts/gen-tabbar-icons.js

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 81
const SS = 4 // 每像素 4×4 超采样抗锯齿
const COLORS = { normal: [0x6b, 0x6b, 0x78], active: [0xd9, 0x77, 0x57] }

// 所有图形在 [-1, 1] 坐标系里定义，y 轴向下。
function roundedRect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.max(Math.abs(x - cx) - (hw - r), 0)
  const dy = Math.max(Math.abs(y - cy) - (hh - r), 0)
  return dx * dx + dy * dy <= r * r
}

const shapes = {
  home(x, y) {
    // 屋顶三角形 + 屋身，屋身中间挖出门洞
    const roof = y >= -0.78 && y <= -0.05 && Math.abs(x) <= (y + 0.78) * 1.15
    const body = roundedRect(x, y, 0, 0.36, 0.6, 0.46, 0.08)
    const door = roundedRect(x, y, 0, 0.52, 0.16, 0.32, 0.05)
    return (roof || body) && !door
  },
  category(x, y) {
    const r = 0.36
    return [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]
      .some(([cx, cy]) => roundedRect(x, y, cx, cy, r, r, 0.1))
  },
  favorites(x, y) {
    // 心形隐式方程 (x²+y²-1)³ - x²y³ ≤ 0，缩放并上下翻转
    const X = x * 1.25
    const Y = -(y * 1.25) + 0.15
    const a = X * X + Y * Y - 1
    return a * a * a - X * X * Y * Y * Y <= 0
  },
}

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  }))
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function render(shape, [r, g, b]) {
  const pad = 14 // 图标四周留白，和系统 tabBar 图标视觉大小接近
  const inner = SIZE - pad * 2
  const buf = Buffer.alloc(SIZE * SIZE * 4)
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let hits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px - pad + (sx + 0.5) / SS) / inner) * 2 - 1
          const y = ((py - pad + (sy + 0.5) / SS) / inner) * 2 - 1
          if (shape(x, y)) hits++
        }
      }
      const i = (py * SIZE + px) * 4
      buf[i] = r
      buf[i + 1] = g
      buf[i + 2] = b
      buf[i + 3] = Math.round((hits / (SS * SS)) * 255)
    }
  }
  return encodePNG(SIZE, SIZE, buf)
}

const outDir = path.join(__dirname, '..', 'images', 'tabbar')
fs.mkdirSync(outDir, { recursive: true })
for (const [name, shape] of Object.entries(shapes)) {
  fs.writeFileSync(path.join(outDir, `${name}.png`), render(shape, COLORS.normal))
  fs.writeFileSync(path.join(outDir, `${name}-active.png`), render(shape, COLORS.active))
}
console.log('tabBar icons written to', path.relative(process.cwd(), outDir))
