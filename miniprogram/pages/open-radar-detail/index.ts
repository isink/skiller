import { trackPageView } from "../../services/analytics";
import { parseMarkdown } from "../../services/markdown";
import { fetchOpenRadarItem, OPEN_RADAR_TITLE } from "../../services/open-radar";
import { APP_TITLE, enableShareMenu } from "../../services/share";
import type { OpenRadarItem } from "../../services/open-radar";
import type { SkillBlock } from "../../types/skill";

const PAGE = "pages/open-radar-detail/index";
const LOAD_ERROR = "网络不佳，请稍后重试";
const LINK_LABELS = { article: "公众号文链接", package: "部署包链接" } as const;

function copy(data: string, toast: string): void {
  wx.setClipboardData({
    data,
    success: () => wx.showToast({ title: toast, icon: "none" }),
    fail: () => wx.showToast({ title: "复制失败，请重试", icon: "none" }),
  });
}

Page({
  _id: "",
  _loadSeq: 0,
  data: {
    loading: true,
    error: "",
    item: null as OpenRadarItem | null,
    blocks: [] as SkillBlock[],
  },

  onLoad(options: Record<string, string>) {
    enableShareMenu();
    this._id = options.id || "";
    this.load();
  },

  onShow() {
    trackPageView(PAGE, this._id ? { id: this._id } : undefined);
  },

  reload() {
    this.load();
  },

  async load() {
    const seq = ++this._loadSeq;
    if (!this._id) { this.setData({ loading: false, item: null, blocks: [] }); return; }
    this.setData({ loading: true, error: "" });
    try {
      const item = await fetchOpenRadarItem(this._id);
      if (seq === this._loadSeq) this.setData({ loading: false, item, blocks: item ? parseMarkdown(item.readmeMd) : [] });
    } catch {
      if (seq === this._loadSeq) this.setData({ loading: false, error: LOAD_ERROR });
    }
  },

  onCopyInstall() {
    const command = this.data.item?.installCommand;
    if (command) copy(command, "安装命令已复制");
  },

  onCopyLink(event: { currentTarget: { dataset: Record<string, string> } }) {
    const kind = event.currentTarget.dataset.kind as keyof typeof LINK_LABELS;
    const item = this.data.item;
    const url = item ? (kind === "article" ? item.articleUrl : kind === "package" ? item.packageUrl : "") : "";
    if (url) copy(url, `${LINK_LABELS[kind]}已复制`);
  },

  sharePath(): string {
    return this._id ? `/pages/open-radar-detail/index?id=${encodeURIComponent(this._id)}` : "/pages/open-radar/index";
  },

  shareTitle(): string {
    const title = this.data.item?.titleZh;
    return title ? `${title}｜${OPEN_RADAR_TITLE}` : `${APP_TITLE}：${OPEN_RADAR_TITLE}`;
  },

  onShareAppMessage() {
    return { title: this.shareTitle(), path: this.sharePath() };
  },

  onShareTimeline() {
    return { title: this.shareTitle(), query: this._id ? `id=${encodeURIComponent(this._id)}` : "" };
  },
});
