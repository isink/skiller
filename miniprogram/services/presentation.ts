const CATEGORY_NAMES: Record<string, string> = {
  official: "官方精选", ai: "人工智能", code: "编程开发", data: "数据",
  devops: "DevOps", security: "安全", design: "设计", docs: "文档",
  office: "办公", research: "调研研究", misc: "其他",
};

export function categoryName(slug: string, fallback = slug): string {
  return CATEGORY_NAMES[slug] || fallback || slug;
}
