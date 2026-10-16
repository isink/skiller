import { trackPageView } from "../../services/analytics";

Page({
  onShow() {
    trackPageView("pages/landing/index");
  },

  navigateToSkills() {
    wx.navigateTo({ url: "/pages/home/index" });
  },

  navigateToRadar() {
    wx.navigateTo({ url: "/pages/radar/index" });
  },
});
