import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#004ac6",
        "primary-container": "#2563eb",
        "primary-fixed": "#dbe1ff",
        "on-primary": "#ffffff",
        "on-primary-container": "#001a43",
        secondary: "#006c49",
        "secondary-container": "#6cf8bb",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#002113",
        tertiary: "#632ecd",
        "tertiary-container": "#7d4ce7",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#21005d",
        surface: "#f7f9fb",
        "surface-dim": "#d7dadc",
        "surface-bright": "#f7f9fb",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "on-surface": "#191c1e",
        "on-surface-variant": "#434655",
        outline: "#737686",
        "outline-variant": "#c3c6d7",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#410002",
        "inverse-surface": "#2e3133",
        "inverse-on-surface": "#eff1f3",
        "inverse-primary": "#b4c5ff",
      },
      fontFamily: {
        headline: ["'Noto Sans KR'", "sans-serif"],
        body: ["'Noto Sans KR'", "sans-serif"],
        label: ["'Noto Sans KR'", "sans-serif"],
      },
      boxShadow: {
        ambient: "0 12px 32px -4px rgba(25, 28, 30, 0.06)",
        "ambient-lg": "0 16px 48px -8px rgba(25, 28, 30, 0.10)",
        nav: "0 -12px 32px -4px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
