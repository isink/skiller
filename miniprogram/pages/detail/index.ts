import { fetchSkill } from "../../services/api";
import { cacheSkill, cachedSkill, getFavoriteIds, toggleFavorite } from "../../services/storage";
import { trackCopyInstall, trackFeedback, trackPageView, trackShare } from "../../services/analytics";
import { saveSkillVote, skillVote } from "../../services/skill-votes";
import type { SkillVote } from "../../services/skill-votes";
import type { ShareChannel } from "../../services/analytics";
import { APP_TITLE, enableShareMenu, shortPurpose, skillShareTitle } from "../../services/share";
import { renderShareCard } from "../../services/share-card";
import { parseMarkdown } from "../../services/markdown";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { skillMetadata } from "../../services/skill-meta";
import { copyInstall as copyInstallCommand, copyText, skillInstallPlan, skillLicense } from "../../services/skill-install";
import { scenePick } from "../../services/scenes";
import type { Skill, SkillBlock } from "../../types/skill";

const SHARE_CANVAS = "#share-canvas";

Page({
  _id: "",
  _cardKey: "",
  _cardPath: "",
  _cardPromise: null as Promise<string | null> | null,
  /** The SKILL.md text, kept off `data` so it is not sent to the view twice. */
  _markdown: "",
  /** The markdown text the rendered `blocks` came from; null before the first render. */
  _blocksFor: null as string | null,
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
    vote: "" as SkillVote | "",
    displayName: "",
    englishName: "",
    usagePrepare: "",
    usageExample: null as { input: string; output: string } | null,
    markdownOpen: true,
    altsOpen: false,
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
    if (!skill) return APP_TITLE;
    return skillShareTitle(this.data.displayName || skill.name, this.data.usageHeadline || this.data.displayDescription);
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
      name: this.data.displayName || skill.name,
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
    const curated = scenePick(skill.slug);
    const displayName = curated?.pick.nameZh || skill.name;
    wx.setNavigationBarTitle({ title: displayName });
    // Curated skills lead with the Chinese copy; the English SKILL.md starts folded.
    // A refresh after the cached copy keeps whatever the reader chose.
    const markdownOpen = this.data.skill ? this.data.markdownOpen : !curated;
    this._markdown = skill.skill_md_content || "";
    this.setData({
      usageSay: curated ? curated.pick.say : [],
      vote: skillVote(skill.id),
      usageHeadline: curated ? curated.pick.headline : "",
      displayName,
      englishName: curated?.pick.nameZh ? skill.name : "",
      usagePrepare: curated?.pick.prepare || "",
      usageExample: curated?.pick.example || null,
      markdownOpen,
      usageScene: curated ? { slug: curated.scene.slug, title: curated.scene.title } : null,
      // The view only needs the list fields; the SKILL.md text stays in `_markdown`.
      skill: { ...skill, skill_md_content: null },
      // Curated skills read the hand-written intro instead of the machine summary.
      displayDescription: curated?.pick.intro || skillDescriptionZh(skill),
      displayCategory: categoryName(skill.category),
      displayLicense: skillLicense(skill.skill_md_content),
      ...skillMetadata(skill),
      ...skillInstallPlan(skill),
      ...this.blocksPatch(markdownOpen),
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

  onVote(event: { currentTarget: { dataset: { vote: SkillVote } } }) {
    const skill = this.data.skill as Skill | null;
    const vote = event.currentTarget.dataset.vote;
    if (!skill || this.data.vote || (vote !== "up" && vote !== "down")) return;
    saveSkillVote(skill.id, vote);
    this.setData({ vote });
    trackFeedback(skill, vote);
  },

  /** Parses and sends the SKILL.md only while it is shown, and only when its text changed. */
  blocksPatch(open: boolean): { blocks?: SkillBlock[] } {
    if (!open || this._blocksFor === this._markdown) return {};
    this._blocksFor = this._markdown;
    return { blocks: parseMarkdown(this._markdown || "暂未提供技能说明。") };
  },

  /** Terminal commands matter only to Claude Code users, so they start folded under the WorkBuddy request. */
  onToggleAlternatives() {
    this.setData({ altsOpen: !this.data.altsOpen });
  },

  onToggleMarkdown() {
    const open = !this.data.markdownOpen;
    this.setData({ markdownOpen: open, ...this.blocksPatch(open) });
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

  onToggleFavorite() {
    const skill = this.data.skill as Skill | null;
    if (!skill) return;
    const ids = toggleFavorite(skill.id);
    this.setData({ favorited: ids.includes(skill.id) });
    wx.showToast({ title: ids.includes(skill.id) ? "已收藏" : "已取消收藏", icon: "none" });
  },
});
