import assert from "node:assert/strict";
import { test } from "node:test";
import { reportRequestSchema } from "../src/core/validate.js";
import { resolveLienProvider } from "../src/sources/providers/lienProvider.js";
import { defaultProviderContext, NoopCaptchaSolver } from "../src/sources/providers/context.js";
import {
  deriveRiskIndicators,
  normalizeAccident,
  normalizeLicense,
  normalizeLien,
  normalizeOwnership,
  normalizePricing,
  normalizeSpecs,
} from "../src/core/normalize.js";

test("plate validation strips formatting and range-checks", () => {
  const ok = reportRequestSchema.safeParse({ plate: "66-304-902" });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.plate, "66304902");

  const tooShort = reportRequestSchema.safeParse({ plate: "12" });
  assert.equal(tooShort.success, false);
});

test("normalizeSpecs maps Hebrew fields and reports not_found when absent", () => {
  const empty = normalizeSpecs(undefined, undefined, "unknown", []);
  assert.equal(empty.meta.status, "not_found");
  assert.equal(empty.make, null);

  const reg = { tozeret_nm: "טויוטה", shnat_yitzur: 2021, tzeva_rechev: "לבן" };
  const degem = { automatic_ind: 1, mispar_moshavim: 5, koah_sus: 98 };
  const s = normalizeSpecs(reg, degem, "private_commercial", []);
  assert.equal(s.make, "טויוטה");
  assert.equal(s.year, 2021);
  assert.equal(s.gearbox, "automatic");
  assert.equal(s.seats, 5);
  assert.equal(s.meta.status, "ok");
});

test("risk indicators derive from real flags and are labeled honestly", () => {
  const ri = deriveRiskIndicators(
    { shinui_mivne_ind: 1, gapam_ind: 0, shinui_zmig_ind: 1 },
    undefined,
    undefined,
    [],
  );
  assert.equal(ri.structureChanged, true);
  assert.equal(ri.recordedAsStolenOrConfiscated, false);
  assert.equal(ri.wasOffRoad, false);
  assert.match(ri.meta.note ?? "", /NOT a record of accidents/);
});

test("disabled lien provider yields unavailable, never fabricates", () => {
  const lien = normalizeLien({ available: false, reason: "not configured" });
  assert.equal(lien.meta.status, "unavailable");
  assert.equal(lien.hasLien, null);
  assert.deepEqual(lien.liens, []);
});

test("theft check: clear when gapam flag is 0, flagged when 1, from real registry", () => {
  const clear = deriveRiskIndicators({ gapam_ind: 0 }, undefined, undefined, []);
  assert.equal(clear.theftCheck.status, "clear");
  assert.match(clear.theftCheck.statement, /אינו מסומן כגנוב/);

  const flagged = deriveRiskIndicators({ gapam_ind: 1 }, undefined, undefined, []);
  assert.equal(flagged.theftCheck.status, "flagged");
  assert.match(flagged.theftCheck.statement, /גפ"ם|גניבה/);

  const unknown = deriveRiskIndicators(undefined, undefined, undefined, []);
  assert.equal(unknown.theftCheck.status, "unknown");
});

test("ownership timeline is mined from all history rows, sorted ascending", () => {
  const history = [
    // structure shard row (no baalut_dt) carries origin + first-reg date
    { mkoriut_nm: "יבוא יצרן", rishum_rishon_dt: "2021-08-01 00:00:00" },
    { baalut_dt: 202505, baalut: "פרטי" },
    { baalut_dt: 202108, baalut: "החכר" },
    { baalut_dt: 202410, baalut: "סוחר" },
  ];
  const o = normalizeOwnership({ baalut: "פרטי" }, history, "private_commercial", []);
  // 3 dated ownership rows form the timeline, ordered oldest → newest.
  assert.deepEqual(
    o.timeline.map((p) => p.date),
    ["2021-08", "2024-10", "2025-05"],
  );
  assert.equal(o.timeline[0]!.ownershipType, "החכר");
  assert.equal(o.observedOwnerRecords, 3);
  assert.equal(o.usageProfile.wasLease, true);
  assert.equal(o.usageProfile.wasDealer, true);
  assert.equal(o.usageProfile.wasImported, true);
});

test("usage flags are null (not false) when no code is present", () => {
  // No history at all → no ownership codes observed → flags must be null, never guessed false.
  const o = normalizeOwnership(undefined, [], "unknown", []);
  assert.equal(o.usageProfile.wasLease, null);
  assert.equal(o.usageProfile.wasTaxi, null);
  assert.deepEqual(o.timeline, []);
});

test("mileage carries one confirmed reading plus a labeled annual estimate", () => {
  const reg = { shnat_yitzur: 2021, mivchan_acharon_dt: "2025-08-05", tokef_dt: "2026-07-31" };
  const hist = { kilometer_test_aharon: 81782 };
  const lic = normalizeLicense(reg, hist, "private_commercial", []);
  assert.equal(lic.mileage.km, 81782);
  assert.equal(lic.mileage.confirmedReadings, 1);
  // 81782 km over ~4 years ≈ 20445 km/yr — an estimate, not a measured trend.
  assert.equal(lic.mileage.estimatedAnnualKm, Math.round(81782 / 4));
});

test("unavailable lien still gives an honest, sourced risk assessment", () => {
  const lien = normalizeLien({ available: false, reason: "not configured" });
  assert.ok(lien.riskAssessment, "expected a risk assessment instead of a blank");
  assert.match(lien.riskAssessment!.statement, /רשם המשכונות/);
  assert.equal(lien.riskAssessment!.level, "unknown");
});

test("unavailable accident assessment reflects derived registry flags", () => {
  const risk = deriveRiskIndicators({ shinui_mivne_ind: 1, gapam_ind: 0 }, undefined, undefined, []);
  const acc = normalizeAccident({ available: false, reason: "no source" }, risk);
  assert.ok(acc.riskAssessment);
  assert.equal(acc.riskAssessment!.level, "medium"); // structure change present
  assert.match(acc.riskAssessment!.statement, /שינוי מבנה/);
});

test("pricing: estimate falls back to a heuristic when no list price is known", () => {
  const specs = normalizeSpecs(
    { tozeret_nm: "טויוטה", shnat_yitzur: 2021 },
    { nefah_manoa: 1798, technologiat_hanaa_nm: "היברידי רגיל" },
    "private_commercial",
    [],
  );
  const pricing = normalizePricing(specs, { available: false, reason: "no license" }, undefined, []);
  assert.equal(pricing.authoritative, null);
  assert.equal(pricing.originalListPrice, null);
  assert.ok(pricing.estimate, "expected a self-estimate");
  assert.equal(pricing.estimate!.anchoredToListPrice, false);
  // The redundant Levi-Yitzhak disclaimer must be gone.
  assert.ok(!/לוי יצחק/.test(pricing.estimate!.method));
});

test("pricing: real gov list price anchors the estimate and is shown as original price", () => {
  const specs = normalizeSpecs({ shnat_yitzur: 2021 }, { nefah_manoa: 1798 }, "private_commercial", []);
  const listRow = { mehir: 141900, shem_yevuan: 'יוניון מוטורס בע"מ', shnat_yitzur: 2021 };
  const history = [
    { mehir: 139900, shnat_yitzur: 2020 },
    { mehir: 141900, shnat_yitzur: 2021 },
    { mehir: 154990, shnat_yitzur: 2023 },
  ];
  const pricing = normalizePricing(specs, { available: false }, listRow, history);
  // Original list price surfaced from real gov data.
  assert.ok(pricing.originalListPrice);
  assert.equal(pricing.originalListPrice!.amount, 141900);
  assert.equal(pricing.originalListPrice!.importer, 'יוניון מוטורס בע"מ');
  // Estimate is anchored to that real price.
  assert.equal(pricing.estimate!.anchoredToListPrice, true);
  assert.match(pricing.estimate!.method, /מחיר המחירון המקורי/);
  // A market range exists and never exceeds the original list price.
  assert.ok(pricing.marketRange);
  assert.ok(pricing.marketRange!.high <= 141900);
  assert.ok(pricing.marketRange!.low < pricing.marketRange!.high);
  assert.equal(pricing.meta.status, "ok");
});

test("pricing: depreciation is calibrated to the real market, not over-aggressive", () => {
  // Hyundai i10 2021, list ₪83,900 — Levi Yitzhak market value is ~₪66k.
  // The old 13%/yr flat model gave ₪42k (way too low). The estimate must now
  // land within a sane band of the real market value (±20%).
  const specs = normalizeSpecs({ shnat_yitzur: 2021 }, { nefah_manoa: 998 }, "private_commercial", []);
  const listRow = { mehir: 83900, shem_yevuan: "כלמוביל", shnat_yitzur: 2021 };
  const pricing = normalizePricing(specs, { available: false }, listRow, [listRow]);
  const est = pricing.estimate!.amount;
  assert.ok(est >= 55000 && est <= 75000, `i10 estimate ₪${est} should be ~₪66k (got far off)`);
});

test("pricing: a licensed provider result is authoritative and sourced", () => {
  const specs = normalizeSpecs({ shnat_yitzur: 2021 }, {}, "private_commercial", []);
  const pricing = normalizePricing(
    specs,
    { available: true, amount: 123456, currency: "ILS", source: "לוי יצחק (מורשה)" },
    undefined,
    [],
  );
  assert.ok(pricing.authoritative);
  assert.equal(pricing.authoritative!.amount, 123456);
  assert.equal(pricing.authoritative!.source, "לוי יצחק (מורשה)");
});

test("specs: enriched WLTP safety features come through as real flags only", () => {
  const specs = normalizeSpecs(
    { tozeret_nm: "טויוטה", shnat_yitzur: 2021 },
    { bakarat_shyut_adaptivit_ind: 1, matzlemat_reverse_ind: 1, zihuy_holchey_regel_ind: 0, mispar_kariot_avir: 7 },
    "private_commercial",
    [],
  );
  assert.equal(specs.airbags, 7);
  assert.ok(specs.safetyFeatures.includes("בקרת שיוט אדפטיבית"));
  assert.ok(specs.safetyFeatures.includes("מצלמת רוורס"));
  // A 0 flag must NOT appear.
  assert.ok(!specs.safetyFeatures.includes("זיהוי הולכי רגל"));
});

test("provider DI: default context ships disabled with a no-op captcha solver", async () => {
  const ctx = defaultProviderContext();
  // No CAPTCHA bypass is wired by default — the solver does nothing.
  assert.ok(ctx.captcha instanceof NoopCaptchaSolver);
  assert.equal(ctx.captcha.enabled, false);
  assert.equal(await ctx.captcha.solve({ kind: "image" }), null);

  // With no authorized endpoint configured, the lien provider stays disabled
  // and reports unavailable — it never fabricates a "clean" result.
  const provider = resolveLienProvider(ctx);
  const res = await provider.check({ plate: "66304902" });
  assert.equal(res.available, false);
  assert.match(res.reason ?? "", /authorized reseller|not configured/i);
});
