/**
 * Aggregator / orchestrator (Phase 2).
 *
 * Pipeline:
 *   1. Locate + classify the vehicle in the registries.
 *   2. Fan out (in parallel) to history, off-road, disabled-tag, model spec,
 *      recalls, and the pluggable lien/accident providers.
 *   3. Normalize every source into the Unified Vehicle Data Schema.
 *   4. Compute a completeness score and collect warnings.
 *
 * The aggregator never throws on a single source failure — it degrades the
 * affected section's status and records a warning, so the report is always
 * returned with an honest picture of what succeeded.
 */
import { getCached, setCached } from "./cache.js";
import {
  fetchDegemSpec,
  fetchDisabledTag,
  fetchHistory,
  fetchListPrice,
  fetchModelPriceHistory,
  fetchOffRoad,
  fetchRecalls,
  findVehicle,
} from "../sources/govSources.js";
import { resolveLienProvider } from "../sources/providers/lienProvider.js";
import { resolveAccidentProvider } from "../sources/providers/accidentProvider.js";
import { resolvePricingProvider } from "../sources/providers/pricingProvider.js";
import { defaultProviderContext } from "../sources/providers/context.js";
import { resolveCaptchaSolver } from "../sources/providers/captchaSolver.js";
import {
  deriveRiskIndicators,
  normalizeAccident,
  normalizeLicense,
  normalizeLien,
  normalizeOwnership,
  normalizePricing,
  normalizeRecalls,
  normalizeSpecs,
} from "./normalize.js";
import type { ReportRequest } from "./validate.js";
import type { SectionMeta, UnifiedVehicleReport } from "./schema.js";

export interface BuildOptions {
  /** Skip the cache (force a fresh pull). */
  noCache?: boolean;
}

export async function buildReport(
  req: ReportRequest,
  opts: BuildOptions = {},
): Promise<UnifiedVehicleReport> {
  const plate = req.plate; // already digits-only from validation
  const plateNum = Number(plate);

  if (!opts.noCache) {
    const cached = await getCached(plate);
    if (cached) return cached;
  }

  const warnings: string[] = [];

  // 1. Locate + classify.
  const found = await findVehicle(plateNum);
  const reg = found.records[0];
  for (const e of found.errors) warnings.push(`registry: ${e.message}`);

  // 2. Fan out everything that depends only on the plate, in parallel.
  const [history, offRoad, disabledTag] = await Promise.all([
    fetchHistory(plateNum),
    fetchOffRoad(plateNum),
    fetchDisabledTag(plateNum),
  ]);
  for (const e of [...history.errors, ...offRoad.errors, ...disabledTag.errors]) {
    warnings.push(e.message);
  }

  // Model spec + recalls need IDs/name off the registry record.
  const tozeretCd = reg ? Number(reg["tozeret_cd"]) : NaN;
  const degemCd = reg ? Number(reg["degem_cd"]) : NaN;
  const year = reg ? Number(reg["shnat_yitzur"]) : NaN;
  const makeName = reg ? String(reg["tozeret_nm"] ?? "") : "";

  const hasModelKeys = Number.isFinite(tozeretCd) && Number.isFinite(degemCd) && Number.isFinite(year);
  const [degem, recalls, listPrice, modelPrices] = await Promise.all([
    hasModelKeys
      ? fetchDegemSpec(tozeretCd, degemCd, year)
      : Promise.resolve({ records: [], errors: [] }),
    makeName && Number.isFinite(year)
      ? fetchRecalls(makeName, year)
      : Promise.resolve({ records: [], errors: [] }),
    hasModelKeys
      ? fetchListPrice(tozeretCd, degemCd, year)
      : Promise.resolve({ records: [], errors: [] }),
    Number.isFinite(tozeretCd) && Number.isFinite(degemCd)
      ? fetchModelPriceHistory(tozeretCd, degemCd)
      : Promise.resolve({ records: [], errors: [] }),
  ]);
  for (const e of [...degem.errors, ...recalls.errors, ...listPrice.errors, ...modelPrices.errors]) {
    warnings.push(e.message);
  }

  // Specs are needed before pricing (the pricing estimate reads them).
  const specs = normalizeSpecs(reg, degem.records[0], found.category, found.errors);

  // Pluggable providers (lien + accident + pricing), built via DI so an
  // authorized verification/pricing service can be injected without touching the
  // pipeline. The pricing provider is a LICENSED slot (e.g. Levi Yitzhak); when
  // absent, normalizePricing falls back to a transparent self-estimate.
  const providerCtx = defaultProviderContext({ captcha: resolveCaptchaSolver() });
  const lienProvider = resolveLienProvider(providerCtx);
  const accidentProvider = resolveAccidentProvider(providerCtx);
  const pricingProvider = resolvePricingProvider(providerCtx);
  const [lienRes, accidentRes, pricingRes] = await Promise.all([
    safeProvider(() =>
      lienProvider.check({ plate, ownerId: req.ownerId, ownershipDate: req.ownershipDate }),
      "lien",
      warnings,
    ),
    safeProvider(() => accidentProvider.history({ plate }), "accident", warnings),
    safeProvider(
      () =>
        pricingProvider.price({
          plate,
          make: specs.make,
          model: specs.model,
          year: specs.year,
          engineCc: specs.engineDisplacementCc,
          fuelType: specs.fuelType,
        }),
      "pricing",
      warnings,
    ),
  ]);

  // 3. Normalize. Risk indicators are derived first so the lien/accident risk
  // assessments can cite the registry flags they're built on.
  const riskIndicators = deriveRiskIndicators(
    history.records[0],
    offRoad.records[0],
    disabledTag.records[0],
    [...history.errors, ...offRoad.errors, ...disabledTag.errors],
  );

  const report: UnifiedVehicleReport = {
    plate,
    generatedAt: new Date().toISOString(),
    classification: { category: found.category as UnifiedVehicleReport["classification"]["category"] },
    specs,
    ownership: normalizeOwnership(reg, history.records, found.category, history.errors),
    license: normalizeLicense(reg, history.records[0], found.category, [...found.errors, ...history.errors]),
    recalls: normalizeRecalls(recalls.records, recalls.records.length > 0, recalls.errors),
    riskIndicators,
    pricing: normalizePricing(specs, pricingRes, listPrice.records[0], modelPrices.records),
    liens: normalizeLien(lienRes, riskIndicators),
    accidents: normalizeAccident(accidentRes, riskIndicators),
    completeness: 0,
    warnings,
  };

  // Collapse duplicate warnings (sharded queries can repeat the same message).
  report.warnings = [...new Set(warnings)];

  // 4. Completeness across the data-bearing sections.
  report.completeness = computeCompleteness(report);

  // Only cache reports where the vehicle was actually found, to avoid pinning
  // a transient "not found" for the whole TTL.
  if (found.category !== "unknown" && !opts.noCache) {
    await setCached(plate, report).catch((e) => warnings.push(`cache write: ${e.message}`));
  }

  return report;
}

async function safeProvider<T extends { available: boolean; reason?: string }>(
  fn: () => Promise<T>,
  label: string,
  warnings: string[],
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    warnings.push(`${label} provider error: ${(e as Error).message}`);
    return { available: false, reason: `provider threw: ${(e as Error).message}` } as T;
  }
}

/** Fraction of sections that returned real data (unavailable/error don't count). */
function computeCompleteness(r: UnifiedVehicleReport): number {
  const metas: SectionMeta[] = [
    r.specs.meta,
    r.ownership.meta,
    r.license.meta,
    r.recalls.meta,
    r.riskIndicators.meta,
    r.liens.meta,
    r.accidents.meta,
  ];
  const ok = metas.filter((m) => m.status === "ok" || m.status === "partial").length;
  return Math.round((ok / metas.length) * 100) / 100;
}
