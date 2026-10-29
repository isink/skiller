import { fetchSkill } from "../../services/api";
import { trackPageView, trackShare } from "../../services/analytics";
import { fetchHotTool } from "../../services/recommendations";
import { APP_TITLE, enableShareMenu, shortPurpose, skillShareTitle } from "../../services/share";
import { renderShareCard } from "../../services/share-card";
import { copyInstall, isLinkOnlySkill, skillInstallPlan } from "../../services/skill-install";
import { cacheSkill, cachedSkill, readCache, writeCache } from "../../services/storage";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { growthLabel } from "../../services/freshness";
import type { InstallPlan } from "../../services/skill-install";
import type { Skill } from "../../types/skill";

const PAGE = "pages/landing/index";
const SHARE_CANVAS = "#share-canvas";
const HOT_CACHE = "landing:hot-tool";
const COPY_LABEL = "一键复制安装命令";
const LINK_LABEL = "一键复制 GitHub 链接";
// Lets the failure toast be read before the detail page replaces it.
const TOAST_BEFORE_NAVIGATE_MS = 1200;

type HotPick = { skill: Skill; hot: boolean };

function hotLabel(hot: boolean): string {
  return hot ? "今日热门工具" : "今日推荐工具";
}

Page({
  _hot: null as Skill | null,
  _linkOnly: false,
  _copying: false,
  _planId: "",
  _planPromise: null as Promise<InstallPlan | null> | null,
  _cardKey: "",
  _cardPath: "",
  _cardPromise: null as Promise<string | null> | null,
  data: {
    hotLoading: true,
    hotLabel: "今日热门工具",
    hotTool: null as { id: string; name: string; purpose: string; growth: string } | null,
    hotCopyLabel: COPY_LABEL,
  },

  onLoad(options: Record<string, string>) {
    enableShareMenu();
    this.loadHotTool(options.id);
  },

  onShow() {
    trackPageView(PAGE);
  },

  /** A shared link names a tool; show that one instead of today's pick. */
  async loadHotTool(sharedId?: string) {
    if (sharedId) {
      try {
        const shared = await fetchSkill(sharedId);
        if (shared) {
          cacheSkill(shared);
          this.showHotTool(shared, "好友推荐的工具", "");
          return;
        }
      } catch { /* Fall back to today's pick. */ }
    }
    const cached = readCache<HotPick>(HOT_CACHE);
    if (cached?.skill?.id) this.showHotTool(cached.skill, hotLabel(cached.hot), cached.hot ? growthLabel(cached.skill) : "");
    try {
      const pick = await fetchHotTool();
      if (pick) {
        writeCache(HOT_CACHE, pick);
        this.showHotTool(pick.skill, hotLabel(pick.hot), pick.hot ? growthLabel(pick.skill) : "");
        return;
      }
    } catch { /* The card is optional; the tool grid below stays usable. */ }
    if (!cached?.skill?.id) this.setData({ hotLoading: false });
  },

  showHotTool(skill: Skill, label: string, growth: string) {
    this._hot = skill;
    this._linkOnly = isLinkOnlySkill(skill);
    this.setData({
      hotLoading: false,
      hotLabel: label,
      hotTool: {
        id: skill.id,
        name: skill.name,
        purpose: shortPurpose(skillDescriptionZh(skill), 40),
        growth,
      },
      hotCopyLabel: this._linkOnly ? LINK_LABEL : COPY_LABEL,
    }, () => { this.ensureShareCard(); });
  },

  /** The list row has no SKILL.md, so the install command needs the full skill; fetched only when the user asks to copy. */
  ensurePlan(): Promise<InstallPlan | null> {
    const skill = this._hot;
    if (!skill) return Promise.resolve(null);
    if (this._planPromise && this._planId === skill.id) return this._planPromise;
    this._planId = skill.id;
    const cached = cachedSkill(skill.id);
    const full = cached?.skill_md_content
      ? Promise.resolve(cached)
      : fetchSkill(skill.id).then((fetched) => { if (fetched) cacheSkill(fetched); return fetched; });
    const promise = full.then((loaded) => (loaded ? skillInstallPlan(loaded) : null)).catch(() => null).then((plan) => {
      if (!plan && this._planId === skill.id) this._planPromise = null;
      return plan;
    });
    this._planPromise = promise;
    return promise;
  },

  async onCopyHotInstall() {
    const skill = this._hot;
    if (!skill || this._copying) return;
    this._copying = true;
    try {
      let plan: InstallPlan | null;
      if (this._linkOnly) {
        plan = skillInstallPlan(skill);
      } else {
        wx.showLoading({ title: "正在获取安装命令", mask: true });
        try { plan = await this.ensurePlan(); }
        finally { wx.hideLoading(); }
      }
      if (!plan || !plan.installCommand) {
        this.openHotToolAfterNotice(plan ? "暂无安装命令，带你去详情页看看" : "网络不佳，带你去详情页复制");
        return;
      }
      await copyInstall(skill, plan.installCommand, plan.installKind, "primary", PAGE);
    } finally {
      this._copying = false;
    }
  },

  openHotToolAfterNotice(title: string) {
    wx.showToast({ title, icon: "none", duration: TOAST_BEFORE_NAVIGATE_MS });
    setTimeout(() => this.openHotTool(), TOAST_BEFORE_NAVIGATE_MS);
  },

  openHotTool() {
    const skill = this._hot;
    if (skill) wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(skill.id)}` });
  },

  shareTitle(): string {
    const skill = this._hot;
    return skill ? skillShareTitle(skill.name, skillDescriptionZh(skill)) : `${APP_TITLE}：探索 AI 技能与趋势`;
  },

  sharePath(): string {
    const skill = this._hot;
    return skill ? `/pages/detail/index?id=${encodeURIComponent(skill.id)}` : "/pages/landing/index";
  },

  onShareAppMessage() {
    const skill = this._hot;
    const title = this.shareTitle();
    const path = this.sharePath();
    if (!skill) { trackShare(null, "menu", false, PAGE); return { title, path }; }
    const ready = this._cardPath && this._cardKey === this.cardKey() ? this._cardPath : "";
    trackShare(skill, "menu", Boolean(ready), PAGE);
    if (ready) return { title, path, imageUrl: ready };
    // The share sheet waits up to three seconds; a failed card keeps the default image.
    const promise = this.ensureShareCard().then((card: string | null) => (card ? { title, path, imageUrl: card } : { title, path }));
    return { title, path, promise };
  },

  onShareTimeline() {
    const skill = this._hot;
    trackShare(skill, "timeline", false, PAGE);
    return { title: this.shareTitle(), query: skill ? `id=${encodeURIComponent(skill.id)}` : "" };
  },

  cardKey(): string {
    const skill = this._hot;
    return skill ? `${skill.id}|${skill.name}|${skillDescriptionZh(skill)}|${skill.github_stars ?? ""}` : "";
  },

  ensureShareCard(): Promise<string | null> {
    const skill = this._hot;
    const key = this.cardKey();
    if (!skill || !key) return Promise.resolve(null);
    if (this._cardPromise && this._cardKey === key) return this._cardPromise;
    this._cardKey = key;
    this._cardPath = "";
    const promise = renderShareCard(SHARE_CANVAS, {
      name: skill.name,
      purpose: shortPurpose(skillDescriptionZh(skill), 56) || APP_TITLE,
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

  navigateToSkills() {
    wx.navigateTo({ url: "/pages/home/index" });
  },

  navigateToRadar() {
    wx.navigateTo({ url: "/pages/radar/index" });
  },
});
