import colors from "tailwindcss/colors";

/**
 * Tailwind + Tremor 設定（ダーク観測コンソール）。
 * Tremor v3 は tremor-* と dark-tremor-* 色トークンを theme.extend に要求する。
 * ダーク既定運用のため、tremor-* にもダーク寄りの値を割り当てる。
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Tremor のクラスを Tailwind に拾わせる
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx,mjs}",
  ],
  theme: {
    transparent: "transparent",
    current: "currentColor",
    extend: {
      // ブランドフォント（main.tsx で @fontsource からセルフホスト読込）。
      // sans は body の指定と同一スタック、mono はイベント名・ID・数値チップ用の Plex Mono。
      fontFamily: {
        sans: [
          '"IBM Plex Sans JP"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          '"Noto Sans JP"',
          '"Yu Gothic UI"',
          "Meiryo",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"IBM Plex Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      colors: {
        // light/dark とも観測コンソール基調（#0B0E14 系）に寄せる
        tremor: {
          brand: {
            faint: "#0B1220",
            muted: colors.cyan[950],
            subtle: colors.cyan[800],
            DEFAULT: colors.cyan[500],
            emphasis: colors.cyan[400],
            inverted: colors.white,
          },
          background: {
            muted: "#0B0E14",
            subtle: "#151A23",
            DEFAULT: "#0B0E14",
            emphasis: "#94A3B8",
          },
          border: { DEFAULT: "#232A36" },
          ring: { DEFAULT: "#232A36" },
          content: {
            subtle: colors.slate[500],
            DEFAULT: colors.slate[400],
            emphasis: colors.slate[200],
            strong: colors.slate[50],
            inverted: "#0B0E14",
          },
        },
        "dark-tremor": {
          brand: {
            faint: "#0B1220",
            muted: colors.cyan[950],
            subtle: colors.cyan[800],
            DEFAULT: colors.cyan[500],
            emphasis: colors.cyan[400],
            inverted: colors.white,
          },
          background: {
            muted: "#0B0E14",
            subtle: "#151A23",
            DEFAULT: "#0B0E14",
            emphasis: "#94A3B8",
          },
          border: { DEFAULT: "#232A36" },
          ring: { DEFAULT: "#232A36" },
          content: {
            subtle: colors.slate[500],
            DEFAULT: colors.slate[400],
            emphasis: colors.slate[200],
            strong: colors.slate[50],
            inverted: "#0B0E14",
          },
        },
      },
      boxShadow: {
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)",
        "tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
        "dark-tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "dark-tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)",
        "dark-tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
      },
      borderRadius: {
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
    },
  },
  safelist: [
    {
      pattern:
        /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern:
        /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern:
        /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
  ],
  plugins: [],
};
