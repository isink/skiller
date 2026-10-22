import assert from "node:assert/strict";
import test from "node:test";
import { feedbackNotice } from "../../../miniprogram/services/feedback";
import { CONTACT_EMAIL } from "../../../miniprogram/services/config";
import { isLinkOnlySkill, skillInstallCommand, skillInstallPlan, skillLicense, skillSourceUrl } from "../../../miniprogram/services/skill-install";

const md = (frontmatter: string) => `---\n${frontmatter}\n---\n# Body`;

test("a skill with a SKILL.md name installs through the skills CLI", () => {
  const plan = skillInstallPlan({
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
  const plan = skillInstallPlan({
    github_url: "https://github.com/acme/tidy",
    skill_md_content: md("name: tidy"),
  });
  assert.equal(plan.installKind, "npx");
  assert.deepEqual(plan.installAlternatives, [
    { label: "手动安装到 Claude Code", command: "git clone https://github.com/acme/tidy.git ~/.claude/skills/tidy" },
  ]);
});

test("without a usable name a root skill falls back to git clone", () => {
  const plan = skillInstallPlan({
    github_url: "https://github.com/acme/tidy/blob/main/SKILL.md",
    skill_md_content: "# Tidy\nNo frontmatter here.",
  });
  assert.equal(plan.installKind, "git-clone");
  assert.equal(plan.installCommand, "git clone https://github.com/acme/tidy.git ~/.claude/skills/tidy");
  assert.match(plan.installSteps[1], /~\/\.claude\/skills/);
});

test("a skill in a sub-folder with no usable name copies the GitHub link", () => {
  const plan = skillInstallPlan({
    github_url: "https://github.com/acme/tools/blob/main/skills/pdf/SKILL.md",
    skill_md_content: "no frontmatter",
  });
  assert.equal(plan.installKind, "link");
  assert.equal(plan.installCommand, "https://github.com/acme/tools/blob/main/skills/pdf/SKILL.md");
  assert.equal(plan.installCopyLabel, "复制 GitHub 链接");
  assert.equal(plan.installSteps.length, 3);
});

test("the official Anthropic repository adds the Claude Code plugin command", () => {
  const plan = skillInstallPlan({
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
  assert.equal(helper.installKind, "npx");
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

test("a list row is link-only for mini program examples and sources no command can be built from", () => {
  assert.equal(isLinkOnlySkill({ category: "mp-skill", tags: ["mp-example"], github_url: "https://github.com/acme/demo", skill_md_content: null }), true);
  assert.equal(isLinkOnlySkill({ github_url: "https://github.com/acme/tools/pulls", skill_md_content: null }), true);
  // A normal GitHub skill may still get an npx command once SKILL.md is known.
  assert.equal(isLinkOnlySkill({ github_url: "https://github.com/acme/tools/tree/main/skills/pdf", skill_md_content: null }), false);
  assert.equal(isLinkOnlySkill({ github_url: "https://github.com/acme/tools", skill_md_content: null }), false);
  assert.equal(isLinkOnlySkill({ github_url: "https://example.com/x", skill_md_content: null }), false);
});
