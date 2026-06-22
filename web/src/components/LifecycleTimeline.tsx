import { ReportCard } from "./ReportCard";
import type { UnifiedVehicleReport } from "../types";

/**
 * Lifecycle/test timeline — real, dated registry events (first registration →
 * last test → test valid-until → off-road). NOTE: Israel's open data has no
 * multi-year per-test odometer series, so this is an honest event timeline, not
 * a fabricated test-by-test history.
 */
export function LifecycleTimeline({ report: r }: { report: UnifiedVehicleReport }) {
  const events: Array<{ date: string; label: string; tone: "muted" | "bad" }> = [];

  if (r.ownership.firstRegistrationDate)
    events.push({ date: r.ownership.firstRegistrationDate, label: "רישום ראשון", tone: "muted" });
  if (r.license.lastTestDate)
    events.push({ date: r.license.lastTestDate, label: "טסט אחרון שבוצע", tone: "muted" });
  if (r.riskIndicators.offRoadDate)
    events.push({ date: r.riskIndicators.offRoadDate, label: "הורדה מהכביש", tone: "bad" });
  if (r.license.testValidUntil)
    events.push({ date: r.license.testValidUntil, label: "תוקף טסט עד", tone: "muted" });

  events.sort((a, b) => a.date.localeCompare(b.date));
  if (events.length === 0) return null;

  return (
    <ReportCard icon="doc" title="ציר חיי הרכב" subtitle="אירועי רישוי מתוארכים" meta={r.license.meta}>
      <ol className="relative space-y-5 border-r-2 border-slate-100 pr-5">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span
              className={`absolute -right-[26px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow ${
                e.tone === "bad" ? "bg-rose-500" : "bg-brand-500"
              }`}
            />
            <div className="flex items-baseline gap-3">
              <span className="num text-sm font-bold text-ink">{e.date}</span>
              <span className="text-sm text-slate-500">{e.label}</span>
            </div>
          </li>
        ))}
      </ol>
    </ReportCard>
  );
}
