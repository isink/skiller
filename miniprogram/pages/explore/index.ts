import { fetchCategories, fetchCategoryCounts, fetchSkills, PAGE_SIZE } from "../../services/api";
import { readCache, writeCache } from "../../services/storage";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { skillMetadata } from "../../services/skill-meta";
import type { Category, Skill } from "../../types/skill";

type ExploreSkill = Skill & { displayDescription: string; displayCategory: string; displayStars: string; displayUpdated: string };
let pageRequestSequence = 0;
function present(skill: Skill): ExploreSkill {
  return { ...skill, displayDescription: skillDescriptionZh(skill), displayCategory: categoryName(skill.category), ...skillMetadata(skill) };
}

Page({
  data: {
    categories: [] as Category[],
    counts: {} as Record<string, number>,
    activeCategory: "",
    skills: [] as ExploreSkill[],
    offset: 0,
    loading: true,
    loadingMore: false,
    hasMore: true,
    error: "",
  },

  onLoad(options: { category?: string }) {
    const category = options.category || "";
    const categories = readCache<Category[]>("categories") || [];
    const counts = readCache<Record<string, number>>("category-counts") || {};
    const cached = readCache<Skill[]>(`explore:${category || "all"}:0`);
    this.setData({ categories, counts, activeCategory: category, skills: (cached || []).map(present), loading: !cached });
    this.loadCategories();
    this.loadPage(true);
  },

  async loadCategories() {
    try {
      const [categories, counts] = await Promise.all([fetchCategories(), fetchCategoryCounts()]);
      writeCache("categories", categories); writeCache("category-counts", counts);
      this.setData({ categories, counts });
    } catch { /* Cached categories remain usable. */ }
  },

  async loadPage(reset = false) {
    if (!reset && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) return;
    const sequence = ++pageRequestSequence;
    const category = this.data.activeCategory;
    const offset = reset ? 0 : this.data.offset;
    this.setData(reset ? { loading: true, loadingMore: false, error: "" } : { loadingMore: true, error: "" });
    try {
      const rows = await fetchSkills({ category: category || undefined, offset, limit: PAGE_SIZE });
      if (sequence !== pageRequestSequence) return;
      const combined = reset ? rows : [...this.data.skills, ...rows];
      if (reset) writeCache(`explore:${category || "all"}:0`, rows);
      this.setData({ skills: combined.map(present), offset: offset + rows.length, hasMore: rows.length === PAGE_SIZE, loading: false, loadingMore: false });
    } catch {
      if (sequence !== pageRequestSequence) return;
      this.setData({ loading: false, loadingMore: false, error: "加载失败，请下拉刷新重试。" });
    }
  },

  selectCategory(event: { currentTarget: { dataset: { slug: string } } }) {
    const slug = event.currentTarget.dataset.slug;
    if (slug === this.data.activeCategory) return;
    const cached = readCache<Skill[]>(`explore:${slug || "all"}:0`) || [];
    this.setData({ activeCategory: slug, skills: cached.map(present), offset: 0, hasMore: true, loading: cached.length === 0 });
    this.loadPage(true);
  },
  onReachBottom() { this.loadPage(false); },
  onPullDownRefresh() { this.loadPage(true).finally(() => wx.stopPullDownRefresh()); },
  openSkill(event: { currentTarget: { dataset: { id: string } } }) {
    wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },
});
