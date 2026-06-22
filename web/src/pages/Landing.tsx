import { SearchBar } from "../components/SearchBar";
import { Logo } from "../components/Logo";
import { Footer } from "../components/Footer";
import { Icon, type IconName } from "../components/Icon";
import { BRAND, SAMPLE_PLATES } from "../brand";

interface Props {
  onSearch: (plate: string) => void;
  onHome?: () => void;
}

export function Landing({ onSearch, onHome }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3.5">
          <Logo onHome={onHome} />
          <a href="#how" className="text-sm font-medium text-slate-500 hover:text-brand-600">
            איך זה עובד?
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero with the brand slogan */}
        <section className="relative overflow-hidden bg-[#26384f]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
               style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className="relative mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90">
              <Icon name="shield" className="text-xs" />
              נתונים אמיתיים בלבד · ללא ניחושים
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl">
              {BRAND.slogan}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">{BRAND.sloganSub}</p>

            <div className="mx-auto mt-10 max-w-xl rounded-2xl bg-white p-4 shadow-card">
              <SearchBar onSearch={onSearch} />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500">
                <span>דוגמאות:</span>
                {SAMPLE_PLATES.map((p) => (
                  <button
                    key={p}
                    onClick={() => onSearch(p)}
                    className="num rounded-lg border border-slate-200 bg-white px-3 py-1 font-bold text-[#26384f] transition hover:border-brand-400 hover:text-brand-600"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust band */}
        <section className="border-b border-slate-200/70 bg-white">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 py-8 text-center sm:grid-cols-4">
            <Stat icon="users" value="ציר זמן" label="בעלויות מתוארך" />
            <Stat icon="gauge" value="קילומטראז'" label="קריאה מאומתת" />
            <Stat icon="money" value="הערכת שווי" label="שווי שוק משוער" />
            <Stat icon="shield" value="פרופיל סיכון" label="דגלים ושעבודים" />
          </div>
        </section>

        <section id="how" className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-8 text-center text-2xl font-extrabold text-ink">מה תקבלו בדו"ח?</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <Feature
              icon="users"
              title="ציר זמן בעלויות"
              body="כל מעבר בעלות מתוארך — פרטי, ליסינג, סוחר — מתוך מאגר ההיסטוריה, לא רק ספירה כוללת."
            />
            <Feature
              icon="money"
              title="שווי שוק והערכת מחיר"
              body="הערכת שווי שקופה לפי שנתון, מנוע וסוג הנעה. תומך בחיבור מחירון מורשה (כגון לוי יצחק) בעל רישיון."
            />
            <Feature
              icon="shield"
              title="מדדי סיכון שקופים"
              body="שינוי מבנה, גניבה/החרמה, הורדה מהכביש, שעבודים — עם הסבר על מקור הבדיקה."
            />
            <Feature
              icon="wrench"
              title="ריקולים ובטיחות"
              body="קריאות שירות תואמות לדגם ורשימת מערכות בטיחות אקטיביות מלאה ממאגר היצרן."
            />
            <Feature
              icon="leaf"
              title="נתוני זיהום וצריכה"
              body="ציון ירוק, פליטות CO2 לפי WLTP וקבוצת אגרה — ישירות ממאגר משרד התחבורה."
            />
            <Feature
              icon="doc"
              title="דו&quot;ח PDF ממותג"
              body="הורדה מיידית של דו&quot;ח מעוצב בעברית, מוכן להדפסה או לשליחה לקונה."
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name={icon} className="text-base" />
      </span>
      <div className="font-bold text-ink">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name={icon} className="text-base" />
      </span>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  );
}
