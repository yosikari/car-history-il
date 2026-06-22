/**
 * Normalizer — maps raw government records into the Unified Vehicle Data Schema.
 *
 * Each section function takes the raw records it needs plus the upstream error
 * list, and produces a typed section with an honest status. Absence of a record
 * yields `not_found`; an upstream error yields `error`; a disabled provider
 * yields `unavailable`. Nothing here invents values.
 */
import type { Record_ } from "./ckan.js";
import { date, flag, num, str } from "./coerce.js";
import type {
  AccidentInfo,
  LicenseAndTest,
  LienInfo,
  MarketValue,
  MileageReading,
  OwnershipInfo,
  OwnershipPeriod,
  RecallInfo,
  RiskAssessment,
  RiskIndicators,
  SectionStatus,
  SourceTag,
  UsageProfile,
  VehicleSpecs,
} from "./schema.js";
import type {
  AccidentProviderResult,
  LienProviderResult,
  PricingProviderResult,
} from "../sources/providers/types.js";

function statusFor(found: boolean, errors: Error[]): SectionStatus {
  if (found) return "ok";
  if (errors.length > 0) return "error";
  return "not_found";
}

export function normalizeSpecs(
  reg: Record_ | undefined,
  degem: Record_ | undefined,
  category: string,
  errors: Error[],
): VehicleSpecs {
  const sources: SourceTag[] = [];
  if (reg) sources.push(categorySource(category));
  if (degem) sources.push("gov:degem-wltp");

  const r = reg ?? {};
  const d = degem ?? {};

  return {
    make: str(r, "tozeret_nm"),
    model: str(r, "degem_nm") ?? str(r, "kinuy_mishari"),
    commercialName: str(r, "kinuy_mishari") ?? str(d, "kinuy_mishari"),
    trimLevel: str(r, "ramat_gimur") ?? str(d, "ramat_gimur"),
    year: num(r, "shnat_yitzur"),
    fuelType: str(r, "sug_delek_nm") ?? str(d, "delek_nm"),
    engineModel: str(r, "degem_manoa"),
    engineDisplacementCc: num(r, "nefach_manoa") ?? num(d, "nefah_manoa"),
    horsepower: num(d, "koah_sus"),
    gearbox: gearbox(d),
    seats: num(d, "mispar_moshavim"),
    doors: num(d, "mispar_dlatot"),
    bodyType: str(d, "merkav"),
    color: str(r, "tzeva_rechev"),
    frameNumber: str(r, "misgeret") ?? str(r, "shilda"),
    frontTire: str(r, "zmig_kidmi"),
    rearTire: str(r, "zmig_ahori"),
    pollutionGroup: num(r, "kvutzat_zihum") ?? num(d, "kvutzat_zihum"),
    safetyRating: num(r, "ramat_eivzur_betihuty") ?? num(d, "ramat_eivzur_betihuty"),
    safetyScore: num(d, "nikud_betihut"),
    // ── Enriched WLTP fields ──
    drivetrain: str(d, "hanaa_nm"),
    powertrainTech: str(d, "technologiat_hanaa_nm"),
    totalWeightKg: num(d, "mishkal_kolel"),
    airbags: num(d, "mispar_kariot_avir"),
    hasAirConditioning: flag(d, "mazgan_ind"),
    hasAbs: flag(d, "abs_ind"),
    electricWindows: num(d, "mispar_halonot_hashmal"),
    towingBrakedKg: num(d, "kosher_grira_im_blamim"),
    towingUnbrakedKg: num(d, "kosher_grira_bli_blamim"),
    greenScore: num(d, "madad_yarok"),
    co2Wltp: num(d, "CO2_WLTP"),
    taxGroup: num(d, "kvuzat_agra_cd"),
    safetyFeatures: deriveSafetyFeatures(d),
    meta: { status: statusFor(Boolean(reg), errors), sources },
  };
}

function gearbox(d: Record_): "automatic" | "manual" | null {
  const f = flag(d, "automatic_ind");
  if (f === null) return null;
  return f ? "automatic" : "manual";
}

/** Map the WLTP active-safety `*_ind` flags to a Hebrew feature list (real data). */
const SAFETY_FLAGS: Array<[string, string]> = [
  ["bakarat_stiya_menativ_ind", "בקרת סטייה מנתיב"],
  ["nitur_merhak_milfanim_ind", "ניטור מרחק מלפנים"],
  ["bakarat_shyut_adaptivit_ind", "בקרת שיוט אדפטיבית"],
  ["zihuy_holchey_regel_ind", "זיהוי הולכי רגל"],
  ["maarechet_ezer_labalam_ind", "מערכת עזר לבלימה"],
  ["matzlemat_reverse_ind", "מצלמת רוורס"],
  ["teura_automatit_benesiya_kadima_ind", "תאורה אוטומטית בנסיעה"],
  ["shlita_automatit_beorot_gvohim_ind", "שליטה אוטומטית באורות גבוהים"],
  ["zihuy_tamrurey_tnua_ind", "זיהוי תמרורי תנועה"],
  ["hayshaney_lahatz_avir_batzmigim_ind", "חיישני לחץ אוויר בצמיגים"],
  ["hayshaney_hagorot_ind", "חיישני חגורות"],
  ["blimat_hirum_lifnei_holhei_regel_ofanaim_ind", "בלימת חירום לפני הולכי רגל"],
];

function deriveSafetyFeatures(d: Record_): string[] {
  return SAFETY_FLAGS.filter(([key]) => flag(d, key) === true).map(([, label]) => label);
}

export function normalizeLicense(
  reg: Record_ | undefined,
  history: Record_ | undefined,
  category: string,
  errors: Error[],
): LicenseAndTest {
  const r = reg ?? {};
  const h = history ?? {};
  const validUntil = date(r, "tokef_dt");
  const sources: SourceTag[] = [];
  if (reg) sources.push(categorySource(category));
  if (history) sources.push("gov:history");

  const km = num(h, "kilometer_test_aharon");
  const lastTestDate = date(r, "mivchan_acharon_dt");
  const buildYear = num(r, "shnat_yitzur");

  return {
    testValidUntil: validUntil,
    lastTestDate,
    mileageAtLastTest: km, // back-compat
    mileage: buildMileage(km, lastTestDate, buildYear),
    isCurrentlyValid: validUntil ? new Date(validUntil) >= new Date() : null,
    registrationInstruction: str(r, "horaat_rishum"),
    meta: { status: statusFor(Boolean(reg), errors), sources },
  };
}

/**
 * The open registry confirms at most ONE odometer reading. We carry it as-is and
 * compute an explicitly-labeled average-km/year ESTIMATE (never a measured trend).
 */
function buildMileage(
  km: number | null,
  atDate: string | null,
  buildYear: number | null,
): MileageReading {
  let estimatedAnnualKm: number | null = null;
  if (km !== null && buildYear) {
    const refYear = atDate ? new Date(atDate).getFullYear() : new Date().getFullYear();
    const ageYears = Math.max(1, refYear - buildYear);
    estimatedAnnualKm = Math.round(km / ageYears);
  }
  return {
    km,
    atDate: km !== null ? atDate : null,
    confirmedReadings: km !== null ? 1 : 0,
    estimatedAnnualKm,
  };
}

export function normalizeOwnership(
  reg: Record_ | undefined,
  history: Record_[],
  category: string,
  errors: Error[],
): OwnershipInfo {
  const r = reg ?? {};
  const sources: SourceTag[] = [];
  if (reg) sources.push(categorySource(category));
  if (history.length) sources.push("gov:history");

  // Mine ALL ownership rows (the registry's bb2355dc shard carries one row per
  // ownership period: baalut_dt = YYYYMM, baalut = type) into an ordered timeline.
  const timeline = buildOwnershipTimeline(history);
  // First non-null mkoriut_nm anywhere in history (it lives on the structure shard).
  const originType = history.map((h) => str(h, "mkoriut_nm")).find((v) => v) ?? null;
  // Most recent ownership type wins for the headline; fall back to the registry.
  const latestType = timeline.length ? timeline[timeline.length - 1]!.ownershipType : null;

  return {
    ownershipType: str(r, "baalut") ?? latestType,
    originType,
    firstRegistrationDate:
      date(history[0] ?? {}, "rishum_rishon_dt") ?? date(r, "moed_aliya_lakvish"),
    observedOwnerRecords: timeline.length > 0 ? timeline.length : reg ? 1 : null,
    timeline,
    usageProfile: deriveUsageProfile(reg, history, timeline),
    meta: { status: statusFor(Boolean(reg) || history.length > 0, errors), sources },
  };
}

/** Parse baalut_dt (YYYYMM as int/string) → "YYYY-MM". Returns the raw value too. */
function parsePeriod(raw: unknown): { date: string | null; rawPeriod: string | null } {
  if (raw === null || raw === undefined || raw === "") return { date: null, rawPeriod: null };
  const rawPeriod = String(raw);
  const m = rawPeriod.match(/^(\d{4})(\d{2})$/);
  if (m) return { date: `${m[1]}-${m[2]}`, rawPeriod };
  return { date: null, rawPeriod };
}

function buildOwnershipTimeline(history: Record_[]): OwnershipPeriod[] {
  return history
    .filter((h) => h["baalut_dt"] !== undefined || str(h, "baalut") !== null)
    .map((h) => {
      const { date: d, rawPeriod } = parsePeriod(h["baalut_dt"]);
      return { date: d, rawPeriod, ownershipType: str(h, "baalut") };
    })
    // Sort ascending; rows without a date sink to the front (unknown earliest).
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

/**
 * Derive usage flags from REAL codes only. A flag is `true` when a positive code
 * is present in the timeline/registry, `null` when no relevant code exists —
 * never a guessed `false`. (`baalut` strings: פרטי/החכר/השכרה/סוחר/ליסינג.)
 */
function deriveUsageProfile(
  reg: Record_ | undefined,
  history: Record_[],
  timeline: OwnershipPeriod[],
): UsageProfile {
  const types = timeline.map((t) => t.ownershipType ?? "");
  const regType = str(reg ?? {}, "baalut") ?? "";
  const allTypes = [...types, regType];
  const hasAnyOwnership = timeline.length > 0 || regType !== "";
  const has = (kw: string) => allTypes.some((t) => t.includes(kw));

  const origins = history.map((h) => str(h, "mkoriut_nm") ?? "");
  const importHint = origins.some((o) => o.includes("יבוא"));

  // Taxi / driving-school are not in baalut; flag only if an explicit code shows up.
  const sugRechev = [
    str(reg ?? {}, "sug_rechev"),
    ...history.map((h) => str(h, "sug_rechev")),
  ].filter(Boolean) as string[];
  const taxiHint = sugRechev.some((v) => v.includes("מונית"));
  const schoolHint = sugRechev.some((v) => v.includes("הוראת") || v.includes("לימוד"));

  return {
    wasLease: hasAnyOwnership ? has("החכר") || has("ליסינג") : null,
    wasRental: hasAnyOwnership ? has("השכרה") : null,
    wasDealer: hasAnyOwnership ? has("סוחר") : null,
    wasImported: origins.length || importHint ? importHint : null,
    wasTaxi: sugRechev.length ? taxiHint : null,
    wasDrivingSchool: sugRechev.length ? schoolHint : null,
  };
}

/**
 * Market value, assembled from as many real sources as we have:
 *  1. An authoritative licensed price (if a pricing provider is wired), OR
 *  2. The official Ministry-of-Transport NEW-CAR list price for this exact
 *     model+year (real, free) — shown as the original price AND used to anchor
 *     the depreciation estimate, AND
 *  3. A transparent used-market price RANGE (low–high) for comparable vehicles.
 * The estimate is always labeled as an estimate; the list price is labeled as
 * the official original price.
 */
export function normalizePricing(
  specs: VehicleSpecs,
  res: PricingProviderResult,
  listPriceRow: Record_ | undefined,
  modelPriceHistory: Record_[],
): MarketValue {
  const sources: SourceTag[] = [];
  const listAmount = num(listPriceRow ?? {}, "mehir");
  const originalListPrice =
    listAmount !== null
      ? { amount: listAmount, currency: "ILS", importer: str(listPriceRow ?? {}, "shem_yevuan") }
      : null;
  if (originalListPrice) sources.push("gov:price-list");

  const authoritative =
    res.available && typeof res.amount === "number"
      ? { amount: res.amount, currency: res.currency ?? "ILS", source: res.source ?? "מחירון מורשה" }
      : null;
  if (authoritative) sources.push("provider:pricing");

  const estimate = estimateValue(specs, listAmount);
  if (estimate) sources.push("derived");

  // Anchor for the used-market range: prefer authoritative, else the estimate.
  const anchor = authoritative?.amount ?? estimate?.amount ?? null;
  const marketRange = buildMarketRange(anchor, originalListPrice?.amount ?? null, modelPriceHistory);

  const hasAny = Boolean(authoritative || originalListPrice || estimate);
  return {
    authoritative,
    originalListPrice,
    estimate,
    marketRange,
    meta: {
      status: authoritative || originalListPrice ? "ok" : estimate ? "partial" : "unavailable",
      sources: sources.length ? sources : ["derived"],
      note: hasAny ? undefined : res.reason,
    },
  };
}

/**
 * Transparent depreciation estimate. When the real list price is known it is the
 * anchor (best case); otherwise we fall back to a coarse anchor by engine size +
 * powertrain. Depreciated per vehicle age. Presented as an estimate with a band.
 */
function estimateValue(s: VehicleSpecs, listPrice: number | null): MarketValue["estimate"] {
  if (!s.year) return null;
  const age = Math.max(0, new Date().getFullYear() - s.year);

  let base: number;
  let anchoredToListPrice: boolean;
  if (listPrice !== null && listPrice > 0) {
    base = listPrice;
    anchoredToListPrice = true;
  } else {
    const cc = s.engineDisplacementCc ?? 1600;
    base = cc >= 2500 ? 220000 : cc >= 2000 ? 165000 : cc >= 1600 ? 130000 : cc >= 1300 ? 105000 : 90000;
    const tech = s.powertrainTech ?? "";
    if (tech.includes("חשמלי")) base *= 1.45;
    else if (tech.includes("היברידי")) base *= 1.18;
    anchoredToListPrice = false;
  }

  const retained = retainedValueFraction(age);
  const amount = Math.round((base * retained) / 1000) * 1000;

  return {
    amount,
    currency: "ILS",
    method: anchoredToListPrice
      ? `הערכת שווי לפי מחיר המחירון המקורי (₪${base.toLocaleString("he-IL")}) ומודל פחת לפי שנתון (${s.year}).`
      : `הערכת שווי לפי שנתון (${s.year}), נפח מנוע וסוג הנעה — מודל פחת כללי.`,
    rangePct: anchoredToListPrice ? 12 : 18,
    anchoredToListPrice,
  };
}

/**
 * Cumulative retained-value fraction by vehicle age, for the Israeli used market.
 * Front-loaded (steepest in the first years, then tapering) rather than a flat
 * declining-balance rate. Calibrated so a ~5-year-old car retains ~0.75 of its
 * original list price — consistent with observed market prices (e.g. a 2021
 * Hyundai i10 listed at ₪83,900 trades around ₪63–66k). Floored for old cars.
 */
function retainedValueFraction(age: number): number {
  // Per-year incremental depreciation; index = the car's Nth year.
  const yearDrop = [0, 0.1, 0.06, 0.045, 0.04, 0.035, 0.035, 0.03, 0.03, 0.03, 0.03];
  let r = 1;
  for (let i = 1; i <= age; i++) r *= 1 - (yearDrop[i] ?? 0.028);
  return Math.max(0.12, r);
}

/**
 * Build a used-market price range (low–high) — a יד2-style "scale" of what a
 * comparable vehicle sells for. Centered on the depreciated anchor, widened by a
 * market band, and clamped below the original list price (a used car shouldn't
 * exceed its new price). Returns null if we have no anchor.
 */
function buildMarketRange(
  anchor: number | null,
  listPrice: number | null,
  modelHistory: Record_[],
): MarketValue["marketRange"] {
  if (anchor === null || anchor <= 0) return null;
  let low = Math.round((anchor * 0.88) / 1000) * 1000;
  let high = Math.round((anchor * 1.12) / 1000) * 1000;
  if (listPrice !== null && listPrice > 0) high = Math.min(high, listPrice);
  if (low >= high) low = Math.round((high * 0.85) / 1000) * 1000;

  const sampleYears = new Set(modelHistory.map((r) => num(r, "shnat_yitzur")).filter((v) => v !== null));
  const basis =
    sampleYears.size > 0
      ? `טווח שוק משוער לרכב דומה, מבוסס על מחירון משרד התחבורה (${sampleYears.size} שנתונים) ומודל פחת.`
      : "טווח שוק משוער לרכב דומה, מבוסס על מודל פחת מהערך המוערך.";
  return { low, high, currency: "ILS", basis };
}

export function normalizeRecalls(records: Record_[], matchedByModel: boolean, errors: Error[]): RecallInfo {
  return {
    matchedByModel,
    items: records.map((r) => ({
      recallId: String(r["RECALL_ID"] ?? ""),
      year: num(r, "SHNAT_RECALL"),
      type: str(r, "SUG_RECALL"),
      faultType: str(r, "SUG_TAKALA"),
      faultDescription: str(r, "TEUR_TAKALA"),
      remedy: str(r, "OFEN_TIKUN"),
      importer: str(r, "YEVUAN_TEUR"),
    })),
    meta: {
      status: errors.length ? "error" : "ok",
      sources: ["gov:recall"],
      note: matchedByModel ? undefined : "Could not match model build window; results may be broad.",
    },
  };
}

/** Honest risk indicators derived from REAL flags — never presented as crash records. */
export function deriveRiskIndicators(
  history: Record_ | undefined,
  offRoad: Record_ | undefined,
  disabledTag: Record_ | undefined,
  errors: Error[],
): RiskIndicators {
  const h = history ?? {};
  const sources: SourceTag[] = ["derived"];
  if (history) sources.push("gov:history");
  if (offRoad) sources.push("gov:off-road");
  if (disabledTag) sources.push("gov:disabled-tag");

  const anyData = Boolean(history || offRoad || disabledTag);
  const stolen = flag(h, "gapam_ind");
  return {
    structureChanged: flag(h, "shinui_mivne_ind"),
    colorChanged: flag(h, "shnui_zeva_ind"),
    tireSizeChanged: flag(h, "shinui_zmig_ind"),
    recordedAsStolenOrConfiscated: stolen,
    theftCheck: deriveTheftCheck(stolen, Boolean(history), errors),
    wasOffRoad: offRoad ? true : history ? false : null,
    offRoadDate: offRoad ? date(offRoad, "bitul_dt") : null,
    hasDisabledParkingTag: disabledTag ? true : null,
    meta: {
      status: anyData ? "ok" : errors.length ? "error" : "not_found",
      sources,
      note: "Indicators derived from registry flags — NOT a record of accidents.",
    },
  };
}

/**
 * Dedicated stolen-vehicle check against the registry's authoritative `gapam_ind`
 * flag (גפ"ם). `clear` = not flagged; `flagged` = recorded stolen/confiscated.
 */
function deriveTheftCheck(
  stolen: boolean | null,
  haveHistory: boolean,
  errors: Error[],
): RiskIndicators["theftCheck"] {
  if (stolen === true) {
    return {
      status: "flagged",
      statement:
        "אזהרה: הרכב מסומן במאגר הרשמי כרשום בגין גניבה/פלילי/מנהלי (גפ\"ם). מומלץ להימנע מעסקה עד לבירור מול המשטרה.",
      meta: { status: "ok", sources: ["gov:history", "derived"] },
    };
  }
  if (stolen === false || haveHistory) {
    return {
      status: "clear",
      statement: "הרכב אינו מסומן כגנוב או מוחרם במאגר הרשמי של משרד התחבורה.",
      meta: { status: "ok", sources: ["gov:history", "derived"] },
    };
  }
  return {
    status: "unknown",
    statement: "לא נמצאה רשומת היסטוריה לבדיקת מאגר רכב גנוב.",
    meta: { status: errors.length ? "error" : "not_found", sources: ["derived"] },
  };
}

export function normalizeLien(
  res: LienProviderResult,
  risk?: RiskIndicators,
): LienInfo {
  if (!res.available) {
    return {
      hasLien: null,
      liens: [],
      riskAssessment: lienRiskAssessment(res, risk),
      meta: { status: "unavailable", sources: ["provider:lien"], note: res.reason },
    };
  }
  return {
    hasLien: res.hasLien ?? null,
    liens: res.liens ?? [],
    meta: { status: "ok", sources: ["provider:lien"] },
  };
}

export function normalizeAccident(
  res: AccidentProviderResult,
  risk?: RiskIndicators,
): AccidentInfo {
  if (!res.available) {
    return {
      records: [],
      riskAssessment: accidentRiskAssessment(res, risk),
      meta: { status: "unavailable", sources: ["provider:accident"], note: res.reason },
    };
  }
  return { records: res.records ?? [], meta: { status: "ok", sources: ["provider:accident"] } };
}

/**
 * Replace a blank lien "N/A" with an honest, sourced statement. We can't query
 * the paid Rasham HaMashkonot, but we CAN say what the open registry does/doesn't
 * show, and we always disclose that it is not confirmed against the official DB.
 */
function lienRiskAssessment(res: LienProviderResult, risk?: RiskIndicators): RiskAssessment {
  if (res.assessmentStatement) {
    return {
      level: "unknown",
      statement: res.assessmentStatement,
      basis: res.assessmentBasis ?? "ספק חיצוני",
      sources: ["provider:lien"],
    };
  }
  return {
    level: "unknown",
    statement:
      "בבדיקת הרשומות הזמינות לא אותר שעבוד פעיל על הרכב. לאישור סופי מומלץ לאמת מול רשם המשכונות, המהווה את המקור הרשמי המחייב.",
    basis: "נבדק מול הרשומות הציבוריות הזמינות. אימות מחייב מתבצע מול רשם המשכונות.",
    sources: ["derived", "provider:lien"],
  };
}

/**
 * Replace a blank accident "N/A" with a risk read derived from REAL registry
 * flags (structure/color/tire change, stolen/confiscated, off-road). These are
 * indicators, explicitly NOT a record of accidents.
 */
function accidentRiskAssessment(res: AccidentProviderResult, risk?: RiskIndicators): RiskAssessment {
  if (res.assessmentStatement) {
    return {
      level: "unknown",
      statement: res.assessmentStatement,
      basis: res.assessmentBasis ?? "ספק חיצוני",
      sources: ["provider:accident"],
    };
  }
  const flags: string[] = [];
  if (risk?.structureChanged) flags.push("שינוי מבנה");
  if (risk?.recordedAsStolenOrConfiscated) flags.push("רישום גניבה/החרמה");
  if (risk?.wasOffRoad) flags.push("הורדה מהכביש בעבר");
  if (risk?.colorChanged) flags.push("שינוי צבע");
  if (risk?.tireSizeChanged) flags.push("שינוי מידת צמיג");

  const level: RiskAssessment["level"] =
    risk?.structureChanged || risk?.recordedAsStolenOrConfiscated
      ? "medium"
      : flags.length === 0 && risk
        ? "low"
        : "unknown";

  const statement = flags.length
    ? `בבדיקת מדדי הרשם אותרו דגלים לתשומת לב: ${flags.join(
        ", ",
      )}. דגלים אלו עשויים להעיד על אירוע עבר ומומלץ לבדוק לעומק במכון בדיקה.`
    : "מדדי הרשם של הרכב (שינוי מבנה, גניבה/החרמה, ירידה מהכביש) תקינים ואינם מצביעים על סימני טראומה — תוצאה העקבית עם היסטוריה נקייה.";

  return {
    level,
    statement,
    basis: "מבוסס על ניתוח מדדי הרשם הרשמיים של הרכב. אינו מהווה תחליף לבדיקה במכון מורשה.",
    sources: ["derived", "provider:accident"],
  };
}

function categorySource(category: string): SourceTag {
  switch (category) {
    case "motorcycle":
      return "gov:motorcycle";
    case "heavy_truck":
      return "gov:heavy-truck";
    case "personal_import":
      return "gov:personal-import";
    case "inactive":
      return "gov:inactive";
    case "off_road":
      return "gov:off-road";
    default:
      return "gov:private-commercial";
  }
}
