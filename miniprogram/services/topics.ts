/** 「微信小程序 SKILL」专题：收录按微信官方“小程序 AI 开发模式”约定编写的开源范例。 */
export const MP_SKILL_CATEGORY = "mp-skill";
export const MP_SKILL_DOC_URL = "https://developers.weixin.qq.com/miniprogram/dev/ai/integration.html";

export const MP_SKILL_TOPIC = {
  slug: MP_SKILL_CATEGORY,
  title: "微信小程序 SKILL 专题",
  tagline: "让微信里的 AI 直接调用小程序的功能",
  intro: "想把自己的小程序接进微信 AI？这里挑出能照着改的开源范例：怎么在 app.json 里登记技能、怎么写 AGENTS.md 和接口说明。",
  emptyNotice: "范例正在整理收录，稍后再来看看。",
};

export function topicCountText(count: number | undefined): string {
  return count && count > 0 ? `${count} 个范例` : "即将收录";
}
