import { CONTACT_EMAIL } from "./config";

export interface FeedbackNotice {
  title: string;
  content: string;
  email: string;
}

/** Takedown and correction requests go by email; the mini program cannot open mail clients. */
export function feedbackNotice(skill: { name: string; github_url?: string | null }): FeedbackNotice {
  const link = (skill.github_url || "").trim();
  return {
    title: "作者申请下架 / 反馈",
    content: [
      `技能作者要求下架，或发现内容有误，请发邮件到 ${CONTACT_EMAIL}。`,
      `邮件里写明技能名「${skill.name}」${link ? "和来源链接" : ""}与诉求，我们会尽快核实处理。`,
    ].join("\n"),
    email: CONTACT_EMAIL,
  };
}
