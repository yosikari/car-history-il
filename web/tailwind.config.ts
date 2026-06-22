import type { Config } from "tailwindcss";

// CarHistoryIL premium design system. A restrained, high-trust SaaS palette:
// deep indigo brand, slate neutrals, generous radius + soft shadows. Mirrored
// (loosely) by src/branding.ts for the PDF report.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          DEFAULT: "#4f46e5",
          700: "#4338ca",
          dark: "#3730a3",
        },
        ink: "#0f172a",
        canvas: "#f8fafc",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          '"Segoe UI"',
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.10)",
        "card-hover": "0 2px 4px 0 rgb(15 23 42 / 0.06), 0 16px 40px -12px rgb(15 23 42 / 0.18)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
