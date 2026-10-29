import { trackPageView, trackShare } from "../../services/analytics";
import { APP_TITLE, enableShareMenu } from "../../services/share";

const PAGE = "pages/landing/index";
const SHARE_TITLE = `${APP_TITLE}：探索 AI 技能与趋势`;

Page({
  onLoad() {
    enableShareMenu();
  },

  onShow() {
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

  navigateToSkills() {
    wx.navigateTo({ url: "/pages/home/index" });
  },

  navigateToOpenRadar() {
    wx.navigateTo({ url: "/pages/open-radar/index" });
  },
});
