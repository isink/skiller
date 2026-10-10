import { fetchCategories, fetchCategoryCounts, fetchFeatured, fetchSkills, searchSkills } from "../../services/api";
import { readCache, writeCache } from "../../services/storage";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { skillMetadata } from "../../services/skill-meta";
import type { Category, Skill } from "../../types/skill";

type HomeSkill = Skill & { displayDescription: string; displayCategory: string; displayStars: string; displayUpdated: string };
let searchTimer: number | undefined;
let searchSequence = 0;

function present(skill: Skill): HomeSkill {
  return {
    ...skill,
    displayDescription: skillDescriptionZh(skill),
    displayCategory: categoryName(skill.category),
    ...skillMetadata(skill),
  };
}

Page({
  data: {
    featured: [] as HomeSkill[],
    latest: [] as HomeSkill[],
    categories: [] as Category[],
    counts: {} as Record<string, number>,
    query: "",
    results: [] as HomeSkill[],
    searching: false,
    loading: true,
    error: "",
  },

  onLoad() {
    const featured = readCache<Skill[]>("home:featured");
    const latest = readCache<Skill[]>("home:latest");
    const categories = readCache<Category[]>("categories");
    const counts = readCache<Record<string, number>>("category-counts");
    if (featured || latest || categories || counts) {
      this.setData({
        featured: (featured || []).map(present),
        latest: (latest || []).map(present),
        categories: categories || [],
        counts: counts || {},
        loading: false,
      });
    }
    this.loadHome();
  },

  onUnload() { if (searchTimer !== undefined) clearTimeout(searchTimer); },

  async loadHome() {
    this.setData({ error: "" });
    const [freshFeatured, freshLatest, freshCategories, freshCounts] = await Promise.all([
      fetchFeatured(20).catch(() => null),
      fetchSkills({ limit: 10, orderBy: "created_at" }).catch(() => null),
      fetchCategories().catch(() => null),
      fetchCategoryCounts().catch(() => null),
    ]);
    const featured = freshFeatured ?? readCache<Skill[]>("home:featured") ?? [];
    const latest = freshLatest ?? readCache<Skill[]>("home:latest") ?? [];
    const categories = freshCategories ?? readCache<Category[]>("categories") ?? [];
    const counts = freshCounts ?? readCache<Record<string, number>>("category-counts") ?? {};
    if (freshFeatured) writeCache("home:featured", freshFeatured);
    if (freshLatest) writeCache("home:latest", freshLatest);
    if (freshCategories) writeCache("categories", freshCategories);
    if (freshCounts) writeCache("category-counts", freshCounts);
    const complete = freshFeatured !== null && freshLatest !== null && freshCategories !== null && freshCounts !== null;
    const hasCache = Boolean(readCache<Skill[]>("home:featured") || readCache<Skill[]>("home:latest"));
    this.setData({
      featured: featured.map(present), latest: latest.map(present), categories, counts,
      loading: false,
      error: complete ? "" : hasCache ? "部分内容未能更新，显示已缓存内容。" : "部分内容加载失败，请下拉重试。",
    });
  },

  onPullDownRefresh() {
    this.loadHome().finally(() => wx.stopPullDownRefresh());
  },

  onSearchInput(event: { detail: { value: string } }) {
    const query = event.detail.value;
    const sequence = ++searchSequence;
    this.setData({ query, results: [], error: "" });
    if (searchTimer !== undefined) clearTimeout(searchTimer);
    if (!query.trim()) { this.setData({ results: [], searching: false }); return; }
    this.setData({ searching: true });
    searchTimer = setTimeout(async () => {
      try {
        const rows = await searchSkills(query);
        if (sequence !== searchSequence) return;
        this.setData({ results: rows.map(present), searching: false });
      } catch {
        if (sequence !== searchSequence) return;
        this.setData({ results: [], searching: false, error: "搜索失败，请稍后重试。" });
      }
    }, 300);
  },

  onSearchConfirm() {
    if (searchTimer !== undefined) clearTimeout(searchTimer);
    this.onSearchInput({ detail: { value: this.data.query } });
  },

  clearSearch() {
    searchSequence++;
    if (searchTimer !== undefined) clearTimeout(searchTimer);
    this.setData({ query: "", results: [], searching: false, error: "" });
  },
  navigateToFavorites() {
    wx.navigateTo({ url: "/pages/favorites/index" });
  },
  openSkill(event: { currentTarget: { dataset: { id: string } } }) {
    wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },
  openCategory(event: { currentTarget: { dataset: { slug: string } } }) {
    wx.navigateTo({ url: `/pages/explore/index?category=${encodeURIComponent(event.currentTarget.dataset.slug)}` });
  },
  openAllCategories() { wx.navigateTo({ url: "/pages/explore/index" }); },
});
