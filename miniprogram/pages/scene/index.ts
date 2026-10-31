import { fetchSkillsBySlugs } from "../../services/api";
import { trackEvent, trackPageView } from "../../services/analytics";
import type { ShareChannel } from "../../services/analytics";
import { enableShareMenu, shortPurpose } from "../../services/share";
import { renderShareCard } from "../../services/share-card";
import { copyInstall, copyText, skillInstallPlan, workbuddyBundlePrompt } from "../../services/skill-install";
import { readCache, writeCache } from "../../services/storage";
import { skillDescriptionZh } from "../../services/description-zh";
import { SCENES, sceneBySlug } from "../../services/scenes";
import type { Scene, ScenePick } from "../../services/scenes";
import type { Skill } from "../../types/skill";

const PAGE = "pages/scene/index";
const SHARE_CANVAS = "#share-canvas";

type SceneSkill = { id: string; name: string; purpose: string; say: string; copyLabel: string };

Page({
  _scene: null as Scene | null,
  _skills: [] as Skill[],
  _cardPromise: null as Promise<string | null> | null,
  _cardPath: "",
  data: {
    scene: null as Scene | null,
    skills: [] as SceneSkill[],
    others: [] as Array<{ slug: string; title: string }>,
    bundleReady: false,
    loading: true,
    error: "",
  },

  onLoad(options: { slug?: string }) {
    enableShareMenu();
    const scene = sceneBySlug(options.slug);
    this._scene = scene;
    if (!scene) { this.setData({ loading: false }); return; }
    wx.setNavigationBarTitle({ title: `${scene.title} · WorkBuddy 技能` });
    this.setData({
      scene,
      others: SCENES.filter((item) => item.slug !== scene.slug).map(({ slug, title }) => ({ slug, title })),
    });
    const cached = readCache<Skill[]>(`scene:${scene.slug}`);
    if (Array.isArray(cached) && cached.length) this.showSkills(cached);
    this.loadSkills();
  },

  onShow() {
    trackPageView(PAGE, this._scene ? { scene: this._scene.slug } : undefined);
  },

  async loadSkills() {
    const scene = this._scene;
    if (!scene) return;
    try {
      const skills = await fetchSkillsBySlugs(scene.picks.map((pick: ScenePick) => pick.slug));
      writeCache(`scene:${scene.slug}`, skills);
      this.showSkills(skills);
    } catch {
      this.setData({ loading: false, error: this._skills.length ? "网络不可用，显示缓存内容。" : "加载失败，请稍后重试。" });
    }
  },

  showSkills(skills: Skill[]) {
    const scene = this._scene;
    if (!scene) return;
    this._skills = skills;
    this.setData({
      loading: false,
      error: "",
      bundleReady: Boolean(workbuddyBundlePrompt(scene.title, skills)),
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        purpose: shortPurpose(skillDescriptionZh(skill), 48),
        say: scene.picks.find((pick: ScenePick) => pick.slug === skill.slug)?.say[0] || "",
        copyLabel: skillInstallPlan(skill).installCopyLabel,
      })),
    }, () => { this.ensureShareCard(); });
  },

  onCopyBundle() {
    const scene = this._scene;
    const prompt = scene ? workbuddyBundlePrompt(scene.title, this._skills) : "";
    if (!scene || !prompt) return;
    copyText(prompt, "已复制，粘贴给WorkBuddy就能装", 2200).then((ok) => {
      if (ok) trackEvent("copy_install", { page: PAGE, meta: { action: "copy_install", scene: scene.slug, kind: "workbuddy", target: "bundle" } });
    });
  },

  onCopySkill(event: { currentTarget: { dataset: { index: number } } }) {
    const skill = this._skills[Number(event.currentTarget.dataset.index)];
    if (!skill) return;
    const plan = skillInstallPlan(skill);
    if (plan.installCommand) copyInstall(skill, plan.installCommand, plan.installKind, "primary", PAGE);
  },

  openSkill(event: { currentTarget: { dataset: { id: string } } }) {
    wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },

  openScene(event: { currentTarget: { dataset: { slug: string } } }) {
    wx.redirectTo({ url: `/pages/scene/index?slug=${encodeURIComponent(event.currentTarget.dataset.slug)}` });
  },

  trackSceneShare(channel: ShareChannel, card: boolean) {
    const scene = this._scene;
    trackEvent("share", { page: PAGE, meta: scene ? { action: "share", scene: scene.slug, channel, card } : { action: "share", channel, card } });
  },

  ensureShareCard(): Promise<string | null> {
    const scene = this._scene;
    if (!scene) return Promise.resolve(null);
    if (this._cardPromise) return this._cardPromise;
    const promise = renderShareCard(SHARE_CANVAS, {
      name: scene.title,
      purpose: scene.shareTitle,
      stars: null,
      category: "WorkBuddy 技能合集",
    }).then((path) => {
      if (path) this._cardPath = path;
      else this._cardPromise = null;
      return path;
    });
    this._cardPromise = promise;
    return promise;
  },

  onShareAppMessage() {
    const scene = this._scene;
    if (!scene) return { title: "WorkBuddy 技能合集", path: "/pages/landing/index" };
    const title = scene.shareTitle;
    const path = `/pages/scene/index?slug=${encodeURIComponent(scene.slug)}`;
    this.trackSceneShare("menu", Boolean(this._cardPath));
    if (this._cardPath) return { title, path, imageUrl: this._cardPath };
    const promise = this.ensureShareCard().then((card: string | null) => (card ? { title, path, imageUrl: card } : { title, path }));
    return { title, path, promise };
  },

  onShareTimeline() {
    const scene = this._scene;
    this.trackSceneShare("timeline", false);
    return scene
      ? { title: scene.shareTitle, query: `slug=${encodeURIComponent(scene.slug)}` }
      : { title: "WorkBuddy 技能合集", query: "" };
  },
});
