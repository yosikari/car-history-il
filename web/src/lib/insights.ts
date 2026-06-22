/**
 * Client-side derivation of the "Vehicle Health" trust score and the human
 * narrative. These read ONLY real fields already in the report — no fabricated
 * data. The score is a transparent weighting of observable risk signals, and
 * every deduction is explained in `factors` so the UI can show its work.
 */
import type { UnifiedVehicleReport } from "../types";

export interface TrustFactor {
  label: string;
  /** Negative = risk/deduction, positive = reassurance, 0 = neutral/unknown. */
  delta: number;
  tone: "good" | "warn" | "bad" | "muted";
}

export interface VehicleHealth {
  /** 0–100 trust score. */
  score: number;
  grade: "A" | "B" | "C" | "D";
  label: string;
  factors: TrustFactor[];
}

export function computeHealth(r: UnifiedVehicleReport): VehicleHealth {
  const factors: TrustFactor[] = [];
  let score = 100;

  // Hard caps: a single serious event must prevent a high grade no matter what
  // else is clean. (A salvaged/stolen/encumbered car is never "excellent".)
  const caps: number[] = [];

  const k = r.riskIndicators;
  if (k.structureChanged) {
    score -= 25;
    factors.push({ label: "רישום שינוי מבנה", delta: -25, tone: "bad" });
  } else if (k.structureChanged === false) {
    factors.push({ label: "אין רישום שינוי מבנה", delta: 0, tone: "good" });
  }

  if (k.recordedAsStolenOrConfiscated) {
    score -= 45;
    caps.push(50);
    factors.push({ label: "רישום גניבה/החרמה", delta: -45, tone: "bad" });
  }
  // Off-road is a serious event (salvage / total-loss risk) — heavy penalty + cap.
  if (k.wasOffRoad) {
    score -= 45;
    caps.push(55);
    factors.push({ label: "היה מורד מהכביש (אירוע חמור)", delta: -45, tone: "bad" });
  }
  if (k.colorChanged) {
    score -= 6;
    factors.push({ label: "שינוי צבע", delta: -6, tone: "warn" });
  }
  if (k.tireSizeChanged) {
    score -= 3;
    factors.push({ label: "שינוי מידת צמיג", delta: -3, tone: "warn" });
  }

  // High annual mileage — a real wear signal the old model ignored entirely.
  const annualKm = r.license.mileage.estimatedAnnualKm;
  if (annualKm !== null) {
    const kmDelta = annualKmPenalty(annualKm);
    if (kmDelta < 0) {
      score += kmDelta;
      factors.push({
        label: `ק"מ שנתי גבוה (~${annualKm.toLocaleString("he-IL")})`,
        delta: kmDelta,
        tone: annualKm > 26000 ? "bad" : "warn",
      });
    } else if (kmDelta > 0) {
      score += kmDelta;
      factors.push({
        label: `ק"מ שנתי נמוך (~${annualKm.toLocaleString("he-IL")})`,
        delta: kmDelta,
        tone: "good",
      });
    }
  }

  // License validity is a real, current signal.
  if (r.license.isCurrentlyValid === true) {
    factors.push({ label: "רישיון (טסט) בתוקף", delta: 0, tone: "good" });
  } else if (r.license.isCurrentlyValid === false) {
    score -= 10;
    factors.push({ label: "רישיון (טסט) לא בתוקף", delta: -10, tone: "warn" });
  }

  // Open recalls matched to the model.
  if (r.recalls.items.length > 0) {
    score -= Math.min(12, r.recalls.items.length * 4);
    factors.push({
      label: `${r.recalls.items.length} קריאות שירות (ריקול) תואמות`,
      delta: -Math.min(12, r.recalls.items.length * 4),
      tone: "warn",
    });
  }

  // Ownership churn: many short ownerships is a mild signal.
  const owners = r.ownership.observedOwnerRecords ?? 0;
  if (owners >= 5) {
    score -= 10;
    factors.push({ label: `${owners} תקופות בעלות שנצפו`, delta: -10, tone: "warn" });
  } else if (owners >= 4) {
    score -= 6;
    factors.push({ label: `${owners} תקופות בעלות שנצפו`, delta: -6, tone: "warn" });
  } else if (owners > 0) {
    factors.push({ label: `${owners} תקופות בעלות שנצפו`, delta: 0, tone: "muted" });
  }

  // Liens are a hard signal when actually confirmed (never on "unavailable").
  if (r.liens.hasLien === true) {
    score -= 30;
    caps.push(60);
    factors.push({ label: "שעבוד פעיל רשום", delta: -30, tone: "bad" });
  }

  score = Math.max(0, Math.min(100, score));
  // Apply the hard caps from serious events.
  if (caps.length) score = Math.min(score, Math.min(...caps));
  score = Math.max(0, score);

  const grade: VehicleHealth["grade"] =
    score >= 90 ? "A" : score >= 78 ? "B" : score >= 60 ? "C" : "D";
  const label =
    grade === "A"
      ? "מצב מצוין"
      : grade === "B"
        ? "מצב טוב"
        : grade === "C"
          ? "דורש בדיקה"
          : "סיכון גבוה";

  return { score, grade, label, factors };
}

/**
 * Annual-mileage penalty (km/year). Typical Israeli usage is ~15k/yr; above that
 * is heavier wear. Below ~11k earns a small bonus. The estimate comes from the
 * single confirmed odometer reading over the vehicle's age.
 */
function annualKmPenalty(km: number): number {
  if (km > 32000) return -30;
  if (km > 26000) return -22;
  if (km > 20000) return -13;
  if (km > 16000) return -6;
  if (km < 11000) return 3;
  return 0;
}

/**
 * The "Summary by CarHistoryIL" — a short, human paragraph that humanizes the
 * data. Built entirely from real fields; says what we DON'T know plainly.
 */
export function buildNarrative(r: UnifiedVehicleReport, health: VehicleHealth): string {
  const s = r.specs;
  const parts: string[] = [];

  const name = [s.make, s.commercialName ?? s.model].filter(Boolean).join(" ");
  const yearTxt = s.year ? `משנת ${s.year}` : "";
  if (name) parts.push(`${name} ${yearTxt}`.trim() + ".");

  const owners = r.ownership.observedOwnerRecords;
  if (owners && owners > 0) {
    parts.push(
      owners === 1
        ? "נצפתה תקופת בעלות אחת בלבד במאגר."
        : `נצפו ${owners} תקופות בעלות לאורך חיי הרכב.`,
    );
  }

  const k = r.riskIndicators;
  // Serious events get an explicit, strong sentence — not just a flag list.
  if (k.wasOffRoad) {
    parts.push(
      "⚠️ הרכב היה מורד מהכביש בעבר — אירוע משמעותי שעלול להעיד על נזק כבד/אובדן להלכה. חובה בדיקה יסודית במכון מורשה לפני רכישה.",
    );
  }
  if (k.recordedAsStolenOrConfiscated) {
    parts.push("⚠️ הרכב מסומן ברישום גניבה/החרמה — נדרש בירור מול המשטרה.");
  }

  const trauma: string[] = [];
  if (k.structureChanged) trauma.push("שינוי מבנה");
  if (k.colorChanged) trauma.push("שינוי צבע");
  if (k.tireSizeChanged) trauma.push("שינוי מידת צמיג");
  if (trauma.length) {
    parts.push(`דגלים נוספים: ${trauma.join(", ")} — מומלץ לבדוק לעומק.`);
  } else if (!k.wasOffRoad && !k.recordedAsStolenOrConfiscated && k.structureChanged === false) {
    parts.push(
      "קודי הרשם (שינוי מבנה, ירידה מהכביש) אינם מעידים על אירוע טראומטי — תואם להיסטוריה נקייה ככל שניתן לקרוא מהמאגר הציבורי.",
    );
  }

  if (r.license.mileage.km !== null) {
    const annual = r.license.mileage.estimatedAnnualKm;
    const annualNote =
      annual !== null && annual > 20000
        ? ` (ק"מ שנתי גבוה — כ-${annual.toLocaleString("he-IL")} בשנה)`
        : annual !== null && annual < 11000
          ? ` (ק"מ שנתי נמוך — כ-${annual.toLocaleString("he-IL")} בשנה)`
          : "";
    parts.push(
      `קריאת מד-האוץ המאומתת האחרונה: ${r.license.mileage.km.toLocaleString("he-IL")} ק"מ${annualNote}.`,
    );
  }

  parts.push(`ציון בריאות הרכב: ${health.score}/100 (${health.label}).`);
  return parts.join(" ");
}
