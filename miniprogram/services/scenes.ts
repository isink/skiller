/**
 * 「按岗位挑 WorkBuddy 技能」场景合集：人工精选的办公技能，按目录 slug 引用。
 * 每个技能配 2 句「装好后对 WorkBuddy 这样说」的示例，详情页和合集页共用。
 * 增删技能前先确认 slug 在目录里存在且有中文简介（`npm run check:scenes`）。
 */
export interface ScenePick {
  slug: string;
  /** 装好后可以直接发给 WorkBuddy 的示例指令。 */
  say: string[];
}

export interface Scene {
  slug: string;
  title: string;
  tagline: string;
  shareTitle: string;
  picks: ScenePick[];
}

export const SCENES: Scene[] = [
  {
    slug: "excel",
    title: "表格与数据",
    tagline: "Excel 汇总、数据看板、流程图",
    shareTitle: "天天做表的人，装这 6 个 WorkBuddy 技能就够了",
    picks: [
      { slug: "xlsx-official", say: ["把这份销售明细按月份和地区汇总，生成一张带合计的 Excel", "检查这张表里的公式有没有错，标出有问题的单元格"] },
      { slug: "office-productivity", say: ["把这周的会议记录整理成 Word 周报，再做一页 PPT 摘要", "把这个文件夹里的 Excel 统一成同一个模板格式"] },
      { slug: "data-storytelling", say: ["根据这份季度数据写一段给老板看的结论，先说结论再给数据", "把这组数字讲成一个三段式的汇报故事"] },
      { slug: "dashboard-design", say: ["帮我设计一个运营日报看板，列出该放哪些指标和图表", "这个看板太乱了，帮我重新排一下布局和层级"] },
      { slug: "kpi-dashboard-design", say: ["为销售团队设计一套 KPI 看板，包含目标完成率和趋势", "给每个 KPI 写清楚计算口径和数据来源"] },
      { slug: "mermaid-expert", say: ["把这段报销审批流程画成流程图", "根据这份组织说明画一张部门架构图"] },
    ],
  },
  {
    slug: "ppt",
    title: "PPT 与演示",
    tagline: "从大纲到成品，汇报不再熬夜",
    shareTitle: "做 PPT 不熬夜：6 个 WorkBuddy 演示技能",
    picks: [
      { slug: "pptx-official", say: ["根据这份 Word 方案做一份 10 页的汇报 PPT", "把这份 PPT 的字体和配色统一一下"] },
      { slug: "pptx-deck-creation", say: ["我要给客户讲新产品，先规划 PPT 的故事线，再生成可编辑的 PPTX", "检查这份 PPT 是不是每页只讲一个重点"] },
      { slug: "nanobanana-ppt-skills", say: ["把这篇文章做成图文并茂的 PPT", "按科技风给这份大纲配图并生成演示文稿"] },
      { slug: "nexu-io-open-design-plugins-official-examples-guizang-ppt", say: ["把这份产品介绍做成杂志风的网页 PPT", "生成一份能在手机上横向翻页的分享页"] },
      { slug: "frontend-slides", say: ["把这份 PPT 转成带动画的网页演示", "从零做一个 5 页的发布会网页幻灯片"] },
      { slug: "pitch-psychologist", say: ["帮我调整这份提案的顺序，让客户更容易接受报价", "找出这份路演稿里会让投资人犹豫的地方"] },
    ],
  },
  {
    slug: "docs",
    title: "文档、会议与写作",
    tagline: "会议纪要、Word、PDF、周报",
    shareTitle: "会议纪要和周报交给 AI：8 个 WorkBuddy 文档技能",
    picks: [
      { slug: "meeting-notes", say: ["把这段会议记录整理成纪要：结论、决策、待办和负责人", "从这份纪要里列出所有没写截止时间的待办"] },
      { slug: "meeting-distiller-pro", say: ["把这份会议转写稿提炼成行动项清单，按负责人分组", "写一封会后跟进邮件发给参会人"] },
      { slug: "audio-transcriber", say: ["把这段会议录音转成文字，并生成摘要", "把这个采访视频转成带时间戳的文字稿"] },
      { slug: "internal-comms-anthropic", say: ["根据这些要点写一份本周项目进展周报", "写一份全员通知，说明下周起的新报销流程"] },
      { slug: "avoid-ai-writing", say: ["把这段文字改得更像人写的，去掉 AI 腔", "检查这篇稿子里有哪些套话，逐条改掉"] },
      { slug: "docx-official", say: ["把这份合同里的「甲方」都改成公司全称，并保留修订痕迹", "把这几份 Word 里的表格提取出来汇总到一起"] },
      { slug: "pdf-official", say: ["把这几个 PDF 合并成一个，按文件名排序", "提取这份 PDF 第 3 到 8 页的文字"] },
      { slug: "pdf-conversion-router", say: ["把这份 PDF 报告转成可以编辑的文档，保留表格", "把扫描版 PDF 里的表格提取成 Excel"] },
    ],
  },
  {
    slug: "marketing",
    title: "新媒体与营销",
    tagline: "小红书、公众号、营销文案",
    shareTitle: "运营人必装：8 个 WorkBuddy 小红书和公众号技能",
    picks: [
      { slug: "xiaohongshu-content-strategist", say: ["帮我写 3 篇推广这款护手霜的小红书笔记，要有标题和标签", "分析这篇笔记为什么没流量，给出改进建议"] },
      { slug: "wechat-official-account-strategist", say: ["给这篇公众号文章起 5 个标题，并说明各自的打开逻辑", "把这篇长文重新排结构，让开头 3 行就抓住读者"] },
      { slug: "linkdigest-social-link-reader", say: ["读一下这个小红书链接，总结它的爆点", "把这个抖音视频的字幕和要点提取出来"] },
      { slug: "copywriting", say: ["为新品落地页写一版文案：标题、卖点和行动按钮", "把这封促销邮件改得更有说服力，但不要夸大"] },
      { slug: "marketing-psychology", say: ["用心理学分析我们的定价页，找出最该改的 3 处", "给这次大促设计几个提升下单的小机制"] },
      { slug: "customer-research", say: ["从这 50 条用户评价里归纳出 5 个主要痛点", "根据这些访谈记录整理用户画像"] },
      { slug: "seo-content-writer", say: ["围绕「家用净水器怎么选」写一篇搜索友好的文章", "给这篇文章补上合适的关键词和小标题"] },
      { slug: "agricidaniel-claude-seo-skills-seo-sxo", say: ["分析这个页面和目标关键词是否匹配，给出修改建议", "看看搜这个词的用户真正想要什么样的页面"] },
    ],
  },
  {
    slug: "finance",
    title: "财务与税务",
    tagline: "对账、应收、税务登记、财务模型",
    shareTitle: "财务人必装的 6 个 WorkBuddy 技能：对账、税务、预测",
    picks: [
      { slug: "anthropics-knowledge-work-plugins-finance-skills-reconciliation", say: ["把这个月的银行流水和总账对一下，列出差异", "把对不上的款项按原因分类"] },
      { slug: "receipt-accounting", say: ["把这批收款记录整理成收款登记表，标出未核销金额", "区分哪些是客户回款、哪些是预付款"] },
      { slug: "sales-accounting", say: ["根据这些销售发票生成应收账款台账", "列出超过账期还没收回的发票"] },
      { slug: "tax-register", say: ["汇总本季度的销项税和进项税，算出应缴税额", "列出接下来 30 天的申报截止日"] },
      { slug: "startup-financial-modeling", say: ["帮我搭一个 3 年的收入和成本预测模型", "做乐观、中性、悲观三种情景的现金流对比"] },
      { slug: "startup-business-analyst-financial-projections", say: ["根据这些假设生成一份融资用的财务预测", "按现在的花钱速度，算算现金还能撑几个月"] },
    ],
  },
  {
    slug: "hr",
    title: "招聘与人事",
    tagline: "招聘进度、面试、绩效、OKR",
    shareTitle: "HR 必装的 8 个 WorkBuddy 技能：招聘、绩效、OKR",
    picks: [
      { slug: "hr-pro", say: ["帮我起草一份新员工入职流程清单", "写一份适合 50 人公司的考勤和请假制度"] },
      { slug: "recruitment-pipeline", say: ["把这些候选人整理成招聘进度表，按阶段分组", "统计各招聘渠道的投递和录用数量"] },
      { slug: "interview-coach", say: ["根据这个岗位描述准备 10 个面试问题和参考答案", "模拟一场产品经理面试，结束后给我反馈"] },
      { slug: "cv-generator", say: ["根据这份岗位描述优化我的简历", "把我的工作经历改写成更有成果感的描述"] },
      { slug: "employment-contract-templates", say: ["生成一份录用通知书模板", "列出一份试用期劳动合同应包含的要点"] },
      { slug: "performance-management", say: ["设计一套季度绩效考核表，包含 KPI 和行为评分", "根据这些评分给出绩效等级和改进建议"] },
      { slug: "okr-system", say: ["帮市场部制定下季度 OKR，每个目标 3 个关键结果", "检查这份 OKR 的关键结果是否可衡量"] },
      { slug: "leave-management", say: ["把这个月的请假申请整理成表，算出每个人剩余年假", "列出下周请假的人和他们的交接人"] },
    ],
  },
  {
    slug: "sales",
    title: "销售与客户",
    tagline: "开发信、跟进、报价、话术",
    shareTitle: "销售必装的 6 个 WorkBuddy 技能：开发信、话术、报价",
    picks: [
      { slug: "cold-email", say: ["给这家潜在客户写一封开发信和两封跟进邮件", "把这封开发信改短，提高回复率"] },
      { slug: "sales-automator", say: ["根据这次拜访记录写一封跟进邮件和报价说明", "为我们的产品写一套电话销售话术"] },
      { slug: "sales-enablement", say: ["做一页纸的产品介绍给销售团队用", "整理一份常见异议和应对话术"] },
      { slug: "email-sequence", say: ["设计一组 5 封的新客户欢迎邮件", "为很久没下单的老客户设计一组唤醒邮件"] },
      { slug: "offers", say: ["帮我设计一个更有吸引力的套餐方案", "给这门课程设计赠品和限时优惠"] },
      { slug: "objection-preemptor", say: ["客户可能对价格有哪些顾虑？帮我提前写进方案里", "找出这份销售页里让人犹豫的地方"] },
    ],
  },
  {
    slug: "pm",
    title: "产品与项目",
    tagline: "需求文档、优先级、想法梳理",
    shareTitle: "产品经理的 3 个 WorkBuddy 技能：PRD、优先级、想法梳理",
    picks: [
      { slug: "product-manager-toolkit", say: ["把这些用户反馈整理成需求优先级列表", "帮我写一份新功能的需求文档"] },
      { slug: "product-manager", say: ["用 RICE 方法给这 10 个需求排优先级", "设计一套衡量会员功能是否成功的指标"] },
      { slug: "idea-os", say: ["我想做一个社区团购小程序，帮我梳理成需求文档和计划", "先问我几个问题，把这个想法想清楚"] },
    ],
  },
];

export function sceneBySlug(slug: string | undefined): Scene | null {
  return SCENES.find((scene) => scene.slug === slug) || null;
}

/** The scene a curated skill belongs to and its example requests; null for skills outside the collections. */
export function scenePick(skillSlug: string | undefined): { scene: Scene; pick: ScenePick } | null {
  for (const scene of SCENES) {
    const pick = scene.picks.find((item) => item.slug === skillSlug);
    if (pick) return { scene, pick };
  }
  return null;
}

/** One curated skill per Beijing calendar day, cycling through every collection in order. */
export function dailyPick(now: Date = new Date()): { scene: Scene; pick: ScenePick } {
  const all = SCENES.reduce<Array<{ scene: Scene; pick: ScenePick }>>((list, scene) => list.concat(scene.picks.map((pick) => ({ scene, pick }))), []);
  const beijingDay = Math.floor((now.getTime() + 8 * 3600 * 1000) / 86400000);
  return all[((beijingDay % all.length) + all.length) % all.length];
}
