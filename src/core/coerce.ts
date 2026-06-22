/** Small coercion helpers used by the normalizer. Treat "", null, undefined as absent. */
import type { Record_ } from "./ckan.js";

export function str(rec: Record_, key: string): string | null {
  const v = rec[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function num(rec: Record_, key: string): number | null {
  const v = rec[key];
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Government boolean flags are 1/0 (sometimes "1"/"0"). Returns null if absent. */
export function flag(rec: Record_, key: string): boolean | null {
  const v = rec[key];
  if (v === null || v === undefined || v === "") return null;
  return Number(v) === 1;
}

/** Dates arrive as "YYYY-MM-DD" or "YYYY-MM-DD 00:00:00". Normalize to YYYY-MM-DD. */
export function date(rec: Record_, key: string): string | null {
  const s = str(rec, key);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : s;
}
