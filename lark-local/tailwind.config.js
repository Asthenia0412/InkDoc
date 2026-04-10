/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "PingFang SC",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["SF Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        // Feishu-inspired color palette
        feishu: {
          bg: "#F5F6F7",
          sidebar: "#FFFFFF",
          border: "#DEE0E3",
          text: "#1F2329",
          "text-secondary": "#646A73",
          "text-placeholder": "#8F959E",
          accent: "#3370FF",
          "accent-hover": "#2860E1",
          hover: "#F0F1F2",
          active: "#E8F0FE",
          code: "#F2F3F5",
          "code-text": "#D6493C",
          quote: "#E8F3FC",
          "quote-border": "#3370FF",
        },
      },
      spacing: {
        sidebar: "260px",
      },
    },
  },
  plugins: [],
};
