import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Helvetica Neue", "Arial", "sans-serif"],
      },
      animation: {
        "fade-up":     "fadeUp 0.25s ease-out",
        "pulse-slow":  "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "iridescent":  "iridescent 4s linear infinite",
        "glow-pulse":  "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        iridescent: {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px 2px rgba(99,102,241,0.4), 0 0 24px 4px rgba(168,85,247,0.2)" },
          "50%":      { boxShadow: "0 0 16px 4px rgba(99,102,241,0.7), 0 0 40px 8px rgba(168,85,247,0.4)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
