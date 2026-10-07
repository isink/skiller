import { fetchSkillsByIds } from "../../services/api";
import { cacheSkill, getFavoriteIds, readCache } from "../../services/storage";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { skillMetadata } from "../../services/skill-meta";
import type { Skill } from "../../types/skill";

type FavoriteSkill = Skill & { displayDescription: string; displayCategory: string; displayStars: string; displayUpdated: string };
function present(skill: Skill): FavoriteSkill {
  return { ...skill, displayDescription: skillDescriptionZh(skill), displayCategory: categoryName(skill.category), ...skillMetadata(skill) };
}

Page({
  data: { skills: [] as FavoriteSkill[], loading: false, error: "" },

  onShow() { this.loadFavorites(); },

  async loadFavorites() {
    const ids = getFavoriteIds();
    if (!ids.length) { this.setData({ skills: [], loading: false, error: "" }); return; }
    const cached: Skill[] = [];
    ids.forEach((id) => {
      const skill = readCache<Skill>(`skill:${id}`);
      if (skill) cached.push(skill);
    });
    if (cached.length) this.setData({ skills: cached.map(present), loading: false });
    else this.setData({ loading: true, error: "" });
    try {
      const rows = await fetchSkillsByIds(ids);
      rows.forEach(cacheSkill);
      const byId: Record<string, Skill> = {};
      rows.forEach((skill) => { byId[skill.id] = skill; });
      const ordered = ids.map((id) => byId[id]).filter((skill): skill is Skill => Boolean(skill));
      this.setData({ skills: ordered.map(present), loading: false, error: "" });
    } catch {
      this.setData({ loading: false, error: cached.length ? "离线显示已缓存的收藏。" : "收藏暂时无法加载，请检查网络。" });
    }
  },

  openSkill(event: { currentTarget: { dataset: { id: string } } }) {
    wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },
});
