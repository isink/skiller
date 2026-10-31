# 公众号 × 小程序配置手册

公众号与小程序是同一主体。本手册给出关联步骤和可以直接复制的页面路径。路径由 `miniprogram/services/scenes.ts` 生成，增删技能后同步更新。

## 1. 关联

1. 公众号后台 → 广告与服务 → 小程序管理 → 关联小程序，搜索「头山 AI 工具箱」（AppID `wx05e688a750350665`），按提示确认。
2. 小程序后台 → 设置 → 关注公众号，选择本公众号。之后欢迎页和详情页底部的 `<official-account>` 组件才会显示。
   - 这个组件由微信决定何时显示：主要在用户**扫码打开**小程序等场景下出现，从列表、分享卡片进入时不显示，属于正常现象。

## 2. 自定义菜单

| 菜单名 | 类型 | 小程序路径 |
|---|---|---|
| WorkBuddy 技能 | 跳转小程序 | `pages/landing/index` |
| 财务 / HR / PPT …（子菜单） | 跳转小程序 | 见下方场景页路径 |

菜单的「备用网页」必填，可以填官网或任意一篇介绍文章的链接。

## 3. 关键词自动回复（回复小程序卡片）

公众号后台 → 自动回复 → 关键词回复，回复内容选「小程序卡片」，路径填对应场景页：

| 关键词（半匹配） | 卡片标题 | 小程序路径 |
|---|---|---|
| 表格、Excel、数据 | 天天做表的人，这 6 个 WorkBuddy 技能请收好 | `pages/scene/index?slug=excel` |
| PPT、演示、汇报 | 做 PPT 不熬夜：6 个 WorkBuddy 演示技能 | `pages/scene/index?slug=ppt` |
| 会议、纪要、周报 | 会议纪要和周报交给 AI：8 个 WorkBuddy 技能 | `pages/scene/index?slug=docs` |
| 小红书、公众号、运营 | 运营人收藏：8 个 WorkBuddy 小红书和公众号技能 | `pages/scene/index?slug=marketing` |
| 财务、税务、对账 | 财务人的 6 个 WorkBuddy 技能：税务、预测、对账 | `pages/scene/index?slug=finance` |
| HR、招聘、绩效 | HR 的 8 个 WorkBuddy 技能：制度、招聘、绩效 | `pages/scene/index?slug=hr` |
| 销售、开发信、客户 | 销售的 6 个 WorkBuddy 技能：开发信、跟进、话术 | `pages/scene/index?slug=sales` |
| 产品、需求、PRD | 产品经理的 3 个 WorkBuddy 技能：需求、优先级、规划 | `pages/scene/index?slug=pm` |

## 4. 场景页路径（菜单、文章卡片、自动回复通用）

| 场景 | 路径 | 技能数 |
|---|---|---|
| 表格与数据 | `pages/scene/index?slug=excel` | 6 |
| PPT 与演示 | `pages/scene/index?slug=ppt` | 6 |
| 会议与写作 | `pages/scene/index?slug=docs` | 8 |
| 新媒体与营销 | `pages/scene/index?slug=marketing` | 8 |
| 财务与税务 | `pages/scene/index?slug=finance` | 6 |
| 招聘与人事 | `pages/scene/index?slug=hr` | 8 |
| 销售与客户 | `pages/scene/index?slug=sales` | 6 |
| 产品与项目 | `pages/scene/index?slug=pm` | 3 |

## 5. 技能详情页路径（文章里提到某个技能时用）

详情页支持按技能名（slug）打开，技能重新导入后路径也不变。

### 表格与数据

| 技能 | 一句话 | 路径 |
|---|---|---|
| Excel 做表专家 | 表格汇总、查公式、出报表 | `pages/detail/index?slug=xlsx-official` |
| 数据讲故事 | 一堆数字 → 给老板看的结论 | `pages/detail/index?slug=data-storytelling` |
| 流程图画手 | 说一句话，流程图、架构图就画好 | `pages/detail/index?slug=mermaid-expert` |
| 办公文件批处理 | Word、Excel、PPT 批量处理 | `pages/detail/index?slug=office-productivity` |
| 看板设计顾问 | 运营看板该放什么、怎么排 | `pages/detail/index?slug=dashboard-design` |
| KPI 看板设计 | KPI 看板与指标口径 | `pages/detail/index?slug=kpi-dashboard-design` |

### PPT 与演示

| 技能 | 一句话 | 路径 |
|---|---|---|
| 杂志风网页 PPT | 一句话出一份杂志风网页 PPT | `pages/detail/index?slug=nexu-io-open-design-plugins-official-examples-guizang-ppt` |
| PPT 制作助手 | Word 方案 → 可编辑的 PPT | `pages/detail/index?slug=pptx-official` |
| PPT 故事线规划 | 先理故事线，再出整套 PPT | `pages/detail/index?slug=pptx-deck-creation` |
| 图文 PPT 生成 | 文章 → 图文并茂的 PPT | `pages/detail/index?slug=nanobanana-ppt-skills` |
| 网页动画幻灯片 | PPT → 带动画的网页演示 | `pages/detail/index?slug=frontend-slides` |
| 提案说服力顾问 | 让提案更容易被接受 | `pages/detail/index?slug=pitch-psychologist` |

### 会议与写作

| 技能 | 一句话 | 路径 |
|---|---|---|
| 会议纪要助手 | 会议记录 → 结论、待办、负责人 | `pages/detail/index?slug=meeting-notes` |
| 录音转文字 | 录音、视频 → 文字稿和摘要 | `pages/detail/index?slug=audio-transcriber` |
| 周报通知写手 | 几条要点 → 周报和全员通知 | `pages/detail/index?slug=internal-comms-anthropic` |
| 会议行动项提炼 | 转写稿 → 按人分组的行动项 | `pages/detail/index?slug=meeting-distiller-pro` |
| 去 AI 腔改写 | 去掉 AI 腔，读着像人写的 | `pages/detail/index?slug=avoid-ai-writing` |
| Word 批量编辑 | 批量改 Word、留修订痕迹 | `pages/detail/index?slug=docx-official` |
| PDF 合并拆分 | PDF 合并、拆分、取文字 | `pages/detail/index?slug=pdf-official` |
| PDF 转可编辑 | PDF → 可编辑文档和表格 | `pages/detail/index?slug=pdf-conversion-router` |

### 新媒体与营销

| 技能 | 一句话 | 路径 |
|---|---|---|
| 小红书笔记写手 | 一个产品 → 带标题标签的小红书笔记 | `pages/detail/index?slug=xiaohongshu-content-strategist` |
| 公众号标题优化 | 公众号标题和结构一次改好 | `pages/detail/index?slug=wechat-official-account-strategist` |
| 爆款链接拆解 | 爆款链接 → 文字和爆点拆解 | `pages/detail/index?slug=linkdigest-social-link-reader` |
| 营销文案写手 | 落地页和促销邮件文案 | `pages/detail/index?slug=copywriting` |
| 营销心理学顾问 | 用心理学找出页面该改的地方 | `pages/detail/index?slug=marketing-psychology` |
| 用户调研分析 | 用户评价 → 痛点和画像 | `pages/detail/index?slug=customer-research` |
| 搜索友好文章 | 搜索友好的长文 | `pages/detail/index?slug=seo-content-writer` |
| 搜索意图分析 | 页面和搜索词是否对得上 | `pages/detail/index?slug=agricidaniel-claude-seo-skills-seo-sxo` |

### 财务与税务

| 技能 | 一句话 | 路径 |
|---|---|---|
| 税额汇总表 | 季度税额和申报截止日一表看清 | `pages/detail/index?slug=tax-register` |
| 财务预测模型 | 3 年收入成本预测，一次搭好 | `pages/detail/index?slug=startup-financial-modeling` |
| 收款登记助手 | 收款登记与未核销金额 | `pages/detail/index?slug=receipt-accounting` |
| 应收台账助手 | 销售发票 → 应收台账 | `pages/detail/index?slug=sales-accounting` |
| 融资财务预测 | 融资用的财务预测 | `pages/detail/index?slug=startup-business-analyst-financial-projections` |
| 银行对账助手 | 银行流水对总账，差异自动列出来 | `pages/detail/index?slug=anthropics-knowledge-work-plugins-finance-skills-reconciliation` |

### 招聘与人事

| 技能 | 一句话 | 路径 |
|---|---|---|
| HR 制度助手 | 入职、考勤、制度文件一次写好 | `pages/detail/index?slug=hr-pro` |
| 招聘进度表 | 候选人进度表自动整理 | `pages/detail/index?slug=recruitment-pipeline` |
| 绩效考核助手 | 绩效考核表和评级 | `pages/detail/index?slug=performance-management` |
| 面试准备助手 | 面试题、模拟面试和反馈 | `pages/detail/index?slug=interview-coach` |
| 简历优化助手 | 按岗位优化简历 | `pages/detail/index?slug=cv-generator` |
| 劳动合同模板 | 录用通知和合同模板 | `pages/detail/index?slug=employment-contract-templates` |
| OKR 制定助手 | 部门 OKR 制定与检查 | `pages/detail/index?slug=okr-system` |
| 请假登记表 | 请假登记与年假余额 | `pages/detail/index?slug=leave-management` |

### 销售与客户

| 技能 | 一句话 | 路径 |
|---|---|---|
| 开发信写手 | 一封开发信 + 两封跟进 | `pages/detail/index?slug=cold-email` |
| 销售跟进助手 | 拜访记录 → 跟进邮件和话术 | `pages/detail/index?slug=sales-automator` |
| 销售资料助手 | 一页纸产品介绍和异议应对 | `pages/detail/index?slug=sales-enablement` |
| 系列邮件设计 | 欢迎、唤醒等系列邮件 | `pages/detail/index?slug=email-sequence` |
| 套餐方案设计 | 套餐、赠品和限时优惠设计 | `pages/detail/index?slug=offers` |
| 客户顾虑预判 | 提前化解客户顾虑 | `pages/detail/index?slug=objection-preemptor` |

### 产品与项目

| 技能 | 一句话 | 路径 |
|---|---|---|
| 需求整理助手 | 用户反馈 → 需求优先级和需求文档 | `pages/detail/index?slug=product-manager-toolkit` |
| 产品决策助手 | 排优先级、定成功指标 | `pages/detail/index?slug=product-manager` |
| 想法梳理助手 | 一个想法 → 需求文档和计划 | `pages/detail/index?slug=idea-os` |

## 6. 每周固定栏目（建议）

- 栏目名示例：「这周试试」或「本周 WorkBuddy 好技能」，每周一篇。
- 每篇讲 1 个岗位或 1 件具体的事，正文给 2–3 句可以直接发给 WorkBuddy 的话，文末插对应场景页的小程序卡片。
- `docs/marketing/scene-posts.md` 里 8 个场景的文案可以改写成第一批推文。

## 7. 看公众号带来了多少人

小程序的 `page_view` 埋点带有 `meta.entry_scene`（微信场景值）。常见值：`1035` 公众号自定义菜单、`1058` 公众号文章、`1074` 公众号会话里的小程序卡片（关键词回复）、`1082` 公众号会话里的文字链、`1007` / `1008` 好友 / 群分享、`1011` 扫码。完整列表以微信官方「场景值」文档为准。

按来源统计每台设备第一次访问（在 Supabase SQL Editor 运行）：

```sql
select first.entry_scene, count(*) as devices
from (
  select distinct on (anon_id) anon_id, meta->>'entry_scene' as entry_scene
  from public.mp_events
  where event = 'page_view' and meta->>'env' = 'release'
  order by anon_id, created_at
) as first
group by 1 order by 2 desc;
```
