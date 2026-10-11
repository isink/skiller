# 头山 AI 工具箱 配色方案

四套可选配色，只覆盖 `app.wxss` 里 `page` 下的**颜色**令牌；间距、圆角、字号、点击区域令牌（8pt 栅格）四套共用。每套都只有**一个**强调色，`success` 仅用于雷达“已命中”状态。

> **应用当前使用「亮色纸感」**（`paper-light`）：`app.wxss` 的颜色令牌、`assets/icons` 图标和 `app.json` 的 window 配置都已切换到该方案。其余三套保留为备选，来源均为 `scripts/miniprogram-themes.mjs`。

## 预览

备选方案预览图由 `node scripts/preview-miniprogram.mjs --out <dir>` 生成（375px 宽，Chrome 近似渲染，**不是微信渲染引擎**）：每套主题的 `<id>-landing.png`、`<id>-home.png`、`<id>-radar.png`，以及 `comparison.png`（四套并排的首页 + 雷达）。已应用方案的实际页面预览用 `node scripts/preview-miniprogram.mjs --applied --out <dir>` 生成，直接读取 `app.wxss` 与 `assets/icons`，不套用主题覆盖。

## 方案概览

| 方案 | id | 类型 | 气质 |
| --- | --- | --- | --- |
| 1 墨夜蓝 | `ink-blue` | 深色 | 冷调墨蓝黑，淡蓝强调色，克制、偏工具感。 |
| 2 暖石 | `warm-stone` | 深色 | 暖调深色。炭褐底色配赭橙（陶土/琥珀）强调色，成功色用橄榄绿以便和强调色区分。 |
| 3 亮色纸感（当前） | `paper-light` | 亮色 | 亮色纸感。米白纸面 + 墨色文字 + 朱砂红强调色；卡片比页面底色更亮，靠细边框和轻微层次区分。 |
| 4 山青 | `mountain-teal` | 深色 | 山青。取“头山”之意，深松青底色配玉青强调色；成功色偏黄绿，避免与强调色混淆。 |

## 令牌

| 令牌 | 墨夜蓝 | 暖石 | 亮色纸感 | 山青 |
| --- | --- | --- | --- | --- |
| `--color-bg` | `#0c0e12` | `#110f0d` | `#f5f2ea` | `#091110` |
| `--color-surface` | `#14171d` | `#1a1714` | `#fffdf8` | `#101b1a` |
| `--color-surface-2` | `#1b1f27` | `#241f1b` | `#eeeadf` | `#162625` |
| `--color-surface-pressed` | `#202531` | `#2c2621` | `#e6e1d3` | `#1c3130` |
| `--color-surface-glass` | `rgba(20, 23, 29, 0.96)` | `rgba(26, 23, 20, 0.96)` | `rgba(255, 253, 248, 0.96)` | `rgba(16, 27, 26, 0.96)` |
| `--color-border` | `#242a35` | `#2f2923` | `#e3ddcf` | `#1e3331` |
| `--color-border-strong` | `#313947` | `#40372f` | `#cdc5b3` | `#2c4845` |
| `--color-text` | `#f2f4f8` | `#f6f1ea` | `#1c1a16` | `#ecf4f2` |
| `--color-text-2` | `#aab3c1` | `#bcb2a6` | `#4f4a43` | `#a6bcb8` |
| `--color-text-3` | `#7f899a` | `#968b7e` | `#6b6459` | `#7a948f` |
| `--color-accent` | `#7c9bff` | `#e8884a` | `#b4402a` | `#4fd1b2` |
| `--color-accent-soft` | `rgba(124, 155, 255, 0.14)` | `rgba(232, 136, 74, 0.15)` | `rgba(180, 64, 42, 0.10)` | `rgba(79, 209, 178, 0.14)` |
| `--color-accent-line` | `rgba(124, 155, 255, 0.4)` | `rgba(232, 136, 74, 0.42)` | `rgba(180, 64, 42, 0.38)` | `rgba(79, 209, 178, 0.4)` |
| `--color-on-accent` | `#0c0e12` | `#1c0f06` | `#fffdf8` | `#04201a` |
| `--color-success` | `#4fc38a` | `#9bc46b` | `#2c7a4b` | `#b4d86a` |
| `--color-success-soft` | `rgba(79, 195, 138, 0.14)` | `rgba(155, 196, 107, 0.15)` | `rgba(44, 122, 75, 0.12)` | `rgba(180, 216, 106, 0.14)` |
| `--color-overlay` | `rgba(5, 7, 10, 0.72)` | `rgba(8, 6, 4, 0.74)` | `rgba(28, 26, 22, 0.42)` | `rgba(3, 8, 7, 0.74)` |

## 对比度（WCAG）

由 `node scripts/miniprogram-themes.mjs` 计算，全部达标（正文 ≥ 7:1，其余文字与强调色 ≥ 4.5:1）。

| 检查项 | 墨夜蓝 | 暖石 | 亮色纸感 | 山青 |
| --- | --- | --- | --- | --- |
| 正文 on 背景（≥ 7） | 17.54 | 17.02 | 15.53 | 17.09 |
| 正文 on 卡片（≥ 7） | 16.30 | 15.88 | 17.09 | 15.74 |
| 次要文字 on 卡片（≥ 4.5） | 8.48 | 8.55 | 8.63 | 8.80 |
| 辅助文字 on 卡片（≥ 4.5） | 5.08 | 5.35 | 5.75 | 5.41 |
| 辅助文字 on 背景（≥ 4.5） | 5.47 | 5.73 | 5.23 | 5.88 |
| 辅助文字 on 次级表面（≥ 4.5） | 4.68 | 4.89 | 4.86 | 4.83 |
| 强调色 on 卡片（≥ 4.5） | 6.83 | 6.84 | 5.57 | 9.29 |
| 强调色 on 背景（≥ 4.5） | 7.35 | 7.33 | 5.06 | 10.09 |
| 按钮文字 on 强调色（≥ 4.5） | 7.35 | 7.19 | 5.57 | 9.05 |
| 成功色 on 卡片（≥ 4.5） | 8.12 | 8.93 | 5.17 | 10.87 |

## 如何切换到某个方案（亮色纸感已按此步骤应用）

1. 在 `app.wxss` 的 `page { … }` 里，用 `scripts/miniprogram-themes.mjs` 中该主题的颜色令牌替换同名变量（变量名不变，页面和组件无需改动）。
2. 重新生成图标（图标是预先烘焙颜色的 PNG，不能随 CSS 变量变色）：`node scripts/render-miniprogram-icons.mjs --theme <id>`（脚本默认主题为 `paper-light`）。
3. 在 `app.json` 的 `window` 里把 `navigationBarBackgroundColor` / `backgroundColor` 改成该主题的 `--color-bg`。
4. 亮色方案需要：`navigationBarTextStyle` 为 `"black"`，`backgroundTextStyle` 为 `"dark"`；切回深色方案时改回 `"white"` / `"light"`。
5. 代码里不要再写死颜色：样式只用 `var(--…)`（已检查 wxss/json/ts，无遗留的深色硬编码；雷达状态色由 WXML 的 class 控制）。

## 已知限制

- 小程序没有运行时切换 CSS 变量的内置机制；若要做成用户可选的主题，需要在页面根节点按主题 id 加 class，把四套令牌写成 `.theme-<id>`，并按主题切换图标路径。本次只做设计与预览，未实现切换。
- 导航栏颜色来自 `app.json`（或页面 json），不受 CSS 变量影响，切换主题时需同步修改。
- 所有预览均未在微信开发者工具或真机里验证。
