import { BRAND } from "../brand";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-slate-500">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-bold text-brand-dark">{BRAND.name}</div>
            <div>{BRAND.tagline}</div>
          </div>
          <div className="text-xs leading-relaxed sm:max-w-md">
            המידע מבוסס על מאגרי משרד התחבורה (data.gov.il). מדדי סיכון נגזרים מדגלי המאגר ואינם
            רשומת תאונות. נתוני שעבודים אינם מאומתים מול רשם המשכונות הרשמי.
          </div>
        </div>
        <div className="mt-4 text-xs text-slate-400">
          © {new Date().getFullYear()} {BRAND.name}. כל הזכויות שמורות.
        </div>
      </div>
    </footer>
  );
}
