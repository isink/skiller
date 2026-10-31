import assert from "node:assert/strict";
import test from "node:test";
import { feedbackNotice } from "../../../miniprogram/services/feedback";
import { CONTACT_EMAIL } from "../../../miniprogram/services/config";
import { skillInstallCommand, skillInstallPlan, skillLicense, skillSourceUrl, terminalInstallPlan, workbuddyPrompt } from "../../../miniprogram/services/skill-install";

const md = (frontmatter: string) => `---\n${frontmatter}\n---\n# Body`;

test("the terminal route installs a named skill through the skills CLI", () => {
  const plan = terminalInstallPlan({
    github_url: "https://github.com/acme/tools/tree/main/skills/pdf",
    skill_md_content: md("name: pdf-reader\ndescription: x"),
  });
  assert.equal(plan.installKind, "npx");
  assert.equal(plan.installCommand, "npx skills add https://github.com/acme/tools/tree/main/skills/pdf --skill pdf-reader");
  assert.equal(plan.installCopyLabel, "复制安装命令");
  assert.equal(plan.installSteps.length, 3);
  assert.deepEqual(plan.installAlternatives, []);
  assert.equal(plan.sourceUrl, "https://github.com/acme/tools/tree/main/skills/pdf");
  // The legacy helper keeps returning the same command.
  assert.equal(skillInstallCommand({ github_url: "https://github.com/acme/tools/tree/main/skills/pdf", skill_md_content: md("name: pdf-reader") }).installCommand, plan.installCommand);
});

test("a repository-root skill also offers a git clone into ~/.claude/skills", () => {
  const plan = terminalInstallPlan({
    github_url: "https://github.com/acme/tidy",
    skill_md_content: md("name: tidy"),
  });
  assert.equal(plan.installKind, "npx");
  assert.deepEqual(plan.installAlternatives, [
    { label: "手动安装到 Claude Code", command: "git clone https://github.com/acme/tidy.git ~/.claude/skills/tidy" },
  ]);
});

test("without a usable name a root skill falls back to git clone", () => {
  const plan = terminalInstallPlan({
    github_url: "https://github.com/acme/tidy/blob/main/SKILL.md",
    skill_md_content: "# Tidy\nNo frontmatter here.",
  });
  assert.equal(plan.installKind, "git-clone");
  assert.equal(plan.installCommand, "git clone https://github.com/acme/tidy.git ~/.claude/skills/tidy");
  assert.match(plan.installSteps[1], /~\/\.claude\/skills/);
});

test("a skill in a sub-folder with no usable name copies the GitHub link", () => {
  const plan = terminalInstallPlan({
    github_url: "https://github.com/acme/tools/blob/main/skills/pdf/SKILL.md",
    skill_md_content: "no frontmatter",
  });
  assert.equal(plan.installKind, "link");
  assert.equal(plan.installCommand, "https://github.com/acme/tools/blob/main/skills/pdf/SKILL.md");
  assert.equal(plan.installCopyLabel, "复制 GitHub 链接");
  assert.equal(plan.installSteps.length, 3);
});

test("the official Anthropic repository adds the Claude Code plugin command", () => {
  const plan = terminalInstallPlan({
    github_url: "https://github.com/anthropics/skills/tree/main/skills/pdf",
    skill_md_content: md("name: pdf"),
  });
  assert.deepEqual(plan.installAlternatives, [{ label: "Claude Code 插件市场", command: "/plugin marketplace add anthropics/skills" }]);
});

test("unsafe or non-GitHub sources produce no command and no link", () => {
  for (const url of ["", "https://example.com/acme/tools", "https://github.com/acme/tools; rm -rf /", "javascript:alert(1)"]) {
    const plan = skillInstallPlan({ github_url: url, skill_md_content: md("name: x") });
    assert.equal(plan.installKind, "none", url);
    assert.equal(plan.installCommand, "", url);
    assert.equal(plan.sourceUrl, "", url);
    assert.deepEqual(plan.installSteps, [], url);
  }
  assert.equal(skillSourceUrl("https://github.com/acme/tools/?x=1"), "");
  assert.equal(skillSourceUrl("https://github.com/acme/tools/"), "https://github.com/acme/tools");
});

test("mini program SKILL examples are referenced, not installed", () => {
  const plan = skillInstallPlan({
    category: "mp-skill",
    tags: ["wechat", "mp-example"],
    github_url: "https://github.com/acme/mp/blob/main/skills/drink/SKILL.md",
    skill_md_content: md("name: drink"),
  });
  assert.equal(plan.installKind, "link");
  assert.equal(plan.installCommand, "https://github.com/acme/mp/blob/main/skills/drink/SKILL.md");
  assert.match(plan.installSteps[2], /agent\.skills/);

  const helper = skillInstallPlan({
    category: "mp-skill",
    tags: ["wechat"],
    github_url: "https://github.com/acme/mp/tree/main/gen",
    skill_md_content: md("name: gen"),
  });
  assert.equal(helper.installKind, "workbuddy");
});

test("license comes from the frontmatter and is shortened and sanitised", () => {
  assert.equal(skillLicense(md("name: x\nlicense: MIT")), "MIT");
  assert.equal(skillLicense(md('license: "Apache-2.0"')), "Apache-2.0");
  assert.equal(skillLicense(md("license: MIT # permissive")), "MIT");
  assert.equal(skillLicense(md("license: Proprietary. LICENSE.txt has complete terms")), "Proprietary. LICENSE.txt has complete terms");
  assert.equal(skillLicense(md(`license: ${"x".repeat(100)}`)).length, 60);
  assert.equal(skillLicense(md("name: x")), "");
  assert.equal(skillLicense(md("license: |\n  text")), "");
  assert.equal(skillLicense(md("license: none")), "");
  assert.equal(skillLicense(md("license: MIT\nlicense: GPL")), "");
  assert.equal(skillLicense("license: MIT"), "");
  assert.equal(skillLicense(null), "");
});

test("the takedown notice names the skill and points to the published contact", () => {
  const notice = feedbackNotice({ name: "PDF 助手", github_url: "https://github.com/acme/pdf" });
  assert.equal(notice.email, CONTACT_EMAIL);
  assert.match(notice.content, /「PDF 助手」和来源链接/);
  assert.match(notice.content, new RegExp(CONTACT_EMAIL.replace(".", "\\.")));
  assert.doesNotMatch(feedbackNotice({ name: "x", github_url: "" }).content, /来源链接/);
});

test("a skill with a GitHub source is copied to WorkBuddy first, terminal commands second", () => {
  const plan = skillInstallPlan({
    name: "PDF Reader",
    github_url: "https://github.com/acme/tidy",
    skill_md_content: md("name: tidy"),
  });
  assert.equal(plan.installKind, "workbuddy");
  assert.equal(plan.installCopyLabel, "复制给 WorkBuddy");
  assert.equal(plan.installCommand, workbuddyPrompt("PDF Reader", "https://github.com/acme/tidy"));
  assert.match(plan.installCommand, /^请帮我安装这个 Skill：PDF Reader\n来源：https:\/\/github\.com\/acme\/tidy\n/);
  assert.match(plan.installSteps[1], /WorkBuddy/);
  assert.deepEqual(plan.installAlternatives, [
    { label: "终端安装（需 Node.js）", command: "npx skills add https://github.com/acme/tidy --skill tidy" },
    { label: "手动安装到 Claude Code", command: "git clone https://github.com/acme/tidy.git ~/.claude/skills/tidy" },
  ]);
  assert.equal(plan.sourceUrl, "https://github.com/acme/tidy");
});

test("the WorkBuddy request needs no SKILL.md, so a list row is enough", () => {
  const plan = skillInstallPlan({ name: "pdf", github_url: "https://github.com/acme/tools/tree/main/skills/pdf", skill_md_content: null });
  assert.equal(plan.installKind, "workbuddy");
  assert.deepEqual(plan.installAlternatives, []);
  const official = skillInstallPlan({ name: "pdf", github_url: "https://github.com/anthropics/skills/tree/main/skills/pdf", skill_md_content: null });
  assert.deepEqual(official.installAlternatives, [{ label: "Claude Code 插件市场", command: "/plugin marketplace add anthropics/skills" }]);
});

test("the WorkBuddy request flattens and shortens the name", () => {
  assert.equal(workbuddyPrompt("a\n  b", "https://github.com/acme/x").split("\n")[0], "请帮我安装这个 Skill：a b");
  assert.equal(workbuddyPrompt("", "https://github.com/acme/x").split("\n")[0], "请帮我安装这个 Skill");
  assert.equal(Array.from(workbuddyPrompt("名".repeat(100), "https://github.com/acme/x").split("\n")[0]).length, "请帮我安装这个 Skill：".length + 60);
});

test("mini program examples and unusable sources keep copying the link", () => {
  assert.equal(skillInstallPlan({ github_url: "https://github.com/acme/tools/pulls", skill_md_content: null }).installKind, "link");
  assert.equal(skillInstallPlan({ category: "mp-skill", tags: ["mp-example"], github_url: "https://github.com/acme/demo", skill_md_content: null }).installKind, "link");
  assert.equal(skillInstallPlan({ github_url: "", skill_md_content: null }).installKind, "none");
});
