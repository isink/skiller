import { trackPageView } from "../../services/analytics";
import { currentEntryScene, markLandingSeen, shouldSkipLanding } from "../../services/landing";

Page({
  _redirected: false,

  onLoad(options: Record<string, string>) {
    if (shouldSkipLanding(options, currentEntryScene())) {
      this._redirected = true;
      wx.redirectTo({ url: "/pages/home/index", fail: () => { this._redirected = false; } });
      return;
    }
    markLandingSeen();
  },

  onShow() {
    if (this._redirected) return;
    trackPageView("pages/landing/index");
  },

  navigateToSkills() {
    wx.navigateTo({ url: "/pages/home/index" });
  },

  navigateToRadar() {
    wx.navigateTo({ url: "/pages/radar/index" });
  },
});
