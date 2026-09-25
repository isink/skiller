# Skiller 微信小程序

iOS 版 Skiller 的微信小程序移植，使用微信原生 TypeScript + WXML + WXSS。数据同样来自 Supabase（只读，仅用 anon key），界面沿用深色主题；以简体中文为主，微信语言为其他语言时显示英文。

## 功能对照

| 功能 | iOS | 小程序 |
| --- | --- | --- |
| 首页统计、最新收录、中英文搜索 | ✓ | ✓，另有热门技能；搜索可上拉加载更多 |
| 分类：按分类 / 按仓库浏览、分页 | ✓ | ✓ |
| 最新一批收录，按分类筛选 | ✓ | ✓ |
| 详情：分类、标签、SKILL.md 渲染、复制全文、复制来源链接 | ✓ | ✓ |
| 收藏 | 本机 + 登录后跨设备同步 | 仅本机，保存快照，离线可看 |
| 足迹（收藏数、浏览数、最常看分类） | ✓ | ✓，在“关于”页，可清除浏览记录 |
| 离线 | — | 首页与分类显示最近一次成功读取的数据，并提示离线 |
| 分享 | 系统分享来源链接 | 分享给微信好友 / 朋友圈 |
| Apple / GitHub 登录、删除账号、举报 | ✓ | — |
| 广告 | Google Mobile Ads | — |

没有移植的部分及原因：

- **登录与收藏同步**：小程序无法走 Apple / GitHub 的网页 OAuth 回调。要接入需用 `wx.login` 拿 code，再由服务端（例如 Supabase Edge Function）换取 openid 并签发 Supabase 会话，这需要小程序 AppSecret，本次未做。举报接口要求登录，也一并未做。
- **打开外部链接**：个人主体小程序不能用 `web-view` 打开 GitHub 等外部网站，所以来源链接、隐私政策等改为“复制链接”。
- **SKILL.md 中的链接和图片**：`rich-text` 不支持点击跳转，链接只显示文字，图片显示为 `[alt]`。

## 本地开发

1. 用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)导入本目录 `miniprogram/`。
2. 把 `project.config.json` 里的 `appid` 换成自己的小程序 AppID（`touristappid` 只能在开发者工具里预览）。
3. 在小程序后台“开发管理 → 开发设置 → 服务器域名”的 **request 合法域名** 中加入 `https://gphynosbfjcyexhkgctf.supabase.co`。开发阶段也可以在开发者工具里勾选“不校验合法域名”。
4. 在小程序后台“设置 → 服务内容声明 → 用户隐私保护指引”中声明**剪切板**的使用（复制链接与 SKILL.md 用到 `wx.setClipboardData`）。

TypeScript 由开发者工具内置的编译插件处理（`project.config.json` 中的 `useCompilerPlugins: ["typescript"]`），导入即可运行，无需手动编译。

类型检查和单元测试需要 Node 18+：

```bash
cd miniprogram
npm install
npm test          # 类型检查 + 数据层、缓存与离线、Markdown 渲染、本地存储、只读安全检查、页面结构检查
npm run icons     # 重新生成 images/tabbar 下的 tabBar 图标
```

`tests/`、`scripts/`、`node_modules/`、`package.json`、`tsconfig*.json` 已在 `packOptions.ignore` 中排除，不会打进小程序包。

### 验收清单（开发者工具）

- 首页加载、下拉刷新、关键词搜索与加载更多；空搜索、无结果、断网时的搜索失败提示
- 分类切换、技能 / 仓库切换、分页；断网时的重试
- 详情跳转、分类与标签、SKILL.md 渲染、复制全文与链接；不存在的 ID 与断网两种错误提示
- 收藏增删，重启后保留；断网时收藏页仍显示已收藏的技能
- 断网后冷启动：首页显示上次数据并提示离线
- 调试器 Network 面板中所有请求只访问 `skills`、`categories` 两张表和 `get_category_counts`、`get_repo_groups` 两个只读 RPC

## 目录结构

```
app.ts / app.json / app.wxss   入口、页面与 tabBar 配置、全局主题
pages/
  home/        首页：统计、最新收录、热门技能、搜索（tab）
  category/    分类：分类筛选、技能 / 仓库列表、分页（tab）
  favorites/   本机收藏（tab）
  detail/      技能详情与 SKILL.md
  latest/      最新一批收录
  about/       关于：足迹、资源链接、隐私条款、意见反馈
components/    skill-card、hot-skill-card、repo-group-card、category-chip、pagination 等
utils/
  types.ts     技能列表项、技能详情、分类、收藏等内部接口
  config.ts    Supabase 地址与公开 anon key、合规链接
  supabase.ts  基于 wx.request 的只读 PostgREST 客户端
  api.ts       数据适配层，与 iOS SkillsAPI 对应
  cache.ts     stale-while-revalidate 缓存，首页与分类数据持久化用于离线展示
  markdown.ts  SKILL.md → rich-text 节点数组
  favorites.ts / recents.ts  本机收藏（含快照）与浏览记录
  i18n.ts / format.ts / skill.ts / tabbar.ts
```
