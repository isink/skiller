import { fetchSkill } from "../../services/api";
import { cacheSkill, cachedSkill, getFavoriteIds, toggleFavorite } from "../../services/storage";
import { parseMarkdown } from "../../services/markdown";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { skillMetadata } from "../../services/skill-meta";
import { skillInstallCommand } from "../../services/skill-install";
import { shareSkillDetail } from "../../services/share";
import type { Skill, SkillBlock } from "../../types/skill";

Page({
  data: {
    skill: null as Skill | null,
    displayDescription: "",
    displayStars: "",
    displayUpdated: "",
    installCommand: "",
    installHint: "",
    blocks: [] as SkillBlock[],
    favorited: false,
    loading: true,
    error: "",
  },

  onLoad(options: { id?: string }) {
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
    const id = options.id || "";
    if (!id) { this.setData({ loading: false, error: "没有找到这个技能。" }); return; }
    const cached = cachedSkill(id);
    if (cached) this.showSkill(cached, false);
    this.setData({ favorited: getFavoriteIds().includes(id), loading: !cached });
    fetchSkill(id).then((skill) => {
      if (!skill) { this.setData({ loading: false, error: "这个技能不存在或已下架。" }); return; }
      cacheSkill(skill);
      this.showSkill(skill, true);
    }).catch(() => {
      this.setData({ loading: false, error: cached ? "网络不可用，显示缓存内容。" : "加载失败，请返回后重试。" });
    });
  },

  showSkill(skill: Skill, clearError: boolean) {
    this.setData({
      skill,
      displayDescription: skillDescriptionZh(skill),
      displayCategory: categoryName(skill.category),
      ...skillMetadata(skill),
      ...skillInstallCommand(skill),
      blocks: parseMarkdown(skill.skill_md_content || "暂未提供技能说明。"),
      loading: false,
      error: clearError ? "" : this.data.error,
    });
  },

  onCopyInstall() {
    const command = this.data.installCommand;
    if (!command) return;
    wx.setClipboardData({
      data: command,
      success: () => wx.showToast({ title: "安装命令已复制", icon: "none" }),
      fail: () => wx.showToast({ title: "复制失败，请长按命令复制", icon: "none" }),
    });
  },

  onToggleFavorite() {
    const skill = this.data.skill as Skill | null;
    if (!skill) return;
    const ids = toggleFavorite(skill.id);
    this.setData({ favorited: ids.includes(skill.id) });
    wx.showToast({ title: ids.includes(skill.id) ? "已收藏" : "已取消收藏", icon: "none" });
  },

  onShareAppMessage() {
    const skill = this.data.skill as Skill | null;
    if (!skill) return { title: "头山 AI 工具箱", path: "/pages/home/index" };
    return shareSkillDetail(skill);
  },

  onShareTimeline() {
    const skill = this.data.skill as Skill | null;
    if (!skill) return { title: "头山 AI 工具箱", path: "/pages/home/index" };
    return shareSkillDetail(skill);
  },
});
