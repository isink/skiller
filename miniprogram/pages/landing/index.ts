import { fetchSkill } from "../../services/api";
import { trackPageView, trackShare } from "../../services/analytics";
import { fetchDailyPick, fetchHotTool } from "../../services/recommendations";
import { SCENES } from "../../services/scenes";
import { APP_TITLE, enableShareMenu, shortPurpose, skillShareTitle } from "../../services/share";
import { renderShareCard } from "../../services/share-card";
import { copyInstall, skillInstallPlan } from "../../services/skill-install";
import { cacheSkill, readCache, writeCache } from "../../services/storage";
import { categoryName } from "../../services/presentation";
import { skillDescriptionZh } from "../../services/description-zh";
import { growthLabel } from "../../services/freshness";
import type { InstallPlan } from "../../services/skill-install";
import type { Skill } from "../../types/skill";

const PAGE = "pages/landing/index";
const SHARE_CANVAS = "#share-canvas";
const HOT_CACHE = "landing:hot-tool";

type HotPick = { skill: Skill; hot: boolean; label?: string; headline?: string };

function hotLabel(hot: boolean): string {
  return hot ? "今日热门工具" : "今日推荐工具";
}

Page({
  _hot: null as Skill | null,
  _plan: null as InstallPlan | null,
  _cardKey: "",
  _cardPath: "",
  _cardPromise: null as Promise<string | null> | null,
  data: {
    hotLoading: true,
    hotLabel: "今日热门工具",
    hotTool: null as { id: string; name: string; purpose: string; growth: string } | null,
    hotCopyLabel: "",
    scenes: SCENES.map((scene) => ({ slug: scene.slug, title: scene.title, tagline: scene.tagline })),
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
    if (cached?.skill?.id) this.showHotTool(cached.skill, cached.label || hotLabel(cached.hot), cached.hot ? growthLabel(cached.skill) : "", cached.headline);
    // Today's curated WorkBuddy skill first; star growth only when it cannot be loaded.
    try {
      const daily = await fetchDailyPick();
      if (daily) {
        const label = `今日推荐 · ${daily.sceneTitle}`;
        writeCache(HOT_CACHE, { skill: daily.skill, hot: false, label, headline: daily.headline });
        this.showHotTool(daily.skill, label, "", daily.headline);
        return;
      }
    } catch { /* Fall back to this week's hot skills. */ }
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

  showHotTool(skill: Skill, label: string, growth: string, headline?: string) {
    this._hot = skill;
    // The list row is enough: the WorkBuddy request needs only the name and source link.
    this._plan = skillInstallPlan(skill);
    const copyLabel = this._plan.installCopyLabel;
    this.setData({
      hotLoading: false,
      hotLabel: label,
      hotTool: {
        id: skill.id,
        name: skill.name,
        purpose: headline || shortPurpose(skillDescriptionZh(skill), 40),
        growth,
      },
      hotCopyLabel: copyLabel ? `一键${copyLabel}` : "",
    }, () => { this.ensureShareCard(); });
  },

  onCopyHotInstall() {
    const skill = this._hot;
    const plan = this._plan;
    if (!skill || !plan) return;
    if (!plan.installCommand) { this.openHotTool(); return; }
    copyInstall(skill, plan.installCommand, plan.installKind, "primary", PAGE);
  },

  openHotTool() {
    const skill = this._hot;
    if (skill) wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(skill.id)}` });
  },

  shareTitle(): string {
    const skill = this._hot;
    return skill ? skillShareTitle(skill.name, skillDescriptionZh(skill)) : `${APP_TITLE}：按岗位挑 WorkBuddy 技能`;
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

  openScene(event: { currentTarget: { dataset: { slug: string } } }) {
    wx.navigateTo({ url: `/pages/scene/index?slug=${encodeURIComponent(event.currentTarget.dataset.slug)}` });
  },

  navigateToSkills() {
    wx.navigateTo({ url: "/pages/home/index" });
  },

  navigateToOpenRadar() {
    wx.navigateTo({ url: "/pages/open-radar/index" });
  },
});
