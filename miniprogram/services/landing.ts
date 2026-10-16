const LANDING_SEEN_KEY = "skiller.miniprogram.landing-seen.v1";
// Share card, group card, share ticket and moments single-page entries.
const SHARE_SCENES = [1007, 1008, 1044, 1155];

export function hasSeenLanding(): boolean {
  try { return wx.getStorageSync(LANDING_SEEN_KEY) === true; }
  catch { return false; }
}

export function markLandingSeen(): void {
  try { wx.setStorageSync(LANDING_SEEN_KEY, true); }
  catch { /* Without storage the landing page simply shows again. */ }
}

/** Query parameters or a share scene mean the visitor came for specific content. */
export function hasEntryParams(options: Record<string, unknown> | undefined, scene?: number): boolean {
  if (options && Object.keys(options).length > 0) return true;
  return scene !== undefined && SHARE_SCENES.indexOf(scene) >= 0;
}

export function shouldSkipLanding(options: Record<string, unknown> | undefined, scene?: number): boolean {
  return hasSeenLanding() && !hasEntryParams(options, scene);
}

export function currentEntryScene(): number | undefined {
  try {
    const entry = typeof wx.getEnterOptionsSync === "function" ? wx.getEnterOptionsSync() : wx.getLaunchOptionsSync();
    return typeof entry?.scene === "number" ? entry.scene : undefined;
  } catch { return undefined; }
}
