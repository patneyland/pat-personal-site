import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-alt": "var(--bg-alt)",
        "bg-card": "var(--bg-card)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        faint: "var(--text-faint)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        edge: "var(--border)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        body: ["var(--font-heading)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      maxWidth: {
        narrow: "680px",
        wide: "1400px",
      },
    },
  },
  plugins: [],
};

export default config;
