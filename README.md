# Skiller

浏览、搜索和收藏 Claude Skills 的原生 iOS 应用。

Skiller 汇集 Anthropic 官方与社区的上千个 Claude Skills，提供分类浏览、中英文搜索、GitHub 热度排序和 SKILL.md 原文阅读。登录后，收藏可在多台设备间同步。界面支持简体中文与 English。

## 功能

- **发现**：首页展示热门与新收录的 skill，可按分类浏览，支持中英文搜索。
- **详情**：渲染 SKILL.md 原文，显示 GitHub stars、作者与来源仓库；可复制来源链接或 SKILL.md 全文。
- **收藏**：未登录时收藏保存在本机；使用 Apple 或 GitHub 账号登录后跨设备同步。
- **反馈**：可举报内容有问题的 skill。
- **隐私**：首次启动征得同意后才启用广告与设备标识。隐私政策与使用条款见 [`docs/compliance`](docs/compliance)。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 平台 | iOS 17+，SwiftUI，SwiftData |
| 数据 | Supabase（[supabase-swift](https://github.com/supabase/supabase-swift)） |
| Markdown | [swift-markdown-ui](https://github.com/gonzalezreal/swift-markdown-ui) |
| 广告 | Google Mobile Ads，配合 User Messaging Platform 征得同意 |
| 工程 | [XcodeGen](https://github.com/yonaskolb/XcodeGen)，由 `project.yml` 生成 Xcode 工程 |

## 本地开发

需要 Xcode 15 及以上版本与 XcodeGen（`brew install xcodegen`）。Xcode 工程由 `project.yml` 生成，不纳入版本控制。

```bash
xcodegen generate
open Skiller.xcodeproj
```

命令行构建与测试：

```bash
xcodebuild -scheme Skiller -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' build
xcodebuild -scheme Skiller -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' test
```

## 数据管线

App 只读取 Supabase，skill 数据由独立的 Node.js 管线维护，位于 [`pipeline/`](pipeline)：

1. 从 [anthropics/skills](https://github.com/anthropics/skills)、[antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) 和 GitHub 搜索导入 skill；
2. 补充 GitHub stars 等热度数据；
3. 生成中文简介与双语标签。

数据库结构与迁移同样在 `pipeline/` 下。环境变量、运行方式和发布顺序见 [`pipeline/README.md`](pipeline/README.md)。

## 项目结构

```
Skiller/        iOS 应用源码（App、Models、Services、Views、Components、Theme、Resources）
SkillerTests/   单元测试：收藏同步、登录范围、隐私同意、举报参数等
pipeline/       数据导入、富化、数据库 schema 与迁移
docs/           隐私政策、使用条款与官网页面
project.yml     XcodeGen 工程定义
```
