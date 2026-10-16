export const APP_TITLE = "头山 AI 工具箱";

export function enableShareMenu(): void {
  try { wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] }); }
  catch { /* Sharing is optional; the page works without the menu. */ }
}
