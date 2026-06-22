import { useState } from "react";
import { Landing } from "./pages/Landing";
import { Report } from "./pages/Report";
import { LoadingState } from "./components/LoadingState";
import { Logo } from "./components/Logo";
import { fetchReport, ApiError } from "./api";
import type { UnifiedVehicleReport } from "./types";

type View =
  | { kind: "landing" }
  | { kind: "loading"; plate: string }
  | { kind: "report"; report: UnifiedVehicleReport }
  | { kind: "error"; plate: string; message: string };

export default function App() {
  const [view, setView] = useState<View>({ kind: "landing" });

  async function search(plate: string) {
    setView({ kind: "loading", plate });
    try {
      const report = await fetchReport(plate);
      setView({ kind: "report", report });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "אירעה שגיאה. נסו שוב.";
      setView({ kind: "error", plate, message });
    }
  }

  const goHome = () => setView({ kind: "landing" });

  if (view.kind === "report") {
    return <Report report={view.report} onBack={goHome} />;
  }

  if (view.kind === "loading") {
    return (
      <div className="min-h-screen">
        <header className="mx-auto flex max-w-4xl items-center px-6 py-5">
          <Logo onHome={goHome} />
        </header>
        <div className="px-6 py-10">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo onHome={goHome} />
        <p className="max-w-md text-lg font-semibold text-slate-700">{view.message}</p>
        <p className="num text-sm text-slate-400">מספר רישוי: {view.plate}</p>
        <button
          onClick={goHome}
          className="rounded-xl bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700"
        >
          חזרה לחיפוש
        </button>
      </div>
    );
  }

  return <Landing onSearch={search} onHome={goHome} />;
}
