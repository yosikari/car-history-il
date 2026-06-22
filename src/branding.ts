/**
 * CarHistoryIL brand tokens — the single source of truth for product name,
 * tagline, and color palette. Imported by the HTML/PDF report (src/report/html.ts)
 * and mirrored by the web Tailwind config (web/tailwind.config.ts) so the
 * printed report and the web UI share one identity.
 *
 * Keep this dependency-free (no imports) so both the Node backend and the
 * Vite/browser build can read it.
 */
export const BRAND = {
  name: "CarHistoryIL",
  nameHe: "קאר היסטורי",
  tagline: "היסטוריית רכב אמינה — מבוססת נתונים אמיתיים בלבד",
  taglineEn: "Trustworthy vehicle history — built on real data only",
  /** Premium SaaS indigo / slate / white palette (mirrors web tailwind config). */
  colors: {
    brand: "#4f46e5", // primary indigo
    brandDark: "#3730a3",
    ink: "#0f172a", // near-black text
    muted: "#64748b",
    line: "#e2e8f0",
    surface: "#ffffff",
    canvas: "#f8fafc",
    ok: "#059669",
    warn: "#d97706",
    danger: "#dc2626",
  },
} as const;

export type BrandColors = typeof BRAND.colors;
