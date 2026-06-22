import { ReportCard } from "./ReportCard";
import type { MarketValue } from "../types";

function shekels(n: number) {
  return "₪" + n.toLocaleString("he-IL");
}

/**
 * Market-value card. Shows the best price we have: an authoritative licensed
 * price if wired, else a self-estimate anchored to the official gov list price.
 * Also surfaces the original new-car list price + importer (real gov data) and a
 * used-market price range as a visual scale.
 */
export function PricingCard({ pricing }: { pricing: MarketValue }) {
  const { authoritative: a, estimate: e, originalListPrice: lp, marketRange: mr } = pricing;
  const headline = a?.amount ?? e?.amount ?? null;
  const headlineLabel = a ? `מקור: ${a.source}` : "הערכת שווי נוכחית";

  return (
    <ReportCard icon="money" title="שווי שוק" subtitle="מחיר משוער ומחירון רשמי" meta={pricing.meta}>
      {headline !== null ? (
        <>
          <div className="num text-4xl font-extrabold text-ink">{shekels(headline)}</div>
          <p className="mt-1 text-xs text-slate-400">{headlineLabel}</p>
        </>
      ) : (
        <p className="text-sm italic text-slate-400">לא ניתן להעריך שווי — חסרים נתוני שנתון/מנוע.</p>
      )}

      {/* Used-market range scale (יד2-style) */}
      {mr && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
            <span>טווח מחירים בשוק החופשי לרכב דומה</span>
          </div>
          <div className="relative h-2 rounded-full bg-gradient-to-l from-emerald-200 via-amber-200 to-rose-200">
            {headline !== null && headline >= mr.low && headline <= mr.high && (
              <span
                className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow"
                style={{ insetInlineStart: `calc(${((headline - mr.low) / Math.max(1, mr.high - mr.low)) * 100}% - 8px)` }}
              />
            )}
          </div>
          <div className="num mt-1.5 flex justify-between text-sm font-bold text-ink">
            <span>{shekels(mr.low)}</span>
            <span>{shekels(mr.high)}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{mr.basis}</p>
        </div>
      )}

      {/* Original list price (real gov data) */}
      {lp && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <div>
            <div className="text-xs text-slate-500">מחיר מחירון מקורי (משרד התחבורה)</div>
            {lp.importer && <div className="text-[11px] text-slate-400">יבואן: {lp.importer}</div>}
          </div>
          <div className="num text-lg font-bold text-ink">{shekels(lp.amount)}</div>
        </div>
      )}

      {e && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{e.method}</p>
      )}
    </ReportCard>
  );
}
