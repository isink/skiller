import { fetchTrendingTerms, TRENDING_PAGE_SIZE } from "../../services/trending-terms";
import type { TrendingTermDisplay } from "../../types/trending-term";

Page({
  data: {
    terms: [] as TrendingTermDisplay[],
    loading: true,
    error: "",
    hasMore: true,
    selectedTerm: null as TrendingTermDisplay | null,
    showDetail: false,
  },

  onLoad() {
    this.loadTerms();
  },

  async loadTerms() {
    this.setData({ loading: true, error: "" });
    try {
      const terms = await fetchTrendingTerms({ limit: TRENDING_PAGE_SIZE });
      this.setData({
        terms,
        loading: false,
        hasMore: terms.length >= TRENDING_PAGE_SIZE,
      });
    } catch (err) {
      this.setData({
        loading: false,
        error: "加载失败,请下拉重试",
      });
    }
  },

  onPullDownRefresh() {
    this.setData({ terms: [], hasMore: true });
    this.loadTerms().finally(() => wx.stopPullDownRefresh());
  },

  async onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({ loading: true });
    try {
      const newTerms = await fetchTrendingTerms({
        offset: this.data.terms.length,
        limit: TRENDING_PAGE_SIZE,
      });
      this.setData({
        terms: [...this.data.terms, ...newTerms],
        loading: false,
        hasMore: newTerms.length >= TRENDING_PAGE_SIZE,
      });
    } catch (err) {
      this.setData({ loading: false, error: "加载更多失败" });
    }
  },

  showTermDetail(event: { currentTarget: { dataset: { index: number } } }) {
    const index = event.currentTarget.dataset.index;
    const term = this.data.terms[index];
    if (term) {
      this.setData({ selectedTerm: term, showDetail: true });
    }
  },

  hideDetail() {
    this.setData({ showDetail: false });
  },
});
