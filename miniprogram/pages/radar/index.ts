import { fetchTrendingSnapshot, TRENDING_PAGE_SIZE } from "../../services/trending-terms";
import type { TrendingMode, TrendingSnapshot, TrendingTermDisplay } from "../../types/trending-term";
import { buildMonthDays, buildRecentDays, getLocalDateKey, isDateKey, shiftMonth } from "../../services/radar-calendar";
import { getRadarFavoriteNames, toggleRadarFavorite } from "../../services/radar-favorites";
import { trackPageView } from "../../services/analytics";
import { APP_TITLE, enableShareMenu } from "../../services/share";

const REFRESH_INTERVAL_MS = 60000;
type RadarTermRow = TrendingTermDisplay & { isFavorite: boolean };
const today = getLocalDateKey();
function withFavorites(terms: TrendingTermDisplay[]): RadarTermRow[] {
  const names = new Set(getRadarFavoriteNames());
  return terms.map((term) => ({ ...term, isFavorite: names.has(term.term) }));
}
function dateLabel(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}
function sameTerms(first: TrendingTermDisplay[], second: TrendingTermDisplay[]): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

Page({
  data: {
    mode: "github" as TrendingMode,
    terms: [] as RadarTermRow[],
    loading: true,
    error: "",
    hasMore: false,
    boardAvailable: true,
    displayCheckedAt: "",
    hasPendingUpdate: false,
    favoriteCount: 0,
    selectedDate: "",
    selectedDateLabel: "全部日期",
    today,
    calendarExpanded: false,
    calendarMonth: today.slice(0, 7),
    calendarMonthLabel: `${today.slice(0, 4)}年${Number(today.slice(5, 7))}月`,
    canNextMonth: false,
    weekdays: ["一", "二", "三", "四", "五", "六", "日"],
    recentDays: buildRecentDays(today, ""),
    monthDays: buildMonthDays(today.slice(0, 7), "", today),
  },
  _visible: false,
  _refreshTimer: 0,
  _requestSequence: 0,
  _fetchingSnapshot: false,
  _scrollTop: 0,
  _nextOffset: 0,
  _pendingSnapshot: null as TrendingSnapshot | null,

  onLoad() { enableShareMenu(); },

  onShareAppMessage() {
    return { title: `${APP_TITLE}：AI 新词雷达`, path: "/pages/radar/index" };
  },

  onShareTimeline() {
    return { title: `${APP_TITLE}：AI 新词雷达` };
  },

  onShow() {
    wx.setNavigationBarTitle({ title: "AI 新词雷达" });
    trackPageView("pages/radar/index");
    this._visible = true;
    this.syncFavorites();
    this.loadTerms(this.data.terms.length > 0);
  },

  onHide() { this.stopRefresh(); },
  onUnload() { this.stopRefresh(); },

  stopRefresh() {
    this._visible = false;
    this._requestSequence++;
    this._fetchingSnapshot = false;
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = 0;
  },

  scheduleRefresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    if (!this._visible) return;
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = 0;
      if (this._visible) this.loadTerms(true);
    }, REFRESH_INTERVAL_MS);
  },

  onPageScroll(event: { scrollTop: number }) { this._scrollTop = event.scrollTop; },

  updateCalendar(month = this.data.calendarMonth) {
    const today = getLocalDateKey();
    const safeMonth = month > today.slice(0, 7) ? today.slice(0, 7) : month;
    this.setData({
      today,
      calendarMonth: safeMonth,
      calendarMonthLabel: `${safeMonth.slice(0, 4)}年${Number(safeMonth.slice(5, 7))}月`,
      canNextMonth: safeMonth < today.slice(0, 7),
      selectedDateLabel: this.data.selectedDate ? dateLabel(this.data.selectedDate) : "全部日期",
      recentDays: buildRecentDays(today, this.data.selectedDate),
      monthDays: buildMonthDays(safeMonth, this.data.selectedDate, today),
    });
  },

  toggleCalendar() {
    const expanded = !this.data.calendarExpanded;
    this.setData({ calendarExpanded: expanded });
    if (expanded) this.updateCalendar((this.data.selectedDate || this.data.today).slice(0, 7));
  },

  moveCalendarMonth(event: { currentTarget: { dataset: { delta: number } } }) {
    const delta = Number(event.currentTarget.dataset.delta);
    if (delta !== -1 && delta !== 1) return;
    const month = shiftMonth(this.data.calendarMonth, delta);
    if (month > this.data.today.slice(0, 7) || month < "1900-01") return;
    this.updateCalendar(month);
  },

  changeCalendarMonth(event: { detail: { value: string } }) {
    const month = event.detail.value.slice(0, 7);
    if (!isDateKey(`${month}-01`) || month > this.data.today.slice(0, 7) || month < "1900-01") return;
    this.updateCalendar(month);
  },

  selectDate(event: { currentTarget: { dataset: { date: string } } }) {
    const date = event.currentTarget.dataset.date;
    if (!isDateKey(date) || date > this.data.today) return;
    this.setDateFilter(date);
  },

  clearDateFilter() { this.setDateFilter(""); },

  setDateFilter(selectedDate: string) {
    if (selectedDate === this.data.selectedDate) return;
    this._pendingSnapshot = null;
    this._nextOffset = 0;
    this._scrollTop = 0;
    this.setData({ selectedDate, terms: [], hasMore: false, hasPendingUpdate: false, error: "" });
    this.updateCalendar(selectedDate ? selectedDate.slice(0, 7) : this.data.calendarMonth);
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    this.loadTerms();
  },

  syncFavorites() {
    const names = new Set(getRadarFavoriteNames());
    this.setData({
      favoriteCount: names.size,
      terms: this.data.terms.map((term: RadarTermRow) => ({ ...term, isFavorite: names.has(term.term) })),
    });
  },

  toggleFavorite(event: { currentTarget: { dataset: { index?: number } } }) {
    const index = event.currentTarget.dataset.index;
    const term = index === undefined ? null : this.data.terms[Number(index)];
    if (!term) return;
    const result = toggleRadarFavorite(term);
    if (!result.ok) {
      wx.showToast({ title: result.error || "收藏保存失败", icon: "none" });
      return;
    }
    this.syncFavorites();
    wx.showToast({ title: result.isFavorite ? "已收藏" : "已取消收藏", icon: "none" });
  },

  openFavorites() { wx.navigateTo({ url: "/pages/favorites/index?tab=radar" }); },

  changeMode(event: { currentTarget: { dataset: { mode: TrendingMode } } }) {
    const mode = event.currentTarget.dataset.mode;
    if (!["github", "huggingface", "latest"].includes(mode) || mode === this.data.mode) return;
    this._pendingSnapshot = null;
    this._nextOffset = 0;
    this._scrollTop = 0;
    this.setData({ mode, terms: [], hasMore: false, hasPendingUpdate: false, displayCheckedAt: "", error: "" });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    this.loadTerms();
  },

  applySnapshot(snapshot: TrendingSnapshot) {
    this._nextOffset = snapshot.nextOffset;
    this._pendingSnapshot = null;
    this.setData({
      mode: snapshot.mode,
      terms: withFavorites(snapshot.terms),
      hasMore: snapshot.hasMore,
      boardAvailable: snapshot.boardAvailable,
      displayCheckedAt: snapshot.displayCheckedAt,
      hasPendingUpdate: false,
      error: "",
    });
  },

  async loadTerms(silent = false) {
    if (!this._visible) return;
    this.updateCalendar();
    const sequence = ++this._requestSequence;
    this._fetchingSnapshot = true;
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = 0;
    this.setData({ loading: !silent || this.data.terms.length === 0, error: "" });
    try {
      const snapshot = await fetchTrendingSnapshot({ mode: this.data.mode, discoveredDate: this.data.selectedDate, limit: TRENDING_PAGE_SIZE });
      if (!this._visible || sequence !== this._requestSequence) return;
      // Latest-discovered pages remain intact when the first page has not changed.
      const current = snapshot.mode === "latest" ? this.data.terms.slice(0, snapshot.terms.length) : this.data.terms;
      const endedEarlier = snapshot.mode === "latest" && !snapshot.hasMore && this.data.terms.length !== snapshot.terms.length;
      const changed = snapshot.mode !== this.data.mode || endedEarlier || !sameTerms(withFavorites(snapshot.terms), current);
      if (silent && snapshot.mode === this.data.mode && this.data.terms.length > 0) {
        if (changed && this._scrollTop > 100) {
          this._pendingSnapshot = snapshot;
          this.setData({ hasPendingUpdate: true, boardAvailable: snapshot.boardAvailable });
        } else if (changed) {
          this.applySnapshot(snapshot);
        } else {
          this._pendingSnapshot = null;
          this.setData({ hasPendingUpdate: false, boardAvailable: snapshot.boardAvailable, displayCheckedAt: snapshot.displayCheckedAt });
        }
      } else {
        this.applySnapshot(snapshot);
      }
    } catch {
      if (!this._visible || sequence !== this._requestSequence) return;
      this.setData({ error: this.data.terms.length ? "暂时无法刷新，当前显示上次加载的数据" : "加载失败，请下拉重试" });
    } finally {
      if (this._visible && sequence === this._requestSequence) {
        this._fetchingSnapshot = false;
        this.setData({ loading: false });
        this.scheduleRefresh();
      }
    }
  },

  showUpdatedBoard() {
    if (!this._pendingSnapshot) return;
    this.applySnapshot(this._pendingSnapshot);
    this._scrollTop = 0;
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  onPullDownRefresh() {
    this._pendingSnapshot = null;
    this.setData({ hasPendingUpdate: false });
    this.loadTerms().finally(() => wx.stopPullDownRefresh());
  },

  async onReachBottom() {
    if (!this._visible || this.data.mode !== "latest" || !this.data.hasMore || this.data.loading || this._fetchingSnapshot) return;
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = 0;
    const sequence = ++this._requestSequence;
    this.setData({ loading: true, error: "" });
    try {
      const snapshot = await fetchTrendingSnapshot({ mode: "latest", discoveredDate: this.data.selectedDate, offset: this._nextOffset, limit: TRENDING_PAGE_SIZE });
      if (!this._visible || sequence !== this._requestSequence || this.data.mode !== "latest") return;
      const existing = new Set(this.data.terms.map((term: TrendingTermDisplay) => term.term));
      const fresh = snapshot.terms.filter((term) => !existing.has(term.term));
      this._nextOffset = snapshot.nextOffset;
      this.setData({ terms: [...this.data.terms, ...withFavorites(fresh)], hasMore: snapshot.hasMore, boardAvailable: snapshot.boardAvailable });
    } catch {
      if (this._visible && sequence === this._requestSequence) this.setData({ error: "加载更多失败，请上拉重试" });
    } finally {
      if (this._visible && sequence === this._requestSequence) {
        this.setData({ loading: false });
        this.scheduleRefresh();
      }
    }
  },

});
