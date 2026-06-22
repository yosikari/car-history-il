import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import type { SectionMeta } from "../types";

/**
 * Premium section card. Replaces the old government-portal "Source: Available"
 * badges with a clean header (icon + title) and, only when a section is truly
 * unavailable/errored, a single subtle muted hint — no status noise on the
 * sections that worked.
 */
export function ReportCard({
  icon,
  title,
  subtitle,
  meta,
  action,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  meta?: SectionMeta;
  action?: ReactNode;
  children: ReactNode;
}) {
  const unverified = meta && (meta.status === "unavailable" || meta.status === "error");
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon name={icon} className="text-base" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold leading-tight text-ink">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unverified && (
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400">
              לא אומת ממקור רשמי
            </span>
          )}
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Compact key/value row used inside report cards. */
export function DataRow({ label, value, tone }: { label: string; value: unknown; tone?: "bad" }) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`num text-sm font-semibold ${tone === "bad" ? "text-rose-600" : "text-ink"}`}>
        {display}
      </dd>
    </div>
  );
}
