# AISkill技能库微信小程序

原生微信小程序工程，与根目录下的 SwiftUI iOS App 共用 Supabase 技能目录。首版提供发现、搜索、分类浏览、详情、复制内容和本地收藏；不需要用户登录。

## 读取方式

`services/api.ts` 使用 `wx.request` 通过 HTTPS 直接读取 Supabase 的 `skills`、`categories` 和 `get_category_counts`。`services/config.ts` 使用与 iOS App 相同的项目 URL 和公开 anon key；公开表和函数的 RLS/权限允许匿名读取。小程序包内不得放入 service-role key 或数据库密码。

CloudBase 云函数和迁移脚本保留为可选后备方案；当前小程序不调用它们，也不需要先复制数据。

## 首页分区

首页依次显示：本周热门（`get_hot_skills`，7 天 Star 增长，不足 3 条时隐藏）、最新收录（`get_latest_skills`，每个仓库最多 2 条；RPC 不可用时退回按 `created_at` 排序并在客户端去重）、精选技能（最多 6 条）、分类浏览。卡片标签“本周 +N⭐”来自 `stars_growth`，“今天收录 / N 天前收录”按北京时间的日历日从 `created_at` 计算，超过 30 天不显示。两个 RPC 由 `pipeline/supabase/migrations/020_hot_and_latest_skills.sql` 创建；迁移执行前热门区自动隐藏，最新收录使用退回查询。

## 新词雷达：日期与收藏

- “最新发现”默认浏览全部日期；最近 7 天可直接点选，也可展开月历、点月份快速跳转。`discovered_at` 是数据库 `date` 字段，单日请求使用 `eq.YYYY-MM-DD` 并继续服务端分页，不只过滤当前已加载的 30 条。没有日期的记录保留在“全部”中。
- 新词直接在列表中展示完整名称、简介和收藏按钮，不再打开详情弹层或展示收录评分；项目榜与模型榜保留各自的热度指标。发现日期用于“最新发现”的分组及日历筛选。
- “新词收藏”入口和“已收藏 → 新词”读取同一份本机快照。存储键 `skiller.miniprogram.radar-favorites.v1` 与技能收藏分开，最多 500 条，可离线阅读收藏时的简介；不提供跨设备同步。

## 在微信开发者工具中试用

1. 打开本目录。`project.config.json` 已填写正式小程序 AppID。
2. 保持 `setting.urlCheck: true`，检查发现、搜索、分类、详情和收藏是否加载真实数据。详情页应能在小程序内完整阅读技能说明。
3. 若仅为排查模拟器网络问题，可临时在不提交的 `project.private.config.json` 中设置 `setting.urlCheck: false`；这不能证明正式版网络可用，排查后必须恢复为 `true`。

## 真机与发布前验证

1. 到微信公众平台 → 开发管理 → 开发设置 → 服务器域名，把 `https://gphynosbfjcyexhkgctf.supabase.co` 加入 **request 合法域名**。如使用 Supabase 图片，再按实际请求配置 downloadFile 合法域名。
2. 保持 `urlCheck: true`，上传体验版，在真机上检查首次加载、搜索、分类分页、详情和弱网缓存。以微信后台是否接受该域名及真机请求结果为准。

## 已知边界

- 首次离线启动没有预置目录；在线成功后会缓存已访问的列表和详情。
- 搜索匹配技能名、作者、英文简介和中文简介，最多返回 50 条。
- 收藏只保存在当前设备，不与 iOS 账号同步。
- 正式 AppID 在开发者工具中开启域名校验后，Supabase 的技能和分类请求已返回 HTTP 200；真机请求与完整发布流程尚未验收。

## 界面设计

- 设计令牌（颜色、间距、圆角、字号、点击区域）统一定义在 `app.wxss` 的 `page` 选择器下，页面和组件通过 `var(--…)` 引用；全局只有一个强调色，间距按 8pt（16rpx）栅格取值。
- 图标位于 `assets/icons/`，页面引用 PNG；SVG 源文件仅用于生成，已在 `project.config.json` 中排除出代码包。修改图标或配色后运行 `node scripts/render-miniprogram-icons.mjs`（需要 Node 22+ 和 Chrome）重新生成。
- 底部技能导航（`components/skill-tabbar`）只用于发现、分类、收藏三个页面，仍然通过 `wx.redirectTo` 切换，不使用原生 tabBar。
