import { ReportCard } from "./ReportCard";
import type { LicenseAndTest } from "../types";

/**
 * Mileage card. Israel's open data confirms exactly ONE odometer reading, so we
 * show that single value prominently plus a clearly-labeled km/year estimate.
 * No fabricated multi-point history.
 */
export function MileageCard({ license }: { license: LicenseAndTest }) {
  const m = license.mileage;

  if (m.km === null) {
    return (
      <ReportCard icon="gauge" title="קילומטראז'" meta={license.meta}>
        <p className="text-sm italic text-slate-400">אין קריאת מד-אוץ זמינה</p>
      </ReportCard>
    );
  }

  return (
    <ReportCard icon="gauge" title="קילומטראז'" subtitle="קריאת מד-אוץ מאומתת" meta={license.meta}>
      <div className="flex items-end gap-2">
        <span className="num text-4xl font-extrabold text-ink">
          {m.km.toLocaleString("he-IL")}
        </span>
        <span className="mb-1 text-sm font-medium text-slate-400">ק"מ</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">קריאה יחידה מאומתת · {m.atDate}</p>

      {m.estimatedAnnualKm !== null && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">ק"מ שנתי ממוצע (הערכה)</span>
            <span className="num text-sm font-bold text-ink">
              {m.estimatedAnnualKm.toLocaleString("he-IL")}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            הערכה מחושבת מהגיל והקריאה — לא נמדדה ישירות.
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        המאגר הציבורי מפרסם קריאת מד-אוץ אחת בלבד (הטסט האחרון); אין היסטוריית קילומטראז'
        רב-נקודתית במקורות הפתוחים.
      </p>
    </ReportCard>
  );
}
