import { Icon } from "./Icon";
import type { VehicleHealth } from "../lib/insights";

const GRADE_COLOR: Record<VehicleHealth["grade"], { ring: string; text: string; chip: string }> = {
  A: { ring: "#10b981", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700" },
  B: { ring: "#4f46e5", text: "text-brand-600", chip: "bg-brand-50 text-brand-700" },
  C: { ring: "#f59e0b", text: "text-amber-600", chip: "bg-amber-50 text-amber-700" },
  D: { ring: "#ef4444", text: "text-rose-600", chip: "bg-rose-50 text-rose-700" },
};

/** Hero "Vehicle Health" card with a circular gauge and explained factors. */
export function TrustScore({ health, narrative }: { health: VehicleHealth; narrative: string }) {
  const c = GRADE_COLOR[health.grade];
  const R = 52;
  const circ = 2 * Math.PI * R;
  const dash = (health.score / 100) * circ;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-8">
        {/* Gauge */}
        <div className="relative mx-auto h-36 w-36 shrink-0">
          <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#eef2f7" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={c.ring}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`num text-4xl font-extrabold ${c.text}`}>{health.score}</span>
            <span className="text-xs text-slate-400">מתוך 100</span>
          </div>
        </div>

        {/* Headline + factors */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${c.chip}`}>
              דירוג {health.grade} · {health.label}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{narrative}</p>

          {health.factors.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {health.factors.map((f, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${factorTone(
                    f.tone,
                  )}`}
                >
                  <Icon
                    name={f.tone === "good" ? "check" : f.tone === "muted" ? "users" : "alert"}
                    className="text-[11px]"
                  />
                  {f.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function factorTone(tone: string): string {
  switch (tone) {
    case "good":
      return "bg-emerald-50 text-emerald-700";
    case "warn":
      return "bg-amber-50 text-amber-700";
    case "bad":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-50 text-slate-500";
  }
}
