# Skiller iOS (SwiftUI)

原生 iOS 重写版本，与 `../ios/` (Expo) 并存，迁移完成后会替换掉它。

## 快速开始

```bash
# 第一次：生成 Xcode 工程
xcodegen generate

# 用 Xcode 打开
open Skiller.xcodeproj

# 或命令行编译
xcodebuild -scheme Skiller -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' build
```

## 技术栈

- iOS 17+ / SwiftUI / SwiftData
- supabase-swift（数据层）
- swift-markdown-ui（SKILL.md 渲染）
- xcodegen（YAML → .xcodeproj，工程不入版本控制）

## 目录

```
Skiller/
├── App/                # 入口 SkillerApp.swift
├── Models/             # Skill / Category / Favorite (@Model)
├── Services/           # Supabase 客户端 + API + Stores + Formatters
├── Theme/              # 主题色 Color extensions
├── Components/         # SkillCard / HotSkillCard / SearchBar 等
├── Views/              # 5 屏 + RootTabView + SkillDetailView
└── Resources/          # Assets.xcassets / Info.plist (生成)
```

## 数据来源

直连原 Supabase 项目（`gphynosbfjcyexhkgctf.supabase.co`），表结构与 Expo 端共用，
import 脚本 (`../ios/scripts/`) 不变。
