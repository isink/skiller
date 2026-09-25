# Skiller 微信小程序

iOS 版 Skiller 的微信小程序移植。数据同样来自 Supabase，界面沿用深色主题，支持简体中文与 English（跟随微信语言）。

## 功能对照

| 功能 | iOS | 小程序 |
| --- | --- | --- |
| 首页统计、最新收录、中英文搜索 | ✓ | ✓ |
| 探索：按仓库 / 按分类浏览、分页 | ✓ | ✓ |
| 最新一批收录，按分类筛选 | ✓ | ✓ |
| 详情：SKILL.md 渲染、复制全文、复制来源链接 | ✓ | ✓ |
| 收藏 | 本机 + 登录后跨设备同步 | 仅本机 |
| 我的足迹（收藏数、浏览数、最常看分类） | ✓ | ✓，可清除浏览记录 |
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

单元测试与图标生成只需要 Node 18+，无第三方依赖：

```bash
cd miniprogram
npm test          # 数据层、格式化、Markdown 渲染、本地存储、页面结构检查
npm run icons     # 重新生成 images/tabbar 下的 tabBar 图标
```

`tests/`、`scripts/`、`package.json` 已在 `project.config.json` 的 `packOptions.ignore` 中排除，不会打进小程序包。

## 目录结构

```
app.js / app.json / app.wxss   入口、页面与 tabBar 配置、全局主题
pages/
  home/        首页：统计、最新收录、搜索
  explore/     探索：分类、仓库 / 技能列表、分页
  latest/      最新一批收录
  detail/      技能详情与 SKILL.md
  favorites/   本机收藏
  profile/     我的：足迹、资源链接、隐私条款
components/    skill-card、hot-skill-card、repo-group-card、category-chip、pagination 等
utils/
  config.js    Supabase 地址与公开 anon key、合规链接
  supabase.js  基于 wx.request 的 PostgREST 客户端
  api.js       与 iOS SkillsAPI 对应的查询
  cache.js     内存 stale-while-revalidate 缓存
  markdown.js  SKILL.md → rich-text HTML
  favorites.js / recents.js  本机收藏与浏览记录
  i18n.js / format.js / skill.js
```
