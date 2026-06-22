import { ReportCard, DataRow } from "./ReportCard";
import { Icon } from "./Icon";
import type { VehicleSpecs } from "../types";

/** Active-safety features + environmental/eco data, all from the WLTP dataset. */
export function SafetyEcoCard({ specs }: { specs: VehicleSpecs }) {
  return (
    <ReportCard icon="leaf" title="בטיחות וסביבה" subtitle="מערכות, זיהום וצריכה" meta={specs.meta}>
      <dl className="grid gap-x-10 sm:grid-cols-2">
        <DataRow label="ציון ירוק" value={specs.greenScore} />
        <DataRow label='פליטת CO₂ (WLTP, ג"ק/ק"מ)' value={specs.co2Wltp} />
        <DataRow label="קבוצת זיהום" value={specs.pollutionGroup} />
        <DataRow label="קבוצת אגרה" value={specs.taxGroup} />
        <DataRow label="כריות אוויר" value={specs.airbags} />
        <DataRow label="דירוג בטיחות" value={specs.safetyRating} />
      </dl>

      {specs.safetyFeatures.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">
            מערכות בטיחות אקטיביות
          </h3>
          <div className="flex flex-wrap gap-2">
            {specs.safetyFeatures.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              >
                <Icon name="check" className="text-[11px]" />
                {f}
              </span>
            ))}
          </div>
        </>
      )}
    </ReportCard>
  );
}
