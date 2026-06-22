export function LoadingState() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4" role="status" aria-label="טוען">
      <div className="h-28 rounded-2xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-2xl bg-slate-200" />
        <div className="h-40 rounded-2xl bg-slate-200" />
      </div>
      <div className="h-56 rounded-2xl bg-slate-200" />
      <p className="text-center text-sm text-slate-500">אוסף נתונים ממאגרי משרד התחבורה…</p>
    </div>
  );
}
