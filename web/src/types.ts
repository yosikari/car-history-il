/**
 * Frontend mirror of the backend Unified Vehicle Data Schema
 * (src/core/schema.ts). Kept manually in sync — only the fields the UI reads
 * are typed here. The shapes match the JSON returned by GET /api/vehicle/:plate.
 */
export type SectionStatus = "ok" | "partial" | "not_found" | "unavailable" | "error";

export interface SectionMeta {
  status: SectionStatus;
  sources: string[];
  note?: string;
}

export interface VehicleSpecs {
  make: string | null;
  model: string | null;
  commercialName: string | null;
  trimLevel: string | null;
  year: number | null;
  fuelType: string | null;
  engineModel: string | null;
  engineDisplacementCc: number | null;
  horsepower: number | null;
  gearbox: "automatic" | "manual" | null;
  seats: number | null;
  doors: number | null;
  bodyType: string | null;
  color: string | null;
  frameNumber: string | null;
  pollutionGroup: number | null;
  safetyRating: number | null;
  drivetrain: string | null;
  powertrainTech: string | null;
  totalWeightKg: number | null;
  airbags: number | null;
  hasAirConditioning: boolean | null;
  hasAbs: boolean | null;
  electricWindows: number | null;
  towingBrakedKg: number | null;
  towingUnbrakedKg: number | null;
  greenScore: number | null;
  co2Wltp: number | null;
  taxGroup: number | null;
  safetyFeatures: string[];
  meta: SectionMeta;
}

export interface MarketValue {
  authoritative: { amount: number; currency: string; source: string } | null;
  originalListPrice: { amount: number; currency: string; importer: string | null } | null;
  estimate: {
    amount: number;
    currency: string;
    method: string;
    rangePct: number;
    anchoredToListPrice: boolean;
  } | null;
  marketRange: { low: number; high: number; currency: string; basis: string } | null;
  meta: SectionMeta;
}

export interface OwnershipPeriod {
  date: string | null;
  rawPeriod: string | null;
  ownershipType: string | null;
}

export interface UsageProfile {
  wasLease: boolean | null;
  wasRental: boolean | null;
  wasDealer: boolean | null;
  wasImported: boolean | null;
  wasTaxi: boolean | null;
  wasDrivingSchool: boolean | null;
}

export interface OwnershipInfo {
  ownershipType: string | null;
  originType: string | null;
  firstRegistrationDate: string | null;
  observedOwnerRecords: number | null;
  timeline: OwnershipPeriod[];
  usageProfile: UsageProfile;
  meta: SectionMeta;
}

export interface MileageReading {
  km: number | null;
  atDate: string | null;
  confirmedReadings: number;
  estimatedAnnualKm: number | null;
}

export interface LicenseAndTest {
  testValidUntil: string | null;
  lastTestDate: string | null;
  mileageAtLastTest: number | null;
  mileage: MileageReading;
  isCurrentlyValid: boolean | null;
  registrationInstruction: string | null;
  meta: SectionMeta;
}

export interface RecallItem {
  recallId: string;
  year: number | null;
  faultType: string | null;
  faultDescription: string | null;
  remedy: string | null;
}

export interface RecallInfo {
  matchedByModel: boolean;
  items: RecallItem[];
  meta: SectionMeta;
}

export interface TheftCheck {
  status: "clear" | "flagged" | "unknown";
  statement: string;
  meta: SectionMeta;
}

export interface RiskIndicators {
  structureChanged: boolean | null;
  colorChanged: boolean | null;
  tireSizeChanged: boolean | null;
  recordedAsStolenOrConfiscated: boolean | null;
  theftCheck: TheftCheck;
  wasOffRoad: boolean | null;
  offRoadDate: string | null;
  hasDisabledParkingTag: boolean | null;
  meta: SectionMeta;
}

export interface RiskAssessment {
  level: "low" | "medium" | "unknown";
  statement: string;
  basis: string;
  sources: string[];
}

export interface LienInfo {
  hasLien: boolean | null;
  liens: Array<{ holder: string | null; date: string | null; amount: number | null }>;
  riskAssessment?: RiskAssessment;
  meta: SectionMeta;
}

export interface AccidentInfo {
  records: Array<{ date: string | null; severity: string | null; description: string | null }>;
  riskAssessment?: RiskAssessment;
  meta: SectionMeta;
}

export interface UnifiedVehicleReport {
  plate: string;
  generatedAt: string;
  classification: { category: string };
  specs: VehicleSpecs;
  ownership: OwnershipInfo;
  license: LicenseAndTest;
  recalls: RecallInfo;
  riskIndicators: RiskIndicators;
  pricing: MarketValue;
  liens: LienInfo;
  accidents: AccidentInfo;
  completeness: number;
  warnings: string[];
}
