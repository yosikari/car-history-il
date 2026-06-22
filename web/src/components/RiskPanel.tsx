import { ReportCard, DataRow } from "./ReportCard";
import { Icon } from "./Icon";
import type { AccidentInfo, LienInfo, RiskAssessment, RiskIndicators } from "../types";

/** Prominent stolen-vehicle check banner — driven by the real registry flag. */
function TheftBanner({ theft }: { theft: RiskIndicators["theftCheck"] }) {
  const tone =
    theft.status === "flagged"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : theft.status === "clear"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-500";
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-xl border p-3.5 ${tone}`}>
      <Icon
        name={theft.status === "flagged" ? "alert" : theft.status === "clear" ? "check" : "shield"}
        className="mt-0.5 text-base"
      />
      <div>
        <div className="text-sm font-bold">בדיקת מאגר רכב גנוב</div>
        <p className="mt-0.5 text-xs leading-relaxed">{theft.statement}</p>
      </div>
    </div>
  );
}

function yesNo(v: boolean | null) {
  if (v === null) return "—";
  return v ? "כן" : "לא";
}

function Assessment({ a, fallback }: { a?: RiskAssessment; fallback: string }) {
  if (!a) return <p className="text-sm italic text-slate-400">{fallback}</p>;
  const tone =
    a.level === "medium"
      ? "border-amber-200 bg-amber-50/60"
      : a.level === "low"
        ? "border-emerald-200 bg-emerald-50/60"
        : "border-slate-200 bg-slate-50";
  return (
    <div className={`rounded-xl border p-3.5 ${tone}`}>
      <p className="text-sm font-semibold leading-relaxed text-ink">{a.statement}</p>
      <p className="mt-1.5 text-xs text-slate-500">בסיס הבדיקה: {a.basis}</p>
    </div>
  );
}

export function RiskPanel({
  risk,
  liens,
  accidents,
}: {
  risk: RiskIndicators;
  liens: LienInfo;
  accidents: AccidentInfo;
}) {
  return (
    <ReportCard
      icon="shield"
      title="פרופיל סיכון"
      subtitle="מדדי רשם, שעבודים ותאונות"
      meta={risk.meta}
    >
      <TheftBanner theft={risk.theftCheck} />
      <dl className="grid gap-x-10 sm:grid-cols-2">
        <DataRow
          label="שינוי מבנה"
          value={yesNo(risk.structureChanged)}
          tone={risk.structureChanged ? "bad" : undefined}
        />
        <DataRow label="שינוי צבע" value={yesNo(risk.colorChanged)} />
        <DataRow label="שינוי מידת צמיג" value={yesNo(risk.tireSizeChanged)} />
        <DataRow
          label="רישום גניבה/החרמה"
          value={yesNo(risk.recordedAsStolenOrConfiscated)}
          tone={risk.recordedAsStolenOrConfiscated ? "bad" : undefined}
        />
        <DataRow
          label="היה מורד מהכביש"
          value={yesNo(risk.wasOffRoad)}
          tone={risk.wasOffRoad ? "bad" : undefined}
        />
        <DataRow label="תג חניה לנכה" value={yesNo(risk.hasDisabledParkingTag)} />
      </dl>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            שעבודים ומשכונות
          </h3>
          {liens.meta.status === "unavailable" ? (
            <Assessment a={liens.riskAssessment} fallback={liens.meta.note ?? "מקור לא זמין"} />
          ) : liens.hasLien ? (
            <p className="text-sm font-bold text-rose-600">קיימים שעבודים ({liens.liens.length})</p>
          ) : (
            <p className="text-sm font-semibold text-emerald-600">לא נמצאו שעבודים</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            היסטוריית תאונות
          </h3>
          {accidents.meta.status === "unavailable" ? (
            <Assessment
              a={accidents.riskAssessment}
              fallback={accidents.meta.note ?? "מקור לא זמין"}
            />
          ) : accidents.records.length ? (
            <ul className="list-inside list-disc text-sm text-slate-600">
              {accidents.records.map((rec, i) => (
                <li key={i}>
                  {rec.date} — {rec.severity}: {rec.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-semibold text-emerald-600">לא נמצאו רשומות תאונה</p>
          )}
        </div>
      </div>
    </ReportCard>
  );
}
