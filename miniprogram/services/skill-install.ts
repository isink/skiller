import type { Skill } from "../types/skill";

type InstallCommand = { installCommand: string; installHint: string };

// The CLI selects a skill by its SKILL.md name, which can differ from the
// display name. Accept only simple YAML scalars and shell-safe characters.
function frontmatterName(markdown: string | null | undefined): string | null {
  if (!markdown) return null;
  const text = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const header = text.match(/^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/);
  if (!header) return null;
  const names = header[1].split("\n").filter((line) => /^name[ \t]*:/.test(line));
  if (names.length !== 1) return null;
  const raw = names[0].replace(/^name[ \t]*:[ \t]*/, "").trim();
  const quoted = raw.match(/^(?:"([^"\\]*)"|'([^']*)')(?:[ \t]+#.*)?$/);
  const name = quoted ? (quoted[1] === undefined ? quoted[2] : quoted[1]) : raw.replace(/[ \t]+#.*$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}$/.test(name) || name.trim() !== name) return null;
  if (!quoted && /^(?:true|false|null|yes|no|on|off|\d+(?:\.\d+)?)$/i.test(name)) return null;
  return name;
}

function githubInstallSource(raw: string): string | null {
  // Do not pass arbitrary URLs, query strings, shell syntax or URL-encoded
  // paths to a command. Unsupported sources remain readable in the app.
  const url = raw.trim().replace(/\/$/, "");
  const match = url.match(/^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})(?:\/(.*))?$/);
  if (!match) return null;
  const repo = match[2].replace(/\.git$/, "");
  if (!repo || repo === "." || repo === "..") return null;
  const root = `https://github.com/${match[1]}/${repo}`;
  if (!match[3]) return root;
  const parts = match[3].split("/");
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
