import { fetchSkill } from "../../services/api";
import { cacheSkill, cachedSkill, getFavoriteIds, toggleFavorite } from "../../services/storage";
import { trackCopyInstall, trackPageView, trackShare } from "../../services/analytics";
import type { ShareChannel } from "../../services/analytics";
import { APP_TITLE, enableShareMenu, shortPurpose, skillShareTitle } from "../../services/share";
import { renderShareCard } from "../../services/share-card";
import { parseMarkdown } from "../../services/markdown";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { skillMetadata } from "../../services/skill-meta";
import { copyInstall as copyInstallCommand, copyText, skillInstallPlan, skillLicense } from "../../services/skill-install";
import { feedbackNotice } from "../../services/feedback";
import { scenePick } from "../../services/scenes";
import type { Skill, SkillBlock } from "../../types/skill";

const SHARE_CANVAS = "#share-canvas";

Page({
  _id: "",
  _cardKey: "",
  _cardPath: "",
  _cardPromise: null as Promise<string | null> | null,
  data: {
    skill: null as Skill | null,
    displayDescription: "",
    displayStars: "",
    displayUpdated: "",
    displayLicense: "",
    installCommand: "",
    installHint: "",
    installKind: "none",
    installCopyLabel: "",
    installSteps: [] as string[],
    installAlternatives: [] as Array<{ label: string; command: string }>,
    sourceUrl: "",
    usageSay: [] as string[],
    usageHeadline: "",
    usageExample: null as { input: string; output: string } | null,
    markdownOpen: true,
    usageScene: null as { slug: string; title: string } | null,
    blocks: [] as SkillBlock[],
    favorited: false,
    loading: true,
    error: "",
  },

  onLoad(options: { id?: string }) {
    const id = options.id || "";
    this._id = id;
    enableShareMenu();
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

  onShow() {
    trackPageView("pages/detail/index", this._id ? { id: this._id } : undefined);
  },

  sharePath(): string {
    const skill = this.data.skill as Skill | null;
    const id = skill?.id || this._id;
    return id ? `/pages/detail/index?id=${encodeURIComponent(id)}` : "/pages/home/index";
  },

  shareTitle(): string {
    const skill = this.data.skill as Skill | null;
    return skill ? skillShareTitle(skill.name, this.data.displayDescription) : APP_TITLE;
  },

  onShareAppMessage(event?: { from?: string }) {
    const skill = this.data.skill as Skill | null;
    const title = this.shareTitle();
    const path = this.sharePath();
    if (!skill) return { title, path };
    const ready = this._cardPath && this._cardKey === this.cardKey() ? this._cardPath : "";
    const channel: ShareChannel = event?.from === "button" ? "button" : "menu";
    trackShare(skill, channel, Boolean(ready));
    if (ready) return { title, path, imageUrl: ready };
    // The share sheet waits up to three seconds; a failed card keeps the default image.
    const promise = this.ensureShareCard().then((card: string | null) => (card ? { title, path, imageUrl: card } : { title, path }));
    return { title, path, promise };
  },

  onShareTimeline() {
    const skill = this.data.skill as Skill | null;
    const id = skill?.id || this._id;
    if (skill) trackShare(skill, "timeline", false);
    return {
      title: this.shareTitle(),
      query: id ? `id=${encodeURIComponent(id)}` : "",
    };
  },

  cardKey(): string {
    const skill = this.data.skill as Skill | null;
    return skill ? `${skill.id}|${skill.name}|${this.data.displayDescription}|${skill.github_stars ?? ""}` : "";
  },

  /** Renders the 5:4 cover once per skill state; resolves to null when it cannot be drawn. */
  ensureShareCard(): Promise<string | null> {
    const skill = this.data.skill as Skill | null;
    const key = this.cardKey();
    if (!skill || !key) return Promise.resolve(null);
    if (this._cardPromise && this._cardKey === key) return this._cardPromise;
    this._cardKey = key;
    this._cardPath = "";
    const promise = renderShareCard(SHARE_CANVAS, {
      name: skill.name,
      purpose: shortPurpose(this.data.displayDescription, 56) || APP_TITLE,
      stars: skill.github_stars ?? null,
      category: categoryName(skill.category),
    }).then((path) => {
      if (this._cardKey === key) {
        if (path) this._cardPath = path;
        else this._cardPromise = null;
      }
      return path;
    });
    this._cardPromise = promise;
    return promise;
  },

  showSkill(skill: Skill, clearError: boolean) {
    wx.setNavigationBarTitle({ title: skill.name });
    const curated = scenePick(skill.slug);
    this.setData({
      usageSay: curated ? curated.pick.say : [],
      usageHeadline: curated ? curated.pick.headline : "",
      usageExample: curated?.pick.example || null,
      // Curated skills lead with the Chinese copy; the English SKILL.md starts folded.
      // A refresh after the cached copy keeps whatever the reader chose.
      markdownOpen: this.data.skill ? this.data.markdownOpen : !curated,
      usageScene: curated ? { slug: curated.scene.slug, title: curated.scene.title } : null,
      skill,
      displayDescription: skillDescriptionZh(skill),
      displayCategory: categoryName(skill.category),
      displayLicense: skillLicense(skill.skill_md_content),
      ...skillMetadata(skill),
      ...skillInstallPlan(skill),
      blocks: parseMarkdown(skill.skill_md_content || "暂未提供技能说明。"),
      loading: false,
      error: clearError ? "" : this.data.error,
    }, () => { this.ensureShareCard(); });
  },

  copyInstall(command: string, target: "primary" | "alternative") {
    const skill = this.data.skill as Skill | null;
    if (!skill || !command) return;
    copyInstallCommand(skill, command, this.data.installKind, target, "pages/detail/index");
  },

  onCopyInstall() {
    this.copyInstall(this.data.installCommand, "primary");
  },

  onCopyAlternative(event: { currentTarget: { dataset: { index: number } } }) {
    const option = this.data.installAlternatives[Number(event.currentTarget.dataset.index)];
    if (option) this.copyInstall(option.command, "alternative");
  },

  onToggleMarkdown() {
    this.setData({ markdownOpen: !this.data.markdownOpen });
  },

  onCopyUsage(event: { currentTarget: { dataset: { index: number } } }) {
    const skill = this.data.skill as Skill | null;
    const say = this.data.usageSay[Number(event.currentTarget.dataset.index)];
    if (!skill || !say) return;
    copyText(say, "已复制，装好技能后发给WorkBuddy").then((ok) => {
      if (ok) trackCopyInstall(skill, "workbuddy", "usage");
    });
  },

  openScene(event: { currentTarget: { dataset: { slug: string } } }) {
    const slug = event.currentTarget.dataset.slug;
    if (slug) wx.navigateTo({ url: `/pages/scene/index?slug=${encodeURIComponent(slug)}` });
  },

  onCopySource() {
    const skill = this.data.skill as Skill | null;
    const url = this.data.sourceUrl;
    if (!skill || !url) return;
    copyText(url, "原链接已复制").then((ok) => {
      if (ok) trackCopyInstall(skill, this.data.installKind, "source_link");
    });
  },

  onFeedback() {
    const skill = this.data.skill as Skill | null;
    if (!skill) return;
    const notice = feedbackNotice(skill);
    wx.showModal({
      title: notice.title,
      content: notice.content,
      confirmText: "复制邮箱",
      cancelText: "关闭",
      success: (result: { confirm?: boolean }) => {
        if (result.confirm) copyText(notice.email, "邮箱已复制");
      },
    });
  },

  onToggleFavorite() {
    const skill = this.data.skill as Skill | null;
    if (!skill) return;
    const ids = toggleFavorite(skill.id);
    this.setData({ favorited: ids.includes(skill.id) });
    wx.showToast({ title: ids.includes(skill.id) ? "已收藏" : "已取消收藏", icon: "none" });
  },
});
