import { trackPageView, trackShare } from "../../services/analytics";
import { currentEntryScene, markLandingSeen, shouldSkipLanding } from "../../services/landing";
import { APP_TITLE, enableShareMenu } from "../../services/share";

const PAGE = "pages/landing/index";
const SHARE_TITLE = `${APP_TITLE}：探索 AI 技能与趋势`;

Page({
  _redirected: false,

  onLoad(options: Record<string, string>) {
    if (shouldSkipLanding(options, currentEntryScene())) {
      this._redirected = true;
      wx.reLaunch({ url: "/pages/home/index", fail: () => { this._redirected = false; } });
      return;
    }
    enableShareMenu();
  },

  onShow() {
    if (this._redirected) return;
    trackPageView(PAGE);
  },

  onShareAppMessage() {
    trackShare(null, "menu", false, PAGE);
    return { title: SHARE_TITLE, path: "/pages/landing/index" };
  },

  onShareTimeline() {
    trackShare(null, "timeline", false, PAGE);
    return { title: SHARE_TITLE, query: "" };
  },

  markLandingEntered() {
    markLandingSeen();
  },
});
