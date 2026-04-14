/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0B0B0F",
          elevated: "#14141B",
          card: "#1A1A24",
        },
        brand: {
          DEFAULT: "#D97757",
          light: "#E8A084",
          dark: "#B85A3D",
        },
        border: {
          DEFAULT: "#2A2A36",
          subtle: "#1F1F29",
        },
        text: {
          DEFAULT: "#F5F5F7",
          muted: "#9A9AA8",
          subtle: "#6B6B78",
        },
      },
      fontFamily: {
        sans: ["System"],
        mono: ["Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
