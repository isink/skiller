/**
 * 「按岗位挑 WorkBuddy 技能」场景合集：人工精选的办公技能，按目录 slug 引用。
 * 每个场景只推 3 个「必装」，其余放进「更多」。场景内按目录里的 GitHub 星标从高到低排，
 * 前 3 个是必装，星标相同的保持现有顺序（`npm run check:scenes` 会校验）。每个技能配一句卖点和 2 句
 * 「装好后对 WorkBuddy 这样说」的示例，详情页和合集页共用。
 * `example` 只填在 WorkBuddy 里真实跑出来的输入和结果，没跑过就不填，页面不显示示例块。
 * 增删技能后运行 `npm run check:scenes`，确认 slug 在目录里存在且有中文简介。
 */
export interface SceneExample {
  /** 发给 WorkBuddy 的原话（可附上用到的材料说明）。 */
  input: string;
  /** WorkBuddy 实际给出的结果，可节选。 */
  output: string;
}

export interface ScenePick {
  slug: string;
  /** 中文名，替代英文技能名做主标题；必填。 */
  nameZh?: string;
  /** 两句话：适合谁、什么时候用，替代机翻简介；必填。 */
  intro?: string;
  /** 用之前要准备的材料，显示在「这样说」上方；必填。 */
  prepare?: string;
  /** 一句话说清它帮你干什么，例如「会议记录 → 结论、待办、负责人」。 */
  headline: string;
  /** 装好后可以直接发给 WorkBuddy 的示例指令。 */
  say: string[];
  example?: SceneExample;
}

export interface Scene {
  slug: string;
  title: string;
  tagline: string;
  shareTitle: string;
  /** 恰好 3 个，按推荐顺序。 */
  must: ScenePick[];
  more: ScenePick[];
}

export const MUST_COUNT = 3;

export const SCENES: Scene[] = [
  {
    slug: "excel",
    title: "表格与数据",
    tagline: "Excel 汇总、数据结论、流程图",
    shareTitle: "天天做表的人，装这 3 个 WorkBuddy 技能就够了",
    must: [
      { slug: "xlsx-official", nameZh: "Excel 做表专家", intro: "要汇总明细、做报表、检查公式时用。它会照原表格式改，不乱动你的模板。", prepare: "一份 Excel 文件", headline: "表格汇总、查公式、出报表", say: ["把这份销售明细按月份和地区汇总，生成一张带合计的 Excel", "检查这张表里的公式有没有错，标出有问题的单元格"] },
      { slug: "data-storytelling", nameZh: "数据讲故事", intro: "手上有一堆数字、要写汇报结论时用。它先给结论，再用数据支撑。", prepare: "一份数据表或几组关键数字", headline: "一堆数字 → 给老板看的结论", say: ["根据这份季度数据写一段给老板看的结论，先说结论再给数据", "把这组数字讲成一个三段式的汇报故事"] },
      { slug: "mermaid-expert", nameZh: "流程图画手", intro: "要画审批流程、组织架构、系统关系图时用。你用文字描述，它画成图。", prepare: "一段流程或结构的文字说明", headline: "说一句话，流程图、架构图就画好", say: ["把这段报销审批流程画成流程图", "根据这份组织说明画一张部门架构图"] },
    ],
    more: [
      { slug: "office-productivity", nameZh: "办公文件批处理", intro: "要一次处理很多 Word、Excel、PPT 文件时用，比如统一格式、批量转换。", prepare: "要处理的一批文件", headline: "Word、Excel、PPT 批量处理", say: ["把这周的会议记录整理成 Word 周报，再做一页 PPT 摘要", "把这个文件夹里的 Excel 统一成同一个模板格式"] },
      { slug: "dashboard-design", nameZh: "看板设计顾问", intro: "要搭运营或业务看板时用。告诉你该放哪些指标、怎么排布。", prepare: "看板给谁看、关心哪些数", headline: "运营看板该放什么、怎么排", say: ["帮我设计一个运营日报看板，列出该放哪些指标和图表", "这个看板太乱了，帮我重新排一下布局和层级"] },
      { slug: "kpi-dashboard-design", nameZh: "KPI 看板设计", intro: "要给团队设计 KPI 看板时用。写清每个指标的口径和数据来源。", prepare: "团队目标和现有数据", headline: "KPI 看板与指标口径", say: ["为销售团队设计一套 KPI 看板，包含目标完成率和趋势", "给每个 KPI 写清楚计算口径和数据来源"] },
    ],
  },
  {
    slug: "ppt",
    title: "PPT 与演示",
    tagline: "从方案到成品 PPT，汇报不再熬夜",
    shareTitle: "做 PPT 不熬夜：3 个必装的 WorkBuddy 技能",
    must: [
      { slug: "nexu-io-open-design-plugins-official-examples-guizang-ppt", nameZh: "杂志风网页 PPT", intro: "要做好看的分享页或产品介绍时用。生成能横向翻页的网页，手机电脑都能看。", prepare: "要讲的文字稿或要点", headline: "一句话出一份杂志风网页 PPT", say: ["把这份产品介绍做成杂志风的网页 PPT", "生成一份能在手机上横向翻页的分享页"] },
      { slug: "pptx-official", nameZh: "PPT 制作助手", intro: "要把方案做成 PPT，或统一现有 PPT 的样式时用。生成可编辑的 .pptx 文件。", prepare: "一份 Word 方案或现有 PPT", headline: "Word 方案 → 可编辑的 PPT", say: ["根据这份 Word 方案做一份 10 页的汇报 PPT", "把这份 PPT 的字体和配色统一一下"] },
      { slug: "pptx-deck-creation", nameZh: "PPT 故事线规划", intro: "要做需要说服别人的汇报时用。先帮你理清每页讲什么，再出整套 PPT。", prepare: "汇报对象和核心内容", headline: "先理故事线，再出整套 PPT", say: ["我要给客户讲新产品，先规划 PPT 的故事线，再生成可编辑的 PPTX", "检查这份 PPT 是不是每页只讲一个重点"] },
    ],
    more: [
      { slug: "nanobanana-ppt-skills", nameZh: "图文 PPT 生成", intro: "要把文章或文档做成图文并茂的 PPT 时用。", prepare: "一篇文章或文档", headline: "文章 → 图文并茂的 PPT", say: ["把这篇文章做成图文并茂的 PPT", "按科技风给这份大纲配图并生成演示文稿"] },
      { slug: "frontend-slides", nameZh: "网页动画幻灯片", intro: "要把 PPT 做成带动画、在浏览器里播放的演示时用。", prepare: "现有 PPT 或演示大纲", headline: "PPT → 带动画的网页演示", say: ["把这份 PPT 转成带动画的网页演示", "从零做一个 5 页的发布会网页幻灯片"] },
      { slug: "pitch-psychologist", nameZh: "提案说服力顾问", intro: "提案、路演前想让内容更容易被接受时用。指出会让人犹豫的地方。", prepare: "提案或路演稿", headline: "让提案更容易被接受", say: ["帮我调整这份提案的顺序，让客户更容易接受报价", "找出这份路演稿里会让投资人犹豫的地方"] },
    ],
  },
  {
    slug: "docs",
    title: "会议与写作",
    tagline: "会议纪要、录音转文字、周报通知",
    shareTitle: "会议纪要和周报交给 AI：3 个必装的 WorkBuddy 技能",
    must: [
      { slug: "meeting-notes", nameZh: "会议纪要助手", intro: "开完会要发纪要时用。按结论、决策、待办整理，每条待办写清负责人和截止时间。", prepare: "会议记录或录音转写稿", headline: "会议记录 → 结论、待办、负责人", say: ["把这段会议记录整理成纪要：结论、决策、待办和负责人", "从这份纪要里列出所有没写截止时间的待办"] },
      { slug: "audio-transcriber", nameZh: "录音转文字", intro: "有会议录音、采访视频要整理时用。转成文字稿，并生成摘要。", prepare: "一段录音或视频文件", headline: "录音、视频 → 文字稿和摘要", say: ["把这段会议录音转成文字，并生成摘要", "把这个采访视频转成带时间戳的文字稿"] },
      { slug: "internal-comms-anthropic", nameZh: "周报通知写手", intro: "要写周报、项目进展、全员通知时用。给它几条要点，它写成完整文稿。", prepare: "这周的几条要点或通知内容", headline: "几条要点 → 周报和全员通知", say: ["根据这些要点写一份本周项目进展周报", "写一份全员通知，说明下周起的新报销流程"] },
    ],
    more: [
      { slug: "meeting-distiller-pro", nameZh: "会议行动项提炼", intro: "会议转写稿很长、要抓出谁做什么时用。按负责人整理行动项。", prepare: "会议转写稿", headline: "转写稿 → 按人分组的行动项", say: ["把这份会议转写稿提炼成行动项清单，按负责人分组", "写一封会后跟进邮件发给参会人"] },
      { slug: "avoid-ai-writing", nameZh: "去 AI 腔改写", intro: "稿子读着像机器写的时用。找出套话和 AI 腔，改得更自然。", prepare: "要改的文稿", headline: "去掉 AI 腔，读着像人写的", say: ["把这段文字改得更像人写的，去掉 AI 腔", "检查这篇稿子里有哪些套话，逐条改掉"] },
      { slug: "docx-official", nameZh: "Word 批量编辑", intro: "要批量改 Word、提取表格或保留修订痕迹时用。", prepare: "一份或几份 Word 文件", headline: "批量改 Word、留修订痕迹", say: ["把这份合同里的「甲方」都改成公司全称，并保留修订痕迹", "把这几份 Word 里的表格提取出来汇总到一起"] },
      { slug: "pdf-official", nameZh: "PDF 合并拆分", intro: "要合并、拆分 PDF，或提取其中文字时用。", prepare: "要处理的 PDF 文件", headline: "PDF 合并、拆分、取文字", say: ["把这几个 PDF 合并成一个，按文件名排序", "提取这份 PDF 第 3 到 8 页的文字"] },
      { slug: "pdf-conversion-router", nameZh: "PDF 转可编辑", intro: "要把 PDF 报告转成能编辑的文档，或把表格提出来时用。", prepare: "要转换的 PDF", headline: "PDF → 可编辑文档和表格", say: ["把这份 PDF 报告转成可以编辑的文档，保留表格", "把扫描版 PDF 里的表格提取成 Excel"] },
    ],
  },
  {
    slug: "marketing",
    title: "新媒体与营销",
    tagline: "小红书、公众号、爆款拆解",
    shareTitle: "运营人必装：3 个 WorkBuddy 小红书和公众号技能",
    must: [
      { slug: "xiaohongshu-content-strategist", nameZh: "小红书笔记写手", intro: "要给产品写种草笔记，或笔记没流量想找原因时用。带标题和话题标签。", prepare: "产品卖点，或一篇已发的笔记", headline: "一个产品 → 带标题标签的小红书笔记", say: ["帮我写 3 篇推广这款护手霜的小红书笔记，要有标题和标签", "分析这篇笔记为什么没流量，给出改进建议"] },
      { slug: "wechat-official-account-strategist", nameZh: "公众号标题优化", intro: "公众号文章要起标题、调结构时用。会说明每个标题为什么能吸引人点开。", prepare: "文章正文或大纲", headline: "公众号标题和结构一次改好", say: ["给这篇公众号文章起 5 个标题，并说明各自的打开逻辑", "把这篇长文重新排结构，让开头 3 行就抓住读者"] },
      { slug: "linkdigest-social-link-reader", nameZh: "爆款链接拆解", intro: "看到爆款想学它的写法时用。把小红书、抖音等公开链接读成文字和要点。", prepare: "一个公开的笔记或视频链接", headline: "爆款链接 → 文字和爆点拆解", say: ["读一下这个小红书链接，总结它的爆点", "把这个抖音视频的字幕和要点提取出来"] },
    ],
    more: [
      { slug: "copywriting", nameZh: "营销文案写手", intro: "要写落地页、促销邮件文案时用。会先确认需求，不编造卖点。", prepare: "产品信息和目标用户", headline: "落地页和促销邮件文案", say: ["为新品落地页写一版文案：标题、卖点和行动按钮", "把这封促销邮件改得更有说服力，但不要夸大"] },
      { slug: "marketing-psychology", nameZh: "营销心理学顾问", intro: "活动或定价页想提升转化时用。用心理学找出最该改的地方。", prepare: "活动方案或页面内容", headline: "用心理学找出页面该改的地方", say: ["用心理学分析我们的定价页，找出最该改的 3 处", "给这次大促设计几个提升下单的小机制"] },
      { slug: "customer-research", nameZh: "用户调研分析", intro: "手上有用户评价、访谈记录要归纳时用。整理出痛点和用户画像。", prepare: "用户评价或访谈记录", headline: "用户评价 → 痛点和画像", say: ["从这 50 条用户评价里归纳出 5 个主要痛点", "根据这些访谈记录整理用户画像"] },
      { slug: "seo-content-writer", nameZh: "搜索友好文章", intro: "要写能被搜索到的长文时用。自然融入关键词，不堆砌。", prepare: "主题和目标关键词", headline: "搜索友好的长文", say: ["围绕「家用净水器怎么选」写一篇搜索友好的文章", "给这篇文章补上合适的关键词和小标题"] },
      { slug: "agricidaniel-claude-seo-skills-seo-sxo", nameZh: "搜索意图分析", intro: "页面搜不到，或想知道用户搜某个词想看什么时用。", prepare: "页面内容和目标关键词", headline: "页面和搜索词是否对得上", say: ["分析这个页面和目标关键词是否匹配，给出修改建议", "看看搜这个词的用户真正想要什么样的页面"] },
    ],
  },
  {
    slug: "finance",
    title: "财务与税务",
    tagline: "税务登记、财务预测、收款核销",
    shareTitle: "财务人必装的 3 个 WorkBuddy 技能：税务、预测、收款",
    must: [
      { slug: "tax-register", nameZh: "税额汇总表", intro: "报税前要汇总销项税、进项税时用。生成税额表，并列出申报截止日。", prepare: "本季度的发票或税额明细", headline: "季度税额和申报截止日一表看清", say: ["汇总本季度的销项税和进项税，算出应缴税额", "列出接下来 30 天的申报截止日"] },
      { slug: "startup-financial-modeling", nameZh: "财务预测模型", intro: "要做未来几年收入、成本、现金流预测时用。可出乐观、中性、悲观三种情景。", prepare: "收入和成本的基本假设", headline: "3 年收入成本预测，一次搭好", say: ["帮我搭一个 3 年的收入和成本预测模型", "做乐观、中性、悲观三种情景的现金流对比"] },
      { slug: "receipt-accounting", nameZh: "收款登记助手", intro: "要整理到账记录、核对哪些款还没核销时用。会区分客户回款和预付款。", prepare: "一批收款或银行到账记录", headline: "收款登记与未核销金额", say: ["把这批收款记录整理成收款登记表，标出未核销金额", "区分哪些是客户回款、哪些是预付款"] },
    ],
    more: [
      { slug: "sales-accounting", nameZh: "应收台账助手", intro: "要根据销售发票整理应收账款、找出逾期未收时用。", prepare: "销售发票明细", headline: "销售发票 → 应收台账", say: ["根据这些销售发票生成应收账款台账", "列出超过账期还没收回的发票"] },
      { slug: "startup-business-analyst-financial-projections", nameZh: "融资财务预测", intro: "要准备融资用的财务预测、测算现金能撑多久时用。", prepare: "业务假设和当前开支", headline: "融资用的财务预测", say: ["根据这些假设生成一份融资用的财务预测", "按现在的花钱速度，算算现金还能撑几个月"] },
      { slug: "anthropics-knowledge-work-plugins-finance-skills-reconciliation", nameZh: "银行对账助手", intro: "月底要把银行流水和总账对一遍时用。列出差异并按原因分类。", prepare: "银行流水和总账数据", headline: "银行流水对总账，差异自动列出来", say: ["把这个月的银行流水和总账对一下，列出差异", "把对不上的款项按原因分类"] },
    ],
  },
  {
    slug: "hr",
    title: "招聘与人事",
    tagline: "制度文件、招聘进度、绩效考核",
    shareTitle: "HR 必装的 3 个 WorkBuddy 技能：制度、招聘、绩效",
    must: [
      { slug: "hr-pro", nameZh: "HR 制度助手", intro: "要写入职流程、考勤请假制度等 HR 文件时用。覆盖从招聘到离职的常见场景。", prepare: "公司规模和要写的制度类型", headline: "入职、考勤、制度文件一次写好", say: ["帮我起草一份新员工入职流程清单", "写一份适合 50 人公司的考勤和请假制度"] },
      { slug: "recruitment-pipeline", nameZh: "招聘进度表", intro: "候选人多、进度乱时用。整理成按阶段分组的进度表，并统计各渠道效果。", prepare: "候选人名单和面试情况", headline: "候选人进度表自动整理", say: ["把这些候选人整理成招聘进度表，按阶段分组", "统计各招聘渠道的投递和录用数量"] },
      { slug: "performance-management", nameZh: "绩效考核助手", intro: "要设计考核表，或根据评分定等级时用。包含 KPI 和行为评分。", prepare: "岗位和考核周期，或已有评分", headline: "绩效考核表和评级", say: ["设计一套季度绩效考核表，包含 KPI 和行为评分", "根据这些评分给出绩效等级和改进建议"] },
    ],
    more: [
      { slug: "interview-coach", nameZh: "面试准备助手", intro: "要准备面试题、做模拟面试时用。招聘方和求职者都能用。", prepare: "岗位描述", headline: "面试题、模拟面试和反馈", say: ["根据这个岗位描述准备 10 个面试问题和参考答案", "模拟一场产品经理面试，结束后给我反馈"] },
      { slug: "cv-generator", nameZh: "简历优化助手", intro: "要按岗位改简历、把经历写得更有成果感时用。", prepare: "你的简历和目标岗位", headline: "按岗位优化简历", say: ["根据这份岗位描述优化我的简历", "把我的工作经历改写成更有成果感的描述"] },
      { slug: "employment-contract-templates", nameZh: "劳动合同模板", intro: "要起草录用通知、劳动合同要点时用。正式使用前请法务把关。", prepare: "岗位、薪资和试用期信息", headline: "录用通知和合同模板", say: ["生成一份录用通知书模板", "列出一份试用期劳动合同应包含的要点"] },
      { slug: "okr-system", nameZh: "OKR 制定助手", intro: "部门要定季度 OKR、检查关键结果能否衡量时用。", prepare: "部门目标或现有 OKR", headline: "部门 OKR 制定与检查", say: ["帮市场部制定下季度 OKR，每个目标 3 个关键结果", "检查这份 OKR 的关键结果是否可衡量"] },
      { slug: "leave-management", nameZh: "请假登记表", intro: "要整理请假申请、算出每人剩余年假时用。", prepare: "请假申请记录", headline: "请假登记与年假余额", say: ["把这个月的请假申请整理成表，算出每个人剩余年假", "列出下周请假的人和他们的交接人"] },
    ],
  },
  {
    slug: "sales",
    title: "销售与客户",
    tagline: "开发信、跟进邮件、销售话术",
    shareTitle: "销售必装的 3 个 WorkBuddy 技能：开发信、跟进、话术",
    must: [
      { slug: "cold-email", nameZh: "开发信写手", intro: "要给潜在客户写第一封邮件和后续跟进时用。写好主题行、开场和行动号召。", prepare: "客户是谁、你卖什么", headline: "一封开发信 + 两封跟进", say: ["给这家潜在客户写一封开发信和两封跟进邮件", "把这封开发信改短，提高回复率"] },
      { slug: "sales-automator", nameZh: "销售跟进助手", intro: "拜访完要写跟进邮件、报价说明或电话话术时用。", prepare: "拜访记录或产品介绍", headline: "拜访记录 → 跟进邮件和话术", say: ["根据这次拜访记录写一封跟进邮件和报价说明", "为我们的产品写一套电话销售话术"] },
      { slug: "sales-enablement", nameZh: "销售资料助手", intro: "要给团队准备一页纸介绍、异议应对话术时用。", prepare: "产品资料和常见客户问题", headline: "一页纸产品介绍和异议应对", say: ["做一页纸的产品介绍给销售团队用", "整理一份常见异议和应对话术"] },
    ],
    more: [
      { slug: "email-sequence", nameZh: "系列邮件设计", intro: "要设计欢迎、唤醒等一组连续邮件时用。", prepare: "客户类型和想达成的目标", headline: "欢迎、唤醒等系列邮件", say: ["设计一组 5 封的新客户欢迎邮件", "为很久没下单的老客户设计一组唤醒邮件"] },
      { slug: "offers", nameZh: "套餐方案设计", intro: "要设计套餐、赠品、限时优惠时用。", prepare: "产品和价格信息", headline: "套餐、赠品和限时优惠设计", say: ["帮我设计一个更有吸引力的套餐方案", "给这门课程设计赠品和限时优惠"] },
      { slug: "objection-preemptor", nameZh: "客户顾虑预判", intro: "写方案或销售页时，想提前化解客户顾虑时用。", prepare: "方案或销售页文稿", headline: "提前化解客户顾虑", say: ["客户可能对价格有哪些顾虑？帮我提前写进方案里", "找出这份销售页里让人犹豫的地方"] },
    ],
  },
  {
    slug: "pm",
    title: "产品与项目",
    tagline: "需求优先级、指标、想法梳理",
    shareTitle: "产品经理必装的 3 个 WorkBuddy 技能：需求、优先级、规划",
    must: [
      { slug: "product-manager-toolkit", nameZh: "需求整理助手", intro: "用户反馈一堆、需求要排优先级或写需求文档时用。", prepare: "用户反馈或需求列表", headline: "用户反馈 → 需求优先级和需求文档", say: ["把这些用户反馈整理成需求优先级列表", "帮我写一份新功能的需求文档"] },
      { slug: "product-manager", nameZh: "产品决策助手", intro: "要给需求排优先级、定成功指标时用。会用 RICE 等常见方法讲清理由。", prepare: "需求列表或要评估的功能", headline: "排优先级、定成功指标", say: ["用 RICE 方法给这 10 个需求排优先级", "设计一套衡量会员功能是否成功的指标"] },
      { slug: "idea-os", nameZh: "想法梳理助手", intro: "只有一个模糊想法、要变成方案时用。先问你几个问题，再写需求文档和计划。", prepare: "一句话描述你的想法", headline: "一个想法 → 需求文档和计划", say: ["我想做一个社区团购小程序，帮我梳理成需求文档和计划", "先问我几个问题，把这个想法想清楚"] },
    ],
    more: [],
  },
];

export function scenePicks(scene: Scene): ScenePick[] {
  return scene.must.concat(scene.more);
}

export function sceneBySlug(slug: string | undefined): Scene | null {
  return SCENES.find((scene) => scene.slug === slug) || null;
}

/** The scene a curated skill belongs to and its copy; null for skills outside the collections. */
export function scenePick(skillSlug: string | undefined): { scene: Scene; pick: ScenePick; must: boolean } | null {
  for (const scene of SCENES) {
    const must = scene.must.find((item) => item.slug === skillSlug);
    if (must) return { scene, pick: must, must: true };
    const more = scene.more.find((item) => item.slug === skillSlug);
    if (more) return { scene, pick: more, must: false };
  }
  return null;
}

/** The Chinese name of a curated skill, else its catalog name. */
export function skillDisplayName(skill: { slug: string; name: string }): string {
  return scenePick(skill.slug)?.pick.nameZh || skill.name;
}

/** One must-have skill per Beijing calendar day, cycling through every scene's must-haves in order. */
export function dailyPick(now: Date = new Date()): { scene: Scene; pick: ScenePick } {
  const all = SCENES.reduce<Array<{ scene: Scene; pick: ScenePick }>>((list, scene) => list.concat(scene.must.map((pick) => ({ scene, pick }))), []);
  const beijingDay = Math.floor((now.getTime() + 8 * 3600 * 1000) / 86400000);
  return all[((beijingDay % all.length) + all.length) % all.length];
}
