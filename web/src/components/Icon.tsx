/**
 * Icon wrapper over Font Awesome 6 (free, loaded via CDN in index.html). Keeps a
 * stable internal name set so call sites don't depend on FA class strings.
 */
export type IconName =
  | "car"
  | "shield"
  | "users"
  | "gauge"
  | "wrench"
  | "doc"
  | "sparkle"
  | "check"
  | "alert"
  | "money"
  | "leaf"
  | "bolt"
  | "weight"
  | "seat"
  | "magnify"
  | "lock";

const FA: Record<IconName, string> = {
  car: "fa-solid fa-car-side",
  shield: "fa-solid fa-shield-halved",
  users: "fa-solid fa-users",
  gauge: "fa-solid fa-gauge-high",
  wrench: "fa-solid fa-screwdriver-wrench",
  doc: "fa-solid fa-file-lines",
  sparkle: "fa-solid fa-wand-magic-sparkles",
  check: "fa-solid fa-circle-check",
  alert: "fa-solid fa-triangle-exclamation",
  money: "fa-solid fa-coins",
  leaf: "fa-solid fa-leaf",
  bolt: "fa-solid fa-bolt",
  weight: "fa-solid fa-weight-hanging",
  seat: "fa-solid fa-chair",
  magnify: "fa-solid fa-magnifying-glass",
  lock: "fa-solid fa-lock",
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <i className={`${FA[name]} ${className}`.trim()} aria-hidden="true" />;
}
