# AISkill技能库微信小程序

原生微信小程序工程，与根目录下的 SwiftUI iOS App 共用 Supabase 技能目录。首版提供发现、搜索、分类浏览、详情、复制内容和本地收藏；不需要用户登录。

## 读取方式

`services/api.ts` 使用 `wx.request` 通过 HTTPS 直接读取 Supabase 的 `skills`、`categories` 和 `get_category_counts`。`services/config.ts` 使用与 iOS App 相同的项目 URL 和公开 anon key；公开表和函数的 RLS/权限允许匿名读取。小程序包内不得放入 service-role key 或数据库密码。

CloudBase 云函数和迁移脚本保留为可选后备方案；当前小程序不调用它们，也不需要先复制数据。

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
