import { useState } from "react";
import { normalizePlate } from "../api";

interface Props {
  onSearch: (plate: string) => void;
  loading?: boolean;
  initial?: string;
}

export function SearchBar({ onSearch, loading, initial = "" }: Props) {
  const [value, setValue] = useState(initial);
  const clean = normalizePlate(value);
  const valid = clean.length >= 5 && clean.length <= 8;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (valid && !loading) onSearch(clean);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          inputMode="numeric"
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="הקלידו מספר רישוי (לדוגמה 66304902)"
          className="num flex-1 rounded-xl border-2 border-slate-200 bg-white px-5 py-4 text-center text-xl font-bold tracking-widest shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          aria-label="מספר רישוי"
        />
        <button
          type="submit"
          disabled={!valid || loading}
          className="rounded-xl bg-brand-600 px-8 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "מפיק דו\"ח…" : "הפק דו\"ח"}
        </button>
      </div>
      {value && !valid && (
        <p className="mt-2 text-sm text-amber-600">מספר רישוי צריך להכיל 5–8 ספרות.</p>
      )}
    </form>
  );
}
