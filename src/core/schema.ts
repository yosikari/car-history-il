/**
 * The Unified Vehicle Data Schema.
 *
 * This is the single normalized contract that every source maps INTO and that
 * the report/API layers read FROM. Raw Hebrew government field names never leak
 * past the normalizer. Every section carries provenance + a status so the
 * report can honestly show "data unavailable" instead of a fabricated blank.
 */

/** Where a value ultimately came from — for auditability and trust. */
export type SourceTag =
  | "gov:private-commercial"
  | "gov:history"
  | "gov:degem-wltp"
  | "gov:price-list"
  | "gov:recall"
  | "gov:disabled-tag"
  | "gov:off-road"
  | "gov:motorcycle"
  | "gov:personal-import"
  | "gov:heavy-truck"
  | "gov:inactive"
  | "provider:lien"
  | "provider:accident"
  | "provider:pricing"
  | "derived";

/** Per-section retrieval status. `unavailable` = source could not be queried; `not_found` = queried, no record. */
export type SectionStatus = "ok" | "partial" | "not_found" | "unavailable" | "error";

export interface SectionMeta {
  status: SectionStatus;
  sources: SourceTag[];
  /** Human-readable note, e.g. why a section is unavailable. */
  note?: string;
}

export interface VehicleClassification {
  /** Which registry the vehicle was found in. Drives spec interpretation. */
  category:
    | "private_commercial"
    | "motorcycle"
    | "personal_import"
    | "heavy_truck"
    | "inactive"
    | "off_road"
    | "unknown";
}

export interface VehicleSpecs {
  make: string | null; // tozeret_nm
  model: string | null; // degem_nm / kinuy_mishari
  commercialName: string | null; // kinuy_mishari
  trimLevel: string | null; // ramat_gimur
  year: number | null; // shnat_yitzur
  fuelType: string | null; // sug_delek_nm
  engineModel: string | null; // degem_manoa
  engineDisplacementCc: number | null; // nefah_manoa
  horsepower: number | null; // koah_sus
  gearbox: "automatic" | "manual" | null; // automatic_ind
  seats: number | null; // mispar_moshavim
  doors: number | null; // mispar_dlatot
  bodyType: string | null; // merkav
  color: string | null; // tzeva_rechev
  frameNumber: string | null; // misgeret / shilda (VIN)
  frontTire: string | null; // zmig_kidmi
  rearTire: string | null; // zmig_ahori
  pollutionGroup: number | null; // kvutzat_zihum
  safetyRating: number | null; // ramat_eivzur_betihuty
  safetyScore: number | null; // nikud_betihut
  // ── Enriched from the WLTP model dataset (all real, free gov data) ──
  drivetrain: string | null; // hanaa_nm (e.g. 4X2 / 4X4)
  powertrainTech: string | null; // technologiat_hanaa_nm (e.g. היברידי רגיל)
  totalWeightKg: number | null; // mishkal_kolel
  airbags: number | null; // mispar_kariot_avir
  hasAirConditioning: boolean | null; // mazgan_ind
  hasAbs: boolean | null; // abs_ind
  electricWindows: number | null; // mispar_halonot_hashmal
  towingBrakedKg: number | null; // kosher_grira_im_blamim
  towingUnbrakedKg: number | null; // kosher_grira_bli_blamim
  greenScore: number | null; // madad_yarok (0–100+ environmental score)
  co2Wltp: number | null; // CO2_WLTP (g/km)
  taxGroup: number | null; // kvuzat_agra_cd (licensing-fee bracket)
  /** ADAS / active-safety features present (Hebrew labels), derived from *_ind flags. */
  safetyFeatures: string[];
  meta: SectionMeta;
}

/** One observed ownership period, mined from the history dataset. */
export interface OwnershipPeriod {
  /** Normalized start of the period, "YYYY-MM" (from baalut_dt = YYYYMM). */
  date: string | null;
  /** The raw period value as published (for auditability). */
  rawPeriod: string | null;
  /** Ownership type for the period (baalut): פרטי / החכר / סוחר / השכרה ... */
  ownershipType: string | null;
}

/**
 * How the vehicle was used, derived from REAL registry/history codes. A flag is
 * `true` only when a positive code is present, `null` when no relevant code
 * exists in the data — never a guessed `false`. This drives the risk picture.
 */
export interface UsageProfile {
  wasLease: boolean | null; // baalut === החכר seen in timeline
  wasRental: boolean | null; // baalut === השכרה
  wasDealer: boolean | null; // baalut === סוחר (passed through a dealer)
  wasImported: boolean | null; // mkoriut_nm indicates יבוא
  wasTaxi: boolean | null; // only if a taxi code is present
  wasDrivingSchool: boolean | null; // only if a driving-school code is present
}

export interface OwnershipInfo {
  ownershipType: string | null; // baalut (פרטי / החכר / השכרה ...) — current/most recent
  originType: string | null; // mkoriut_nm (origin: private import etc.)
  firstRegistrationDate: string | null; // rishum_rishon_dt | moed_aliya_lakvish
  /**
   * Number of distinct ownership records we could observe. The open registry
   * does NOT publish a clean owner-count, so this is best-effort and may be 1
   * even for multi-owner cars. Honestly labeled in the report.
   */
  observedOwnerRecords: number | null;
  /** Timeline of observed ownership periods, sorted ascending by date. */
  timeline: OwnershipPeriod[];
  /** Derived usage flags (lease/dealer/import/taxi/...). */
  usageProfile: UsageProfile;
  meta: SectionMeta;
}

/**
 * Odometer reading. Israel's open data publishes only ONE confirmed reading
 * (the last annual test); there is no public per-test mileage history, so a
 * multi-point trend cannot be honestly sourced. We carry the single confirmed
 * point and an explicitly-labeled estimate the UI may draw alongside it.
 */
export interface MileageReading {
  /** The one confirmed odometer reading (km), from the last annual test. */
  km: number | null;
  /** Date the reading was taken (the last-test date). */
  atDate: string | null;
  /** Always 0 or 1 — the open registry confirms at most one reading. */
  confirmedReadings: number;
  /** Estimated average km/year = km / vehicle age. NOT a measured value. */
  estimatedAnnualKm: number | null;
}

export interface LicenseAndTest {
  testValidUntil: string | null; // tokef_dt
  lastTestDate: string | null; // mivchan_acharon_dt
  mileageAtLastTest: number | null; // kilometer_test_aharon (from history) — kept for back-compat
  /** Structured odometer info (single confirmed reading + honest estimate). */
  mileage: MileageReading;
  isCurrentlyValid: boolean | null; // derived from tokef_dt vs today
  registrationInstruction: string | null; // horaat_rishum
  meta: SectionMeta;
}

export interface RecallItem {
  recallId: string;
  year: number | null;
  type: string | null; // SUG_RECALL
  faultType: string | null; // SUG_TAKALA
  faultDescription: string | null; // TEUR_TAKALA
  remedy: string | null; // OFEN_TIKUN
  importer: string | null; // YEVUAN_TEUR
}

export interface RecallInfo {
  /** True only when we successfully matched the model's build window. */
  matchedByModel: boolean;
  items: RecallItem[];
  meta: SectionMeta;
}

/**
 * Vehicle market value. When an AUTHORIZED pricing provider (e.g. a licensed
 * Levi Yitzhak API) is configured, `authoritative` is populated and labeled with
 * its source. Otherwise we show an honest, transparent `estimate` derived from
 * the registry data — explicitly NOT presented as Levi Yitzhak.
 */
export interface MarketValue {
  /** Authoritative price from a licensed provider, if configured. */
  authoritative: { amount: number; currency: string; source: string } | null;
  /**
   * Official Ministry-of-Transport NEW-CAR list price for this exact model+year,
   * with the importer name. Real, free, authoritative data (not an estimate).
   */
  originalListPrice: { amount: number; currency: string; importer: string | null } | null;
  /** Transparent self-estimate (depreciation model). Always labeled as estimate. */
  estimate: {
    amount: number;
    currency: string;
    /** Plain-language description of how the estimate was derived. */
    method: string;
    /** Rough confidence band, ± percent. */
    rangePct: number;
    /** True when the estimate is anchored to the real list price (vs. a heuristic base). */
    anchoredToListPrice: boolean;
  } | null;
  /** A used-market price range (low–high) for comparable vehicles, in ILS. */
  marketRange: { low: number; high: number; currency: string; basis: string } | null;
  meta: SectionMeta;
}

/**
 * Dedicated stolen / confiscated vehicle check, derived from the registry's
 * authoritative `gapam_ind` flag (גפ"ם — recorded as stolen, criminal, or
 * administratively confiscated). This is the official government signal; a
 * `clear` result means the vehicle is NOT flagged in the registry.
 */
export interface TheftCheck {
  /** "clear" = not flagged, "flagged" = recorded as stolen/confiscated, "unknown" = no data. */
  status: "clear" | "flagged" | "unknown";
  statement: string;
  meta: SectionMeta;
}

/** Honest risk indicators derived from REAL data (not crash records). */
export interface RiskIndicators {
  structureChanged: boolean | null; // shinui_mivne_ind
  colorChanged: boolean | null; // shnui_zeva_ind
  tireSizeChanged: boolean | null; // shinui_zmig_ind
  recordedAsStolenOrConfiscated: boolean | null; // gapam_ind
  /** Dedicated, prominent stolen-vehicle check (also from gapam_ind). */
  theftCheck: TheftCheck;
  wasOffRoad: boolean | null; // present in off-road dataset
  offRoadDate: string | null; // bitul_dt
  hasDisabledParkingTag: boolean | null;
  meta: SectionMeta;
}

/**
 * A sourced, honest explanation that replaces a blank "N/A". Used when a section
 * has no authoritative provider but we CAN say something truthful from the data
 * we did check. `statement` is the user-facing sentence; `basis` cites exactly
 * which checks back it. Never implies a guarantee.
 */
export interface RiskAssessment {
  level: "low" | "medium" | "unknown";
  statement: string;
  basis: string;
  sources: SourceTag[];
}

/** Lien result. NEVER fabricated — `unavailable` until a real provider is wired. */
export interface LienInfo {
  hasLien: boolean | null;
  liens: Array<{ holder: string | null; date: string | null; amount: number | null }>;
  /** Present when no authoritative result exists — an honest, sourced read. */
  riskAssessment?: RiskAssessment;
  meta: SectionMeta;
}

/** Accident records from a real paid provider, if one is configured. */
export interface AccidentInfo {
  records: Array<{ date: string | null; severity: string | null; description: string | null }>;
  /** Present when no provider is wired — honest risk read from registry flags. */
  riskAssessment?: RiskAssessment;
  meta: SectionMeta;
}

export interface UnifiedVehicleReport {
  /** The normalized plate (digits only). */
  plate: string;
  generatedAt: string;
  classification: VehicleClassification;
  specs: VehicleSpecs;
  ownership: OwnershipInfo;
  license: LicenseAndTest;
  recalls: RecallInfo;
  riskIndicators: RiskIndicators;
  pricing: MarketValue;
  liens: LienInfo;
  accidents: AccidentInfo;
  /** Aggregate trust signal: fraction of sections that returned data. */
  completeness: number;
  /** Anything that went wrong but did not abort the report. */
  warnings: string[];
}
