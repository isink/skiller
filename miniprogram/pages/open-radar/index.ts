import { trackPageView } from "../../services/analytics";
import { fetchOpenRadarList, openRadarDetailUrl, OPEN_RADAR_TITLE } from "../../services/open-radar";
import { APP_TITLE, enableShareMenu } from "../../services/share";
import type { OpenRadarSummary } from "../../services/open-radar";

const PAGE = "pages/open-radar/index";
const LOAD_ERROR = "网络不佳，请稍后重试";

Page({
  _loadSeq: 0,
  data: {
    loading: true,
    error: "",
    items: [] as OpenRadarSummary[],
  },

  onLoad() {
    enableShareMenu();
    this.load();
  },

  onShow() {
    trackPageView(PAGE);
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  reload() {
    this.load();
  },

  async load() {
    const seq = ++this._loadSeq;
    this.setData({ loading: true, error: "" });
    try {
      const items = await fetchOpenRadarList();
      if (seq === this._loadSeq) this.setData({ loading: false, items });
    } catch {
      if (seq === this._loadSeq) this.setData({ loading: false, error: LOAD_ERROR });
    }
  },

  openItem(event: { currentTarget: { dataset: Record<string, string> } }) {
    const id = event.currentTarget.dataset.id || "";
    if (id) wx.navigateTo({ url: openRadarDetailUrl(id) });
  },

  onShareAppMessage() {
    return { title: `${APP_TITLE}：${OPEN_RADAR_TITLE}`, path: "/pages/open-radar/index" };
  },

  onShareTimeline() {
    return { title: `${APP_TITLE}：${OPEN_RADAR_TITLE}` };
  },
});
