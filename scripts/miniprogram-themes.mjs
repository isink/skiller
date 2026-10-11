// Single source of truth for the 头山 AI 工具箱 colour themes.
// Each theme overrides only the colour tokens declared in miniprogram/app.wxss;
// spacing, radius and type tokens are shared by all themes.
// Used by scripts/preview-miniprogram.mjs and scripts/render-miniprogram-icons.mjs.

export const THEMES = {
  "ink-blue": {
    name: "墨夜蓝",
    mode: "dark",
    tokens: {
      "--color-bg": "#0c0e12",
      "--color-surface": "#14171d",
      "--color-surface-2": "#1b1f27",
      "--color-surface-pressed": "#202531",
      "--color-surface-glass": "rgba(20, 23, 29, 0.96)",
      "--color-border": "#242a35",
      "--color-border-strong": "#313947",
      "--color-text": "#f2f4f8",
      "--color-text-2": "#aab3c1",
      "--color-text-3": "#7f899a",
      "--color-accent": "#7c9bff",
      "--color-accent-soft": "rgba(124, 155, 255, 0.14)",
      "--color-accent-line": "rgba(124, 155, 255, 0.4)",
      "--color-on-accent": "#0c0e12",
      "--color-success": "#4fc38a",
      "--color-success-soft": "rgba(79, 195, 138, 0.14)",
      "--color-overlay": "rgba(5, 7, 10, 0.72)",
    },
  },
  "warm-stone": {
    name: "暖石",
    mode: "dark",
    tokens: {
      "--color-bg": "#110f0d",
      "--color-surface": "#1a1714",
      "--color-surface-2": "#241f1b",
      "--color-surface-pressed": "#2c2621",
      "--color-surface-glass": "rgba(26, 23, 20, 0.96)",
      "--color-border": "#2f2923",
      "--color-border-strong": "#40372f",
      "--color-text": "#f6f1ea",
      "--color-text-2": "#bcb2a6",
      "--color-text-3": "#968b7e",
      "--color-accent": "#e8884a",
      "--color-accent-soft": "rgba(232, 136, 74, 0.15)",
      "--color-accent-line": "rgba(232, 136, 74, 0.42)",
      "--color-on-accent": "#1c0f06",
      "--color-success": "#9bc46b",
      "--color-success-soft": "rgba(155, 196, 107, 0.15)",
      "--color-overlay": "rgba(8, 6, 4, 0.74)",
    },
  },
  "paper-light": {
    name: "亮色纸感",
    mode: "light",
    tokens: {
      "--color-bg": "#f5f2ea",
      "--color-surface": "#fffdf8",
      "--color-surface-2": "#eeeadf",
      "--color-surface-pressed": "#e6e1d3",
      "--color-surface-glass": "rgba(255, 253, 248, 0.96)",
      "--color-border": "#e3ddcf",
      "--color-border-strong": "#cdc5b3",
      "--color-text": "#1c1a16",
      "--color-text-2": "#4f4a43",
      "--color-text-3": "#6b6459",
      "--color-accent": "#b4402a",
      "--color-accent-soft": "rgba(180, 64, 42, 0.10)",
      "--color-accent-line": "rgba(180, 64, 42, 0.38)",
      "--color-on-accent": "#fffdf8",
      "--color-success": "#2c7a4b",
      "--color-success-soft": "rgba(44, 122, 75, 0.12)",
      "--color-overlay": "rgba(28, 26, 22, 0.42)",
    },
  },
  "mountain-teal": {
    name: "山青",
    mode: "dark",
    tokens: {
      "--color-bg": "#091110",
      "--color-surface": "#101b1a",
      "--color-surface-2": "#162625",
      "--color-surface-pressed": "#1c3130",
      "--color-surface-glass": "rgba(16, 27, 26, 0.96)",
      "--color-border": "#1e3331",
      "--color-border-strong": "#2c4845",
      "--color-text": "#ecf4f2",
      "--color-text-2": "#a6bcb8",
      "--color-text-3": "#7a948f",
      "--color-accent": "#4fd1b2",
      "--color-accent-soft": "rgba(79, 209, 178, 0.14)",
      "--color-accent-line": "rgba(79, 209, 178, 0.4)",
      "--color-on-accent": "#04201a",
      "--color-success": "#b4d86a",
      "--color-success-soft": "rgba(180, 216, 106, 0.14)",
      "--color-overlay": "rgba(3, 8, 7, 0.74)",
    },
  },
};

const hex = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) throw new Error(`expected 6-digit hex, got ${c}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
};
const lum = (c) => {
  const [r, g, b] = hex(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [label, foreground token, background token, minimum ratio]
export const CONTRAST_PAIRS = [
  ["正文 on 背景", "--color-text", "--color-bg", 7],
  ["正文 on 卡片", "--color-text", "--color-surface", 7],
  ["次要文字 on 卡片", "--color-text-2", "--color-surface", 4.5],
  ["辅助文字 on 卡片", "--color-text-3", "--color-surface", 4.5],
  ["辅助文字 on 背景", "--color-text-3", "--color-bg", 4.5],
  ["辅助文字 on 次级表面", "--color-text-3", "--color-surface-2", 4.5],
  ["强调色 on 卡片", "--color-accent", "--color-surface", 4.5],
  ["强调色 on 背景", "--color-accent", "--color-bg", 4.5],
  ["按钮文字 on 强调色", "--color-on-accent", "--color-accent", 4.5],
  ["成功色 on 卡片", "--color-success", "--color-surface", 4.5],
];

export function contrastReport(id) {
  const t = THEMES[id].tokens;
  return CONTRAST_PAIRS.map(([label, fg, bg, min]) => {
    const ratio = contrast(t[fg], t[bg]);
    return { label, fg, bg, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let failed = false;
  for (const id of Object.keys(THEMES)) {
    console.log(`\n${id} ${THEMES[id].name}`);
    for (const r of contrastReport(id)) {
      console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.ratio.toFixed(2).padStart(5)} (>= ${r.min})  ${r.label}`);
      if (!r.ok) failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}
