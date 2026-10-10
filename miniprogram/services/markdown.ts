import type { SkillBlock } from "../types/skill";

type InlineNode = SkillBlock["inline"][number];

function inlineNodes(raw: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  // Only the tags in this fixed list can become nodes. Source HTML and links
  // remain plain text, so community Markdown cannot inject markup or navigation.
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~]+~~|\[([^\]]+)\]\(([^)]+)\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > cursor) nodes.push({ type: "text", text: raw.slice(cursor, match.index) });
    const token = match[0];
    let name = "";
    let text = token;
    if (token.startsWith("`")) { name = "code"; text = token.slice(1, -1); }
    else if (token.startsWith("**") || token.startsWith("__")) { name = "strong"; text = token.slice(2, -2); }
    else if (token.startsWith("~~")) { name = "del"; text = token.slice(2, -2); }
    else if (token.startsWith("*") || token.startsWith("_")) { name = "em"; text = token.slice(1, -1); }
    else { text = match[2] || token; }
    if (name) nodes.push({ name, children: [{ type: "text", text }] });
    else nodes.push({ type: "text", text });
    cursor = match.index + token.length;
  }
  if (cursor < raw.length) nodes.push({ type: "text", text: raw.slice(cursor) });
  return nodes;
}

export function parseMarkdown(markdown: string): SkillBlock[] {
  const blocks: SkillBlock[] = [];
  const lines = markdown.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  let code: string[] | null = null;
  let list: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    if (text) blocks.push({ type: "paragraph", text, inline: inlineNodes(text) });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) {
      list.forEach((item) => {
        const text = `• ${item}`;
        blocks.push({ type: "list", text, inline: inlineNodes(text) });
      });
      list = [];
    }
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flushParagraph(); flushList();
      if (code === null) code = [];
      else {
        const text = code.join("\n");
        blocks.push({ type: "code", text, inline: [{ type: "text", text }] });
        code = null;
      }
      continue;
    }
    if (code !== null) { code.push(line); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const text = heading[2].replace(/\s+#+\s*$/, "");
      blocks.push({ type: "heading", level: heading[1].length, text, inline: inlineNodes(text) });
      continue;
    }
    if (/^\s*((-{3,}|\*{3,}|_{3,})\s*)$/.test(line)) {
      flushParagraph(); flushList();
      blocks.push({ type: "rule", text: "", inline: [] });
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph(); flushList();
      blocks.push({ type: "quote", text: quote[1], inline: inlineNodes(quote[1]) });
      continue;
    }
    const item = line.match(/^\s*(?:[-+*]|\d+\.)\s+(.+)$/);
    if (item) { flushParagraph(); list.push(item[1]); continue; }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph(); flushList();
  if (code !== null) {
    const text = code.join("\n");
    blocks.push({ type: "code", text, inline: [{ type: "text", text }] });
  }
  return blocks;
}
