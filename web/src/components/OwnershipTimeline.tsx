import { ReportCard, DataRow } from "./ReportCard";
import type { OwnershipInfo } from "../types";

function usageChips(o: OwnershipInfo): string[] {
  const u = o.usageProfile;
  const chips: string[] = [];
  if (u.wasImported) chips.push("יבוא");
  if (u.wasLease) chips.push("ליסינג/החכר");
  if (u.wasRental) chips.push("השכרה");
  if (u.wasDealer) chips.push("עבר דרך סוחר");
  if (u.wasTaxi) chips.push("מונית");
  if (u.wasDrivingSchool) chips.push("רכב לימוד נהיגה");
  return chips;
}

export function OwnershipTimeline({ ownership }: { ownership: OwnershipInfo }) {
  const chips = usageChips(ownership);
  return (
    <ReportCard
      icon="users"
      title="בעלות והיסטוריה"
      subtitle="ציר זמן מעברי בעלות"
      meta={ownership.meta}
    >
      <dl className="grid gap-x-10 sm:grid-cols-2">
        <DataRow label="סוג בעלות נוכחי" value={ownership.ownershipType} />
        <DataRow label="מקוריות" value={ownership.originType} />
        <DataRow label="מועד רישום ראשון" value={ownership.firstRegistrationDate} />
        <DataRow label="תקופות בעלות שנצפו" value={ownership.observedOwnerRecords} />
      </dl>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-lg bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {ownership.timeline.length > 0 && (
        <ol className="relative mt-6 space-y-5 border-r-2 border-slate-100 pr-5">
          {ownership.timeline.map((p, i) => (
            <li key={i} className="relative">
              <span className="absolute -right-[26px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500 shadow" />
              <div className="flex items-baseline gap-3">
                <span className="num text-sm font-bold text-ink">
                  {p.date ?? p.rawPeriod ?? "—"}
                </span>
                <span className="text-sm text-slate-500">{p.ownershipType ?? "—"}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ReportCard>
  );
}
