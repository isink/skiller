import type { Skill } from "../types/skill";

type InstallCommand = { installCommand: string; installHint: string };

export type InstallKind = "npx" | "git-clone" | "link" | "none";
export type InstallAlternative = { label: string; command: string };
export type InstallPlan = InstallCommand & {
  installKind: InstallKind;
  installCopyLabel: string;
  installSteps: string[];
  installAlternatives: InstallAlternative[];
  sourceUrl: string;
};

const FRONTMATTER = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/;

function frontmatterLines(markdown: string | null | undefined): string[] | null {
  if (!markdown) return null;
  const text = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const header = text.match(FRONTMATTER);
  return header ? header[1].split("\n") : null;
}

// The CLI selects a skill by its SKILL.md name, which can differ from the
// display name. Accept only simple YAML scalars and shell-safe characters.
function frontmatterName(markdown: string | null | undefined): string | null {
  const lines = frontmatterLines(markdown);
  if (!lines) return null;
  const names = lines.filter((line) => /^name[ \t]*:/.test(line));
  if (names.length !== 1) return null;
  const raw = names[0].replace(/^name[ \t]*:[ \t]*/, "").trim();
  const quoted = raw.match(/^(?:"([^"\\]*)"|'([^']*)')(?:[ \t]+#.*)?$/);
  const name = quoted ? (quoted[1] === undefined ? quoted[2] : quoted[1]) : raw.replace(/[ \t]+#.*$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}$/.test(name) || name.trim() !== name) return null;
  if (!quoted && /^(?:true|false|null|yes|no|on|off|\d+(?:\.\d+)?)$/i.test(name)) return null;
  return name;
}

const MAX_LICENSE_LENGTH = 60;

/** The `license` scalar of the SKILL.md frontmatter, shortened for display. Empty when absent. */
export function skillLicense(markdown: string | null | undefined): string {
  const lines = frontmatterLines(markdown);
  if (!lines) return "";
  const entries = lines.filter((line) => /^license[ \t]*:/.test(line));
  if (entries.length !== 1) return "";
  const raw = entries[0].replace(/^license[ \t]*:[ \t]*/, "").trim();
  if (!raw || /^[|>&*!{[]/.test(raw)) return "";
  const quoted = raw.match(/^(?:"([^"\\]*)"|'([^']*)')(?:[ \t]+#.*)?$/);
  const value = (quoted ? (quoted[1] === undefined ? quoted[2] : quoted[1]) : raw.replace(/[ \t]+#.*$/, ""))
    .replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!value || /^(?:null|~|none|false)$/i.test(value)) return "";
  return value.length > MAX_LICENSE_LENGTH ? `${value.slice(0, MAX_LICENSE_LENGTH - 1)}…` : value;
}

type GithubSource = { owner: string; repo: string; root: string; parts: string[] };

function parseGithubSource(raw: string): GithubSource | null {
  const url = raw.trim().replace(/\/$/, "");
  const match = url.match(/^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})(?:\/(.*))?$/);
  if (!match) return null;
  const repo = match[2].replace(/\.git$/, "");
  if (!repo || repo === "." || repo === "..") return null;
  return {
    owner: match[1],
    repo,
    root: `https://github.com/${match[1]}/${repo}`,
    parts: match[3] ? match[3].split("/") : [],
  };
}

function githubInstallSource(raw: string): string | null {
  // Do not pass arbitrary URLs, query strings, shell syntax or URL-encoded
  // paths to a command. Unsupported sources remain readable in the app.
  const source = parseGithubSource(raw);
  if (!source) return null;
  const { root } = source;
  const parts = [...source.parts];
  if (parts.length === 0) return root;
  if (parts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part) || part === "." || part === "..")) return null;
  if (parts[0] !== "tree" && parts[0] !== "blob") return null;
  if (parts.length < 2) return null;
  if (parts[0] === "blob") {
    if (parts.length < 3 || parts[parts.length - 1] !== "SKILL.md") return null;
    parts.pop();
  } else if (parts[parts.length - 1] === "SKILL.md") {
    return null;
  }
  // Vercel skills documents tree URLs as a way to target a specific directory.
  // Keep the supplied revision/path instead of guessing a branch or folder.
  return `${root}/tree/${parts.slice(1).join("/")}`;
}

/** Syntax: https://github.com/vercel-labs/skills#install-a-skill */
export function skillInstallCommand(skill: Pick<Skill, "github_url" | "skill_md_content">): InstallCommand {
  const source = githubInstallSource(skill.github_url || "");
  const name = frontmatterName(skill.skill_md_content);
  if (!source || !name) {
    return {
      installCommand: "",
      installHint: "暂无法生成安装命令：技能来源或安装名称尚未确认。可继续阅读下方说明。",
    };
  }
  // The allowlist above excludes quotes and every shell metacharacter. Quote
  // names containing spaces so Bash, zsh and PowerShell receive one argument.
  const selectedName = name.includes(" ") ? `'${name}'` : name;
  return {
    installCommand: `npx skills add ${source} --skill ${selectedName}`,
    installHint: "在已安装 Node.js 的电脑终端运行，按提示选择要安装到的 AI 工具。",
  };
}

/** A GitHub link that is safe to show and copy as-is. Empty for anything else. */
export function skillSourceUrl(raw: string | null | undefined): string {
  const url = (raw || "").trim();
  if (!/^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}(?:\/[A-Za-z0-9_.\-/]*)?$/.test(url)) return "";
  return url.replace(/\/$/, "");
}

// Only the skill at the repository root can be cloned straight into the skills folder.
function isRepositoryRootSkill(source: GithubSource): boolean {
  const { parts } = source;
  if (parts.length === 0) return true;
  if (parts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))) return false;
  if (parts[0] === "tree") return parts.length === 2;
  return parts[0] === "blob" && parts.length === 3 && parts[2] === "SKILL.md";
}

const STEPS: Record<Exclude<InstallKind, "none">, string[]> = {
  npx: [
    "点「复制安装命令」，命令会进入剪贴板",
    "在电脑终端粘贴并回车（需已安装 Node.js），按提示选择要装到的 AI 工具",
    "重启 AI 工具，直接说出需求，技能会自动被调用",
  ],
  "git-clone": [
    "点「复制安装命令」，命令会进入剪贴板",
    "在电脑终端粘贴并回车，技能会下载到 ~/.claude/skills/ 目录",
    "重启 Claude Code，直接说出需求，技能会自动被调用",
  ],
  link: [
    "点「复制 GitHub 链接」，链接会进入剪贴板",
    "用电脑浏览器打开链接，按仓库说明下载或安装",
    "把技能文件夹放进 AI 工具的技能目录（如 ~/.claude/skills/），重启后使用",
  ],
};

// 带 mp-example 标签的是小程序工程里的 SKILL（SKILL.md + mcp.json），不能装进 Claude Code 之类的 AI 工具，只能当范例参考。
const MP_SKILL_STEPS = [
  "点「复制 GitHub 链接」，链接会进入剪贴板",
  "用电脑浏览器打开，看它的 app.json、AGENTS.md 和 SKILL 目录怎么写",
  "把 SKILL 分包放进你的小程序工程，在 app.json 的 agent.skills 里登记，再用开发者工具的 AI 开发模式调试",
];

const NO_SOURCE_HINT = "暂无法生成安装命令：技能来源尚未确认。可继续阅读下方说明。";

/**
 * Chooses what the detail page copies. Preference: the `skills` CLI command,
 * then a git clone into ~/.claude/skills for root-level skills, then the
 * GitHub link when the repository layout cannot be inferred safely.
 */
export function skillInstallPlan(skill: Pick<Skill, "github_url" | "skill_md_content"> & { category?: string; tags?: string[] }): InstallPlan {
  const sourceUrl = skillSourceUrl(skill.github_url);
  if (skill.category === "mp-skill" && skill.tags?.includes("mp-example") && sourceUrl) {
    return {
      installCommand: sourceUrl,
      installHint: "这是微信小程序 AI 开发模式的范例，用来参考写法，不是装进 AI 工具的技能。",
      installKind: "link",
      installCopyLabel: "复制 GitHub 链接",
      installSteps: MP_SKILL_STEPS,
      installAlternatives: [],
      sourceUrl,
    };
  }
  const github = parseGithubSource(skill.github_url || "");
  const cli = skillInstallCommand(skill);
  const alternatives: InstallAlternative[] = [];
  const name = frontmatterName(skill.skill_md_content);
  const cloneDir = name && !name.includes(" ") ? name : github?.repo;
  const clone = github && cloneDir && isRepositoryRootSkill(github) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(cloneDir)
    ? `git clone ${github.root}.git ~/.claude/skills/${cloneDir}`
    : "";
  if (github && `${github.owner}/${github.repo}`.toLowerCase() === "anthropics/skills") {
    alternatives.push({ label: "Claude Code 插件市场", command: "/plugin marketplace add anthropics/skills" });
  }

  if (cli.installCommand) {
    if (clone) alternatives.push({ label: "手动安装到 Claude Code", command: clone });
    return {
      ...cli,
      installKind: "npx",
      installCopyLabel: "复制安装命令",
      installSteps: STEPS.npx,
      installAlternatives: alternatives,
      sourceUrl,
    };
  }
  if (clone) {
    return {
      installCommand: clone,
      installHint: "适用于 Claude Code：在电脑终端运行，把技能放进个人技能目录。",
      installKind: "git-clone",
      installCopyLabel: "复制安装命令",
      installSteps: STEPS["git-clone"],
      installAlternatives: alternatives,
      sourceUrl,
    };
  }
  if (sourceUrl) {
    return {
      installCommand: sourceUrl,
      installHint: "暂时无法推断安装命令，先复制 GitHub 链接，到电脑上按仓库说明安装。",
      installKind: "link",
      installCopyLabel: "复制 GitHub 链接",
      installSteps: STEPS.link,
      installAlternatives: alternatives,
      sourceUrl,
    };
  }
  return {
    installCommand: "",
    installHint: NO_SOURCE_HINT,
    installKind: "none",
    installCopyLabel: "",
    installSteps: [],
    installAlternatives: [],
    sourceUrl: "",
  };
}
