export const CATEGORY_ZH: Record<string, string> = {
  official: "官方",
  ai: "AI智能体",
  code: "编程开发",
  devops: "运维部署",
  security: "安全攻防",
  data: "数据分析",
  design: "设计创意",
  docs: "文档写作",
  office: "办公效率",
  research: "调研研究",
  misc: "其他",
};

export const CATEGORY_ICON: Record<string, string> = {
  official: "star",
  ai: "hardware-chip",
  code: "code-slash",
  devops: "server",
  security: "shield",
  data: "bar-chart",
  design: "color-palette",
  docs: "document-text",
  office: "briefcase",
  research: "search",
  misc: "grid",
};

export function categoryName(slug: string): string {
  return CATEGORY_ZH[slug] ?? slug;
}

export function categoryIcon(slug: string): string {
  return CATEGORY_ICON[slug] ?? "apps";
}
