import { fetchSkillsByIds } from "../../services/api";
import { cacheSkill, getFavoriteIds, readCache } from "../../services/storage";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { skillMetadata } from "../../services/skill-meta";
import { skillFreshness } from "../../services/freshness";
import { getRadarFavorites, removeRadarFavorite } from "../../services/radar-favorites";
import { shareFavorites } from "../../services/share";
import type { RadarFavorite } from "../../services/radar-favorites";
import type { Skill } from "../../types/skill";

type FavoriteSkill = Skill & { displayDescription: string; displayCategory: string; displayStars: string; displayUpdated: string; displayAdded: string };
function present(skill: Skill): FavoriteSkill {
  return { ...skill, displayDescription: skillDescriptionZh(skill), displayCategory: categoryName(skill.category), ...skillMetadata(skill), displayAdded: skillFreshness(skill).displayAdded };
}

type FavoriteTerm = RadarFavorite & { displaySummary: string };
function presentTerm(term: RadarFavorite): FavoriteTerm {
  return {
    ...term,
    displaySummary: term.summary_zh?.replace(/\s+/g, " ").trim() || "简介待补充",
  };
}

Page({
  data: {
    tab: "skills",
    skills: [] as FavoriteSkill[],
    radarFavorites: [] as FavoriteTerm[],
    loading: false,
    error: "",
  },
  _favoriteRequestSequence: 0,

  onLoad(query: { tab?: string }) {
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
    if (query.tab === "radar") this.setData({ tab: "radar" });
  },
  onShow() {
    this.setData({ radarFavorites: getRadarFavorites().map(presentTerm) });
    return this.loadFavorites();
  },
  onHide() { this._favoriteRequestSequence++; },
  onUnload() { this._favoriteRequestSequence++; },

  changeTab(event: { currentTarget: { dataset: { tab: string } } }) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== "skills" && tab !== "radar") return;
    this.setData({ tab });
  },

  async loadFavorites() {
    const sequence = ++this._favoriteRequestSequence;
    const ids = getFavoriteIds();
    if (!ids.length) { this.setData({ skills: [], loading: false, error: "" }); return; }
    const cached: Skill[] = [];
    ids.forEach((id) => {
      const skill = readCache<Skill>(`skill:${id}`);
      if (skill) cached.push(skill);
    });
    this.setData({ skills: cached.map(present), loading: cached.length === 0, error: "" });
    try {
      const rows = await fetchSkillsByIds(ids);
      if (sequence !== this._favoriteRequestSequence) return;
      rows.forEach(cacheSkill);
      const byId: Record<string, Skill> = {};
      rows.forEach((skill) => { byId[skill.id] = skill; });
      const ordered = ids.map((id) => byId[id]).filter((skill): skill is Skill => Boolean(skill));
      this.setData({ skills: ordered.map(present), loading: false, error: "" });
    } catch {
      if (sequence !== this._favoriteRequestSequence) return;
      this.setData({ loading: false, error: cached.length ? "离线显示已缓存的收藏。" : "收藏暂时无法加载，请检查网络。" });
    }
  },

  openSkill(event: { currentTarget: { dataset: { id: string } } }) {
    wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },

  removeTermFavorite(event: { currentTarget: { dataset: { term: string } } }) {
    const term = this.data.radarFavorites.find((item: FavoriteTerm) => item.term === event.currentTarget.dataset.term);
    if (!term) return;
    // Explicit removal also handles an item removed on another page, without
    // re-adding a stale snapshot or treating a failed read as an empty store.
    const result = removeRadarFavorite(term);
    if (!result.ok) {
      wx.showToast({ title: result.error || "收藏保存失败", icon: "none" });
      return;
    }
    this.setData({ radarFavorites: result.favorites.map(presentTerm) });
    wx.showToast({ title: "已取消收藏", icon: "none" });
  },

  onShareAppMessage() { return shareFavorites(); },
  onShareTimeline() { return shareFavorites(); },

});
