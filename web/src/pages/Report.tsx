import { Logo } from "../components/Logo";
import { Footer } from "../components/Footer";
import { SpecGrid } from "../components/SpecGrid";
import { OwnershipTimeline } from "../components/OwnershipTimeline";
import { LifecycleTimeline } from "../components/LifecycleTimeline";
import { MileageCard } from "../components/MileageCard";
import { RiskPanel } from "../components/RiskPanel";
import { PricingCard } from "../components/PricingCard";
import { SafetyEcoCard } from "../components/SafetyEcoCard";
import { TrustScore } from "../components/TrustScore";
import { ReportCard, DataRow } from "../components/ReportCard";
import { Icon } from "../components/Icon";
import { computeHealth, buildNarrative } from "../lib/insights";
import { pdfUrl } from "../api";
import type { UnifiedVehicleReport } from "../types";

interface Props {
  report: UnifiedVehicleReport;
  onBack: () => void;
}

export function Report({ report: r, onBack }: Props) {
  const completeness = Math.round(r.completeness * 100);
  const health = computeHealth(r);
  const narrative = buildNarrative(r, health);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3.5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600"
          >
            <Icon name="magnify" className="text-sm" />
            חיפוש חדש
          </button>
          <Logo onHome={onBack} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {/* Plate + meta + PDF */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-block rounded-lg border-2 border-slate-800 bg-amber-300 px-3.5 py-1 num text-xl font-extrabold tracking-widest text-slate-900">
                {r.plate}
              </span>
              <div className="text-sm font-semibold text-ink">
                {[r.specs.make, r.specs.commercialName ?? r.specs.model].filter(Boolean).join(" ") ||
                  "רכב"}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              שלמות נתונים {completeness}% · הופק {new Date(r.generatedAt).toLocaleDateString("he-IL")}
            </p>
          </div>
          <a
            href={pdfUrl(r.plate)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Icon name="doc" className="text-sm" />
            הורד דו"ח PDF
          </a>
        </div>

        {/* Hero: Vehicle Health + Summary by CarHistoryIL */}
        <TrustScore health={health} narrative={narrative} />

        <div className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <PricingCard pricing={r.pricing} />
            <MileageCard license={r.license} />
          </div>

          <SpecGrid specs={r.specs} />

          <div className="grid gap-6 lg:grid-cols-2">
            <SafetyEcoCard specs={r.specs} />
            <ReportCard icon="check" title="רישוי וטסט" subtitle="תוקף נוכחי" meta={r.license.meta}>
              <dl>
                <DataRow label="תוקף רישיון (טסט)" value={r.license.testValidUntil} />
                <DataRow
                  label="רישיון בתוקף"
                  value={boolHe(r.license.isCurrentlyValid)}
                  tone={r.license.isCurrentlyValid === false ? "bad" : undefined}
                />
                <DataRow label="מועד טסט אחרון" value={r.license.lastTestDate} />
              </dl>
            </ReportCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <OwnershipTimeline ownership={r.ownership} />
            <LifecycleTimeline report={r} />
          </div>

          <RiskPanel risk={r.riskIndicators} liens={r.liens} accidents={r.accidents} />

          <ReportCard icon="wrench" title="קריאות שירות (ריקול)" meta={r.recalls.meta}>
            {r.recalls.items.length ? (
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 font-semibold">שנה</th>
                    <th className="font-semibold">סוג תקלה</th>
                    <th className="font-semibold">תיאור</th>
                  </tr>
                </thead>
                <tbody>
                  {r.recalls.items.map((it) => (
                    <tr key={it.recallId} className="border-t border-slate-100">
                      <td className="num py-2">{it.year ?? "—"}</td>
                      <td className="py-2">{it.faultType ?? "—"}</td>
                      <td className="py-2 text-slate-600">{it.faultDescription ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm font-medium text-emerald-600">
                לא נמצאו קריאות שירות תואמות לדגם.
              </p>
            )}
          </ReportCard>

          {r.warnings.length > 0 && (
            <details className="rounded-2xl border border-slate-200/70 bg-white p-4 text-xs text-slate-400 shadow-card">
              <summary className="cursor-pointer font-medium">
                הערות איסוף נתונים ({r.warnings.length})
              </summary>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {r.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function boolHe(v: boolean | null) {
  if (v === null) return "—";
  return v ? "כן" : "לא";
}
