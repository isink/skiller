import { shareLanding } from "../../services/share";

Page({
  onLoad() {
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
  },

  navigateToSkills() {
    wx.navigateTo({ url: "/pages/home/index" });
  },

  navigateToRadar() {
    wx.navigateTo({ url: "/pages/radar/index" });
  },

  onShareAppMessage() { return shareLanding(); },
  onShareTimeline() { return shareLanding(); },
});
