/**
 * Presentation layer (Phase 3).
 *
 * Renders the Unified Vehicle Data Schema into a self-contained, RTL Hebrew
 * HTML report mirroring the structure of professional Israeli vehicle reports
 * (specs → license/test → ownership → risk → recalls → liens → accidents).
 *
 * The HTML is print-ready: open it and "Save as PDF", or feed it to a headless
 * browser (Playwright/Puppeteer) for automated PDF generation — no PDF binary
 * dependency is baked in, keeping the core install light. `renderPdf` documents
 * that path.
 */
import { BRAND } from "../branding.js";
import type {
  OwnershipInfo,
  RiskAssessment,
  SectionMeta,
  TheftCheck,
  UnifiedVehicleReport,
} from "../core/schema.js";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function yesNo(v: boolean | null): string {
  if (v === null) return "—";
  return v ? "כן" : "לא";
}

/**
 * Section status indicator. Premium behavior: sections that returned data show
 * NO badge (no "Source: Available" clutter). Only genuinely unavailable/errored
 * sections get a single subtle, muted hint.
 */
function badge(meta: SectionMeta): string {
  if (meta.status === "ok" || meta.status === "partial" || meta.status === "not_found") return "";
  const note = meta.note ? ` title="${esc(meta.note)}"` : "";
  return `<span class="badge muted"${note}>לא אומת ממקור רשמי</span>`;
}

function row(label: string, value: unknown): string {
  return `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
}

/**
 * Vehicle Health score + grade, derived from real risk signals only (mirrors the
 * web computeHealth). Transparent deductions; never invents data.
 */
function annualKmPenalty(km: number): number {
  if (km > 32000) return -30;
  if (km > 26000) return -22;
  if (km > 20000) return -13;
  if (km > 16000) return -6;
  if (km < 11000) return 3;
  return 0;
}

function computeHealth(r: UnifiedVehicleReport): { score: number; grade: string; label: string } {
  let score = 100;
  const caps: number[] = [];
  const k = r.riskIndicators;
  if (k.structureChanged) score -= 25;
  if (k.recordedAsStolenOrConfiscated) {
    score -= 45;
    caps.push(50);
  }
  if (k.wasOffRoad) {
    score -= 45;
    caps.push(55);
  }
  if (k.colorChanged) score -= 6;
  if (k.tireSizeChanged) score -= 3;
  const annualKm = r.license.mileage.estimatedAnnualKm;
  if (annualKm !== null) score += annualKmPenalty(annualKm);
  if (r.license.isCurrentlyValid === false) score -= 10;
  if (r.recalls.items.length) score -= Math.min(12, r.recalls.items.length * 4);
  const owners = r.ownership.observedOwnerRecords ?? 0;
  if (owners >= 5) score -= 10;
  else if (owners >= 4) score -= 6;
  if (r.liens.hasLien === true) {
    score -= 30;
    caps.push(60);
  }
  score = Math.max(0, Math.min(100, score));
  if (caps.length) score = Math.min(score, Math.min(...caps));
  score = Math.max(0, score);
  const grade = score >= 90 ? "A" : score >= 78 ? "B" : score >= 60 ? "C" : "D";
  const label =
    grade === "A" ? "מצב מצוין" : grade === "B" ? "מצב טוב" : grade === "C" ? "דורש בדיקה" : "סיכון גבוה";
  return { score, grade, label };
}

/** "Summary by CarHistoryIL" — human narrative from real fields. */
function buildNarrative(r: UnifiedVehicleReport, score: number, label: string): string {
  const s = r.specs;
  const parts: string[] = [];
  const name = [s.make, s.commercialName ?? s.model].filter(Boolean).join(" ");
  if (name) parts.push(`${name}${s.year ? ` משנת ${s.year}` : ""}.`);
  const owners = r.ownership.observedOwnerRecords;
  if (owners && owners > 0)
    parts.push(owners === 1 ? "נצפתה תקופת בעלות אחת במאגר." : `נצפו ${owners} תקופות בעלות.`);
  const k = r.riskIndicators;
  if (k.wasOffRoad)
    parts.push(
      "⚠️ הרכב היה מורד מהכביש בעבר — אירוע משמעותי שעלול להעיד על נזק כבד. חובה בדיקה במכון מורשה.",
    );
  if (k.recordedAsStolenOrConfiscated)
    parts.push("⚠️ הרכב מסומן ברישום גניבה/החרמה — נדרש בירור מול המשטרה.");
  const trauma: string[] = [];
  if (k.structureChanged) trauma.push("שינוי מבנה");
  if (k.colorChanged) trauma.push("שינוי צבע");
  if (k.tireSizeChanged) trauma.push("שינוי מידת צמיג");
  if (trauma.length) parts.push(`דגלים נוספים: ${trauma.join(", ")} — מומלץ לבדוק לעומק.`);
  else if (!k.wasOffRoad && !k.recordedAsStolenOrConfiscated && k.structureChanged === false)
    parts.push("קודי הרשם אינם מעידים על אירוע טראומטי — תואם להיסטוריה נקייה ככל שניתן לקרוא מהמאגר הציבורי.");
  if (r.license.mileage.km !== null) {
    const a = r.license.mileage.estimatedAnnualKm;
    const note = a !== null && a > 20000 ? ` (ק"מ שנתי גבוה — כ-${a.toLocaleString("he-IL")})` : "";
    parts.push(`קריאת מד-אוץ אחרונה: ${r.license.mileage.km.toLocaleString("he-IL")} ק"מ${note}.`);
  }
  parts.push(`ציון בריאות הרכב: ${score}/100 (${label}).`);
  return parts.join(" ");
}

const GRADE_HEX: Record<string, string> = { A: "#10b981", B: "#4f46e5", C: "#f59e0b", D: "#ef4444" };

function heroBlock(r: UnifiedVehicleReport): string {
  const h = computeHealth(r);
  const narrative = buildNarrative(r, h.score, h.label);
  const color = GRADE_HEX[h.grade] ?? "#4f46e5";
  return `
  <section class="hero">
    <div class="gauge" style="--c:${color}; --p:${h.score}">
      <div class="gauge-num" style="color:${color}">${h.score}</div>
      <div class="gauge-sub">מתוך 100</div>
    </div>
    <div class="hero-body">
      <span class="grade" style="background:${color}1a; color:${color}">דירוג ${esc(h.grade)} · ${esc(h.label)}</span>
      <h3 class="hero-title">סיכום מאת CarHistoryIL</h3>
      <p class="hero-text">${esc(narrative)}</p>
    </div>
  </section>`;
}

/** Vertical ownership timeline from the mined periods. */
function timelineBlock(o: OwnershipInfo): string {
  if (!o.timeline.length) {
    return `<p class="empty">לא נמצאו רשומות בעלות מתוארכות</p>`;
  }
  const items = o.timeline
    .map(
      (p) =>
        `<li><span class="tl-date">${esc(p.date ?? p.rawPeriod ?? "—")}</span>` +
        `<span class="tl-type">${esc(p.ownershipType)}</span></li>`,
    )
    .join("");
  return `<ol class="timeline">${items}</ol>`;
}

/** Usage chips (lease / dealer / import / taxi / school) — only for true flags. */
function usageBlock(o: OwnershipInfo): string {
  const u = o.usageProfile;
  const chips: string[] = [];
  if (u.wasImported) chips.push("יבוא");
  if (u.wasLease) chips.push("ליסינג/החכר");
  if (u.wasRental) chips.push("השכרה");
  if (u.wasDealer) chips.push("עבר דרך סוחר");
  if (u.wasTaxi) chips.push("מונית");
  if (u.wasDrivingSchool) chips.push("רכב לימוד נהיגה");
  if (!chips.length) return "";
  return `<div class="chips">${chips
    .map((c) => `<span class="chip">${esc(c)}</span>`)
    .join("")}</div>`;
}

/** Honest mileage card: one confirmed reading + labeled estimate. */
function mileageBlock(r: UnifiedVehicleReport): string {
  const m = r.license.mileage;
  if (m.km === null) return `<p class="empty">אין קריאת מד-אוץ זמינה</p>`;
  const est =
    m.estimatedAnnualKm !== null
      ? `<div class="mile-est">הערכת ק"מ שנתי ממוצע: <b>${esc(
          m.estimatedAnnualKm.toLocaleString("he-IL"),
        )}</b> <span class="muted-note">(הערכה מחושבת, לא נמדדה)</span></div>`
      : "";
  return `
    <div class="mile">
      <div class="mile-point">
        <div class="mile-km">${esc(m.km.toLocaleString("he-IL"))} ק"מ</div>
        <div class="muted-note">קריאה מאומתת יחידה · ${esc(m.atDate)}</div>
      </div>
      ${est}
      <p class="muted-note">המאגר הציבורי מפרסם קריאת מד-אוץ אחת בלבד (טסט אחרון); אין היסטוריית קילומטראז' רב-נקודתית.</p>
    </div>`;
}

/** Market-value block: headline price + market range + official list price. */
function pricingBlock(r: UnifiedVehicleReport): string {
  const p = r.pricing;
  const ils = (n: number) => "₪" + n.toLocaleString("he-IL");
  const headline = p.authoritative?.amount ?? p.estimate?.amount ?? null;
  if (headline === null) {
    return `<p class="empty">לא ניתן להעריך שווי — חסרים נתוני שנתון/מנוע.</p>`;
  }
  const label = p.authoritative ? `מקור: ${esc(p.authoritative.source)}` : "הערכת שווי נוכחית";

  const range = p.marketRange
    ? `<div class="mile-est">טווח שוק לרכב דומה: <b>${esc(ils(p.marketRange.low))} – ${esc(
        ils(p.marketRange.high),
      )}</b><div class="muted-note">${esc(p.marketRange.basis)}</div></div>`
    : "";

  const listPrice = p.originalListPrice
    ? `<table style="margin-top:12px">${row(
        "מחיר מחירון מקורי (משרד התחבורה)",
        ils(p.originalListPrice.amount),
      )}${p.originalListPrice.importer ? row("יבואן", p.originalListPrice.importer) : ""}</table>`
    : "";

  const method = p.estimate ? `<p class="muted-note" style="margin-top:8px">${esc(p.estimate.method)}</p>` : "";

  return `
    <div class="mile-point"><div class="mile-km">${esc(ils(headline))}</div>
      <div class="muted-note">${label}</div></div>
    ${range}
    ${listPrice}
    ${method}`;
}

/** Prominent stolen-vehicle check banner (from the real gapam_ind flag). */
function theftBlock(t: TheftCheck): string {
  const cls =
    t.status === "flagged" ? "assess-bad" : t.status === "clear" ? "assess-low" : "assess-unknown";
  return `<div class="assess ${cls}" style="margin-bottom:12px">
      <p class="assess-stmt">🛡️ בדיקת מאגר רכב גנוב</p>
      <p class="assess-basis" style="font-size:13px;color:var(--ink)">${esc(t.statement)}</p>
    </div>`;
}

/** Sourced risk-assessment block replacing a blank "N/A". */
function assessmentBlock(a: RiskAssessment | undefined, fallback: string): string {
  if (!a) return fallback;
  const cls =
    a.level === "medium" ? "assess-medium" : a.level === "low" ? "assess-low" : "assess-unknown";
  return `<div class="assess ${cls}">
      <p class="assess-stmt">${esc(a.statement)}</p>
      <p class="assess-basis">בסיס הבדיקה: ${esc(a.basis)}</p>
    </div>`;
}

export function renderHtml(r: UnifiedVehicleReport): string {
  const s = r.specs;
  const l = r.license;
  const o = r.ownership;
  const k = r.riskIndicators;

  const recallRows = r.recalls.items.length
    ? r.recalls.items
        .map(
          (it) =>
            `<tr><td>${esc(it.year)}</td><td>${esc(it.faultType)}</td><td>${esc(
              it.faultDescription,
            )}</td><td>${esc(it.remedy)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty">לא נמצאו קריאות שירות (ריקול) תואמות</td></tr>`;

  const lienBlock =
    r.liens.meta.status === "unavailable"
      ? assessmentBlock(r.liens.riskAssessment, `<p class="unavailable">${esc(r.liens.meta.note)}</p>`)
      : r.liens.hasLien
        ? `<p class="danger">קיימים שעבודים (${r.liens.liens.length})</p>`
        : `<p class="ok-text">לא נמצאו שעבודים</p>`;

  const accidentBlock =
    r.accidents.meta.status === "unavailable"
      ? assessmentBlock(
          r.accidents.riskAssessment,
          `<p class="unavailable">${esc(r.accidents.meta.note)}</p>`,
        )
      : r.accidents.records.length
        ? `<ul>${r.accidents.records
            .map((a) => `<li>${esc(a.date)} — ${esc(a.severity)}: ${esc(a.description)}</li>`)
            .join("")}</ul>`
        : `<p class="ok-text">לא נמצאו רשומות תאונה</p>`;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(BRAND.name)} · דו"ח רכב ${esc(r.plate)}</title>
<style>
  :root { --ink:${BRAND.colors.ink}; --muted:${BRAND.colors.muted}; --line:${BRAND.colors.line}; --brand:${BRAND.colors.brand}; --brand-dark:${BRAND.colors.brandDark}; --ok:${BRAND.colors.ok}; --warn:${BRAND.colors.warn}; --danger:${BRAND.colors.danger}; --canvas:${BRAND.colors.canvas}; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: var(--ink); margin: 0; background:var(--canvas); }
  .page { max-width: 880px; margin: 0 auto; background:#fff; padding: 32px 40px; }
  header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid var(--brand); padding-bottom:14px; }
  header h1 { margin:0; font-size:26px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .logo { width:38px; height:38px; border-radius:9px; background:linear-gradient(135deg,var(--brand),var(--brand-dark)); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; }
  .brand-name { font-size:20px; font-weight:800; color:var(--brand-dark); }
  .brand-tag { font-size:11px; color:var(--muted); }
  .plate { font-size:30px; font-weight:800; letter-spacing:2px; background:#ffd84d; padding:6px 16px; border-radius:8px; border:2px solid #222; }
  .sub { color:var(--muted); font-size:13px; margin-top:4px; }
  .completeness { font-size:13px; color:var(--muted); }
  section { margin-top:26px; }
  section h2 { font-size:17px; border-right:4px solid var(--brand); padding-right:10px; margin:0 0 12px; display:flex; gap:10px; align-items:center; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:right; padding:8px 10px; border-bottom:1px solid var(--line); }
  table th { width:42%; color:var(--muted); font-weight:600; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0 32px; }
  .badge { font-size:11px; padding:2px 8px; border-radius:999px; font-weight:600; }
  .badge.ok { background:#e6f6ec; color:var(--ok); }
  .badge.warn { background:#fff4e0; color:var(--warn); }
  .badge.muted { background:#eef0f4; color:var(--muted); }
  .recalls td { font-size:13px; }
  .empty, .unavailable { color:var(--muted); font-style:italic; }
  .danger { color:var(--danger); font-weight:700; }
  .ok-text { color:var(--ok); font-weight:600; }
  .disclaimer { margin-top:28px; font-size:11px; color:var(--muted); border-top:1px solid var(--line); padding-top:12px; line-height:1.6; }
  .timeline { list-style:none; margin:0; padding:0; border-right:2px solid var(--line); }
  .timeline li { position:relative; padding:6px 18px 6px 0; }
  .timeline li::before { content:""; position:absolute; right:-7px; top:12px; width:10px; height:10px; border-radius:50%; background:var(--brand); }
  .tl-date { font-weight:700; margin-left:10px; }
  .tl-type { color:var(--muted); }
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
  .chip { font-size:12px; padding:3px 10px; border-radius:999px; background:#eef4ff; color:var(--brand-dark); font-weight:600; }
  .mile-point { display:inline-block; background:var(--canvas); border:1px solid var(--line); border-radius:10px; padding:10px 16px; }
  .mile-km { font-size:22px; font-weight:800; color:var(--brand-dark); }
  .mile-est { margin-top:10px; font-size:14px; }
  .muted-note { font-size:11px; color:var(--muted); }
  .assess { border-radius:10px; padding:12px 14px; border:1px solid var(--line); }
  .assess-medium { background:#fff7ed; border-color:#fed7aa; }
  .assess-low { background:#f0fdf4; border-color:#bbf7d0; }
  .assess-bad { background:#fef2f2; border-color:#fecaca; }
  .assess-unknown { background:var(--canvas); }
  .assess-stmt { margin:0 0 6px; font-weight:600; }
  .assess-basis { margin:0; font-size:11px; color:var(--muted); }
  .hero { display:flex; gap:24px; align-items:center; margin-top:22px; padding:20px 22px; border:1px solid var(--line); border-radius:18px; box-shadow:0 8px 24px -12px rgba(15,23,42,.15); }
  .gauge { position:relative; width:120px; height:120px; flex:none; border-radius:50%; background:conic-gradient(var(--c) calc(var(--p)*1%), #eef2f7 0); display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .gauge::after { content:""; position:absolute; inset:11px; background:#fff; border-radius:50%; }
  .gauge-num { position:relative; font-size:34px; font-weight:800; line-height:1; z-index:1; }
  .gauge-sub { position:relative; font-size:11px; color:var(--muted); z-index:1; }
  .grade { display:inline-block; font-size:13px; font-weight:800; padding:4px 12px; border-radius:999px; }
  .hero-title { margin:10px 0 4px; font-size:15px; }
  .hero-text { margin:0; font-size:13px; color:#475569; line-height:1.7; }
  @media print { body { background:#fff; } .page { padding:0; } .hero { box-shadow:none; } }
</style>
</head>
<body>
<div class="page">
  <header>
    <div>
      <div class="brand">
        <div class="logo">CH</div>
        <div>
          <div class="brand-name">${esc(BRAND.name)}</div>
          <div class="brand-tag">${esc(BRAND.tagline)}</div>
        </div>
      </div>
      <div class="sub" style="margin-top:10px">דו"ח מידע על רכב · הופק ב-${esc(
        new Date(r.generatedAt).toLocaleString("he-IL"),
      )}</div>
      <div class="completeness">שלמות נתונים: ${Math.round(r.completeness * 100)}% · סיווג: ${esc(
        r.classification.category,
      )}</div>
    </div>
    <div class="plate">${esc(r.plate)}</div>
  </header>

  ${heroBlock(r)}

  <section>
    <h2>מפרט הרכב ${badge(s.meta)}</h2>
    <div class="grid">
      <table>
        ${row("יצרן", s.make)}
        ${row("דגם", s.model)}
        ${row("כינוי מסחרי", s.commercialName)}
        ${row("רמת גימור", s.trimLevel)}
        ${row("שנת ייצור", s.year)}
        ${row("סוג דלק", s.fuelType)}
        ${row("דגם מנוע", s.engineModel)}
        ${row("נפח מנוע (סמ\"ק)", s.engineDisplacementCc)}
      </table>
      <table>
        ${row("כוח סוס", s.horsepower)}
        ${row("תיבת הילוכים", s.gearbox === "automatic" ? "אוטומט" : s.gearbox === "manual" ? "ידני" : null)}
        ${row("הנעה", s.drivetrain)}
        ${row("טכנולוגיית הנעה", s.powertrainTech)}
        ${row("מספר מושבים", s.seats)}
        ${row("צבע", s.color)}
        ${row("מספר שלדה", s.frameNumber)}
        ${row("ציון ירוק", s.greenScore)}
        ${row("פליטת CO₂ (WLTP)", s.co2Wltp)}
      </table>
    </div>
    ${
      s.safetyFeatures.length
        ? `<div class="chips" style="margin-top:14px">${s.safetyFeatures
            .map((f) => `<span class="chip">${esc(f)}</span>`)
            .join("")}</div>`
        : ""
    }
  </section>

  <section>
    <h2>רישוי וטסט ${badge(l.meta)}</h2>
    <table>
      ${row("תוקף רישיון (טסט)", l.testValidUntil)}
      ${row("רישיון בתוקף", yesNo(l.isCurrentlyValid))}
      ${row("מועד טסט אחרון", l.lastTestDate)}
    </table>
  </section>

  <section>
    <h2>קילומטראז' (מד-אוץ) ${badge(l.meta)}</h2>
    ${mileageBlock(r)}
  </section>

  <section>
    <h2>שווי שוק ${badge(r.pricing.meta)}</h2>
    ${pricingBlock(r)}
  </section>

  <section>
    <h2>בעלות והיסטוריה ${badge(o.meta)}</h2>
    <table>
      ${row("סוג בעלות נוכחי", o.ownershipType)}
      ${row("מקוריות", o.originType)}
      ${row("מועד רישום ראשון", o.firstRegistrationDate)}
      ${row("רשומות בעלות שנצפו", o.observedOwnerRecords)}
    </table>
    ${usageBlock(o)}
    <h3 style="font-size:14px;margin:18px 0 8px;color:var(--muted)">ציר זמן בעלויות</h3>
    ${timelineBlock(o)}
  </section>

  <section>
    <h2>מדדי סיכון ${badge(k.meta)}</h2>
    <p class="sub">מדדים אלו נגזרים מדגלי המאגר הממשלתי — אינם תחליף לרשומת תאונות.</p>
    ${theftBlock(k.theftCheck)}
    <table>
      ${row("שינוי מבנה", yesNo(k.structureChanged))}
      ${row("שינוי צבע", yesNo(k.colorChanged))}
      ${row("שינוי מידת צמיג", yesNo(k.tireSizeChanged))}
      ${row("רישום גניבה/החרמה", yesNo(k.recordedAsStolenOrConfiscated))}
      ${row("היה מורד מהכביש", yesNo(k.wasOffRoad))}
      ${row("תג חניה לנכה", yesNo(k.hasDisabledParkingTag))}
    </table>
  </section>

  <section>
    <h2>קריאות שירות (ריקול) ${badge(r.recalls.meta)}</h2>
    <table class="recalls">
      <thead><tr><th>שנה</th><th>סוג תקלה</th><th>תיאור</th><th>אופן תיקון</th></tr></thead>
      <tbody>${recallRows}</tbody>
    </table>
  </section>

  <section>
    <h2>שעבודים ומשכונות ${badge(r.liens.meta)}</h2>
    ${lienBlock}
  </section>

  <section>
    <h2>היסטוריית תאונות ${badge(r.accidents.meta)}</h2>
    ${accidentBlock}
  </section>

  <div class="disclaimer">
    המידע מבוסס על מאגרי משרד התחבורה (data.gov.il) ומקורות נוספים, נכון למועד ההפקה.
    מדדי סיכון נגזרים מדגלי המאגר ואינם רשומת תאונות. נתוני שעבודים ותאונות מסופקים רק
    כאשר מוגדר ספק נתונים בעל הרשאה; בהיעדר ספק, הסעיף יסומן "מקור לא זמין" ולא יוצג מידע שגוי.
  </div>
</div>
</body>
</html>`;
}

/**
 * Generate a PDF from the report. Kept dependency-free by default: if Playwright
 * is installed it is used to print the HTML to PDF; otherwise we throw a clear
 * instruction rather than emitting a broken file.
 */
export async function renderPdf(r: UnifiedVehicleReport): Promise<Uint8Array> {
  const html = renderHtml(r);
  try {
    // Dynamic, untyped import so the core has no hard dependency on a browser
    // engine and the build does not require @types/playwright to be present.
    const pw: any = await import(/* @vite-ignore */ "playwright" as string);
    const browser = await pw.chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      return await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
    } finally {
      await browser.close();
    }
  } catch (e) {
    throw new Error(
      "PDF generation requires Playwright. Install with `npm i -D playwright && npx playwright install chromium`, " +
        "or use renderHtml() and print-to-PDF. Underlying: " +
        (e as Error).message,
    );
  }
}
