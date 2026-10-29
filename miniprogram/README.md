# AISkill技能库微信小程序

原生微信小程序工程，与根目录下的 SwiftUI iOS App 共用 Supabase 技能目录。首版提供发现、搜索、分类浏览、详情、复制内容和本地收藏；不需要用户登录。

## 读取方式

`services/api.ts` 使用 `wx.request` 通过 HTTPS 直接读取 Supabase 的 `skills`、`categories` 和 `get_category_counts`。`services/config.ts` 使用与 iOS App 相同的项目 URL 和公开 anon key；公开表和函数的 RLS/权限允许匿名读取。小程序包内不得放入 service-role key 或数据库密码。

CloudBase 云函数和迁移脚本保留为可选后备方案；当前小程序不调用它们，也不需要先复制数据。

## 首页分区

首页依次显示：本周热门（`get_hot_skills`，7 天 Star 增长，不足 3 条时隐藏）、最新收录（`get_latest_skills`，每个仓库最多 2 条；RPC 不可用时退回按 `created_at` 排序并在客户端去重）、精选技能（最多 6 条）、分类浏览。卡片标签“本周 +N⭐”来自 `stars_growth`，“今天收录 / N 天前收录”按北京时间的日历日从 `created_at` 计算，超过 30 天不显示。两个 RPC 由 `pipeline/supabase/migrations/020_hot_and_latest_skills.sql` 创建；迁移执行前热门区自动隐藏，最新收录使用退回查询。

## 欢迎页（landing）

欢迎页只显示品牌头部、标题和「全部工具」两个入口（AI 技能库、开源雷达），不再有「今日推荐/今日热门工具」卡片，也不在加载时请求技能数据。分享欢迎页时标题为「头山 AI 工具箱：探索 AI 技能与趋势」，路径为欢迎页本身。复制逻辑 `copyInstall`（`services/skill-install.ts`）仍由技能详情页使用。

## 开源雷达

- 欢迎页的第二个入口由「新词雷达」改为「开源雷达」，进入 `pages/open-radar/index`（列表）；不新增第三个入口。
- 数据来自 Supabase 视图 `open_radar_published`（`services/open-radar.ts`，用公开 anon key，不用 web-view）：只包含 `status = 'published'` 的条目，字段为中文标题、摘要、安装命令、公众号文链接、部署包链接，不含任何来源字段。列表按发布时间倒序，最多 50 条；详情按 id 读取。
- 抓取脚本只写草稿，没有人工发布的条目时列表显示「开源雷达筹备中」占位；视图尚未创建（迁移 `027` 未执行）时同样按空列表处理，其他网络/服务错误才显示「网络不佳」并可重试。如何抓取、审核发布见 `pipeline/README.md`「开源雷达候选抓取」。
- 详情页以 `summary`（视图已有的长文字段，支持简单 Markdown：标题、列表、引用、代码块）作为主体正文，其下依次是安装命令和相关链接；「踩坑要点」暂不展示，小程序也不再读取 `pitfalls` 列（数据库表结构不变）。
- 详情页字段为空则不渲染；链接和命令只提供“复制”，页面不展示 GitHub 品牌字样（数据库约束也禁止含该字样的条目发布）。
- 原「新词雷达」页（`pages/radar/index`）代码保留，但欢迎页不再进入；下面“新词雷达”小节描述的是该页现状。

## 新词雷达：日期与收藏

- “最新发现”默认浏览全部日期；最近 7 天可直接点选，也可展开月历、点月份快速跳转。`discovered_at` 是数据库 `date` 字段，单日请求使用 `eq.YYYY-MM-DD` 并继续服务端分页，不只过滤当前已加载的 30 条。没有日期的记录保留在“全部”中。
- 新词直接在列表中展示完整名称、简介和收藏按钮，不再打开详情弹层或展示收录评分；项目榜与模型榜保留各自的热度指标。发现日期用于“最新发现”的分组及日历筛选。
- “新词收藏”入口和“已收藏 → 新词”读取同一份本机快照。存储键 `skiller.miniprogram.radar-favorites.v1` 与技能收藏分开，最多 500 条，可离线阅读收藏时的简介；不提供跨设备同步。

## 详情页：安装、分享与反馈

- **一键复制安装命令**：`services/skill-install.ts` 的 `skillInstallPlan` 按仓库信息生成命令，优先 `npx skills add <仓库> --skill <名称>`；根目录技能再给出 `git clone … ~/.claude/skills/<名称>`；官方 `anthropics/skills` 另给 `/plugin marketplace add`。推断不了命令时复制 GitHub 链接。详情页同时给出 3 步安装说明、原链接（可复制）和 SKILL.md frontmatter 里的许可证（没有就不显示）。
- **作者申请下架 / 反馈**：详情页底部「联系」弹窗提示发邮件到隐私政策公布的联系邮箱，可一键复制。
- **分享卡片**：`onShareAppMessage` 标题为「技能名｜一句中文用途」；`services/share-card.ts` 在页面隐藏的 `canvas type="2d"` 上画 5:4 封面（技能名、用途、Star、头山 AI 工具箱），导出失败或超时就用默认截图。页面内「推荐给同事」按钮使用 `open-type="share"`。
- **复制后引导分享**：复制安装命令（或 GitHub 链接）成功后提示「安装命令已复制，分享给朋友一起用」（文案见 `copyShareNudge`），详情页相同。
- **首页与欢迎页分享**：欢迎页分享欢迎页本身；技能库首页保持应用标题。
- **事件**：复制安装命令/链接记为 `copy_install`，分享记为 `share`，`meta.action` 写明动作。这两个事件名需要先执行 `pipeline/supabase/migrations/025_mp_events_install_share.sql`，之前上报会被忽略。

## 搜索无结果

- 首页搜索无结果时显示「已记录，我们会尽快收录」，并推荐本周热门（不足 3 条则用精选）。`search_empty` 事件由 `pipeline/scripts/empty-search-report.ts` 汇总补录。
- 搜索无结果且查询属于「武打 / 武术 / 功夫 / 格斗 / 战斗 / 舞蹈 / 动漫 / 影视」等意图词时，`services/search-expansion.ts` 会并行搜索目录里真实存在的相关词（分镜、视频生成、短剧、游戏动画…），命中则显示「没找到「xxx」，这些可能相关」；仍无命中才回到上面的空状态。`search_empty` 始终按原始查询在主搜索为 0 时立即上报，不等待相关搜索。
- 「微信小程序 SKILL」专题入口已从发现页和首页分类中移除（`visibleCategories`，`services/topics.ts`）；数据库中的 `mp-skill` 分类和已收录范例不变，只是暂时没有分类入口。

## 在微信开发者工具中试用

1. 打开本目录。`project.config.json` 已填写正式小程序 AppID。
2. 保持 `setting.urlCheck: true`，检查发现、搜索、分类、详情和收藏是否加载真实数据。详情页应能在小程序内完整阅读技能说明。
3. 若仅为排查模拟器网络问题，可临时在不提交的 `project.private.config.json` 中设置 `setting.urlCheck: false`；这不能证明正式版网络可用，排查后必须恢复为 `true`。

## 真机与发布前验证

1. 到微信公众平台 → 开发管理 → 开发设置 → 服务器域名，把 `https://gphynosbfjcyexhkgctf.supabase.co` 加入 **request 合法域名**。如使用 Supabase 图片，再按实际请求配置 downloadFile 合法域名。
2. 保持 `urlCheck: true`，上传体验版，在真机上检查首次加载、搜索、分类分页、详情和弱网缓存。以微信后台是否接受该域名及真机请求结果为准。

## 网络超时与埋点失败

- 所有 `wx.request`（`api.ts`、`trending-terms.ts`、`analytics.ts`）统一使用 `services/config.ts` 的 `REQUEST_TIMEOUT_MS`（10 秒），与 `app.json` 的 `networkTimeout.request` 保持一致。
- 埋点发送失败（网络错误或非 2xx，如未执行迁移 025）不再静默：错误信息写入本机存储 `skiller.miniprogram.analytics-failures.v1`（最多 5 条）并用 `wx.getRealtimeLogManager().warn` 记录；下一次有埋点发送成功时，合并为一条 `js_error`（`page=analytics`，`meta.action=analytics_send_failures`）补报并清空。不需要新迁移。

## 已知边界

- 首次离线启动没有预置目录；在线成功后会缓存已访问的列表和详情。
- 搜索匹配技能名、作者、英文简介和中文简介，最多返回 50 条。
- 收藏只保存在当前设备，不与 iOS 账号同步。
- 正式 AppID 在开发者工具中开启域名校验后，Supabase 的技能和分类请求已返回 HTTP 200；真机请求与完整发布流程尚未验收。

## 界面设计

- 设计令牌（颜色、间距、圆角、字号、点击区域）统一定义在 `app.wxss` 的 `page` 选择器下，页面和组件通过 `var(--…)` 引用；全局只有一个强调色，间距按 8pt（16rpx）栅格取值。
- 图标位于 `assets/icons/`，页面引用 PNG；SVG 源文件仅用于生成，已在 `project.config.json` 中排除出代码包。修改图标或配色后运行 `node scripts/render-miniprogram-icons.mjs`（需要 Node 22+ 和 Chrome）重新生成。
- 底部技能导航（`components/skill-tabbar`）只用于发现、分类、收藏三个页面，仍然通过 `wx.redirectTo` 切换，不使用原生 tabBar。
