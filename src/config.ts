/**
 * Central configuration: data sources, resource IDs, and runtime knobs.
 *
 * Every resource_id below was verified LIVE against the data.gov.il CKAN
 * datastore on 2026-06-21. These are the real Israeli Ministry of Transport
 * open datasets that back the report. Do not invent IDs — verify with:
 *   GET https://data.gov.il/api/3/action/datastore_search?resource_id=<id>&limit=1
 */

export const CKAN_BASE = process.env.CKAN_BASE ?? "https://data.gov.il/api/3/action";

/**
 * Verified datastore resource IDs, grouped by the report concern they feed.
 * `plateField` is the column that holds the license-plate number in each
 * resource (it is NOT consistent across datasets — some use `mispar_rechev`,
 * the disabled-parking table uses `MISPAR RECHEV` with a space).
 */
export const RESOURCES = {
  /** Active private + commercial vehicles (the primary registry). Two shards. */
  privateCommercial: {
    ids: ["053cea08-09bc-40ec-8f7a-156f0677aff3", "0866573c-40cd-4ca8-91d2-9dd2d7a492e5"],
    plateField: "mispar_rechev",
  },
  /** Ownership/structure history — carries last-test MILEAGE + ownership type. */
  history: {
    ids: ["56063a99-8a3e-4ff4-912e-5966c0279bad", "bb2355dc-9ec7-4f06-9c3f-3344672171da"],
    plateField: "mispar_rechev",
  },
  /** Full technical spec by make/model (WLTP): gearbox, hp, seats, safety, emissions. */
  degemWltp: {
    ids: ["142afde2-6228-49f9-8a29-9b6c3a0cbe40"],
    plateField: null, // joined by tozeret_cd + degem_cd + shnat_yitzur, not by plate
  },
  /**
   * Official Ministry of Transport new-car PRICE LIST (יבואנים ומחירוני רכב חדש).
   * Carries the importer's list price (`mehir`) keyed by tozeret_cd + degem_cd +
   * year — the same join keys as the WLTP spec. ~99k rows.
   */
  newCarPriceList: {
    ids: ["39f455bf-6db0-4926-859d-017f34eacbcb"],
    plateField: null,
  },
  /** Manufacturer recalls, matched by make + model + build-year window. */
  recall: {
    ids: ["2c33523f-87aa-44ec-a736-edbb0a82975e"],
    plateField: null,
  },
  /** Disabled-parking tag holders (note the SPACE in the column name). */
  disabledTag: {
    ids: ["c8b9f9c8-4612-4068-934f-d4acd2e3c06e"],
    plateField: "MISPAR RECHEV",
  },
  /** Vehicles taken off the road / final cancellation (scrapped). */
  offRoad: {
    ids: [
      "851ecab1-0622-4dbe-a6c7-f950cf82abf9",
      "4e6b9724-4c1e-43f0-909a-154d4cc4e046",
      "ec8cbc34-72e1-4b69-9c48-22821ba0bd6c",
    ],
    plateField: "mispar_rechev",
  },
  /** Inactive vehicles still carrying a model code (de-registered but identifiable). */
  inactiveWithDegem: {
    ids: ["f6efe89a-fb3d-43a4-bb61-9bf12a9b9099"],
    plateField: "mispar_rechev",
  },
  /** Motorcycles / two-wheelers (separate registry, different schema). */
  motorcycle: {
    ids: ["bf9df4e2-d90d-4c0a-a400-19e15af8e95f"],
    plateField: "mispar_rechev",
  },
  /** Personal-import vehicles (יבוא אישי). */
  personalImport: {
    ids: ["03adc637-b6fe-402b-9937-7c3d3afc9140"],
    plateField: "mispar_rechev",
  },
  /** Heavy trucks > 3.5t and vehicles lacking a model code. */
  heavyTruck: {
    ids: ["cd3acc5c-03c3-4c89-9c54-d40f93c0d790"],
    plateField: "mispar_rechev",
  },
} as const;

export type ResourceKey = keyof typeof RESOURCES;

export const HTTP = {
  timeoutMs: Number(process.env.HTTP_TIMEOUT_MS ?? 15000),
  maxRetries: Number(process.env.HTTP_MAX_RETRIES ?? 4),
  baseBackoffMs: Number(process.env.HTTP_BACKOFF_MS ?? 400),
  /** Rotate among realistic desktop UAs to avoid trivial UA-based blocking. */
  userAgents: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
  ],
} as const;

export const CACHE = {
  /** TTL for a fully-assembled report. Government data updates daily. */
  reportTtlMs: Number(process.env.CACHE_TTL_MS ?? 12 * 60 * 60 * 1000),
  dir: process.env.CACHE_DIR ?? ".cache",
} as const;

/**
 * Provider toggles. Liens + accident *records* have no free public source in
 * Israel, so they ship DISABLED and never fabricate. Set the env var and supply
 * a real implementation to enable. See src/sources/providers/.
 */
export const PROVIDERS = {
  lien: {
    enabled: process.env.LIEN_PROVIDER_ENABLED === "true",
    apiKey: process.env.LIEN_PROVIDER_API_KEY ?? "",
    /** Authorized commercial reseller endpoint (NOT the gov.il portal). */
    verifyEndpoint: process.env.LIEN_VERIFY_ENDPOINT ?? "",
  },
  accident: {
    enabled: process.env.ACCIDENT_PROVIDER_ENABLED === "true",
    apiKey: process.env.ACCIDENT_PROVIDER_API_KEY ?? "",
    verifyEndpoint: process.env.ACCIDENT_VERIFY_ENDPOINT ?? "",
  },
  /**
   * CAPTCHA solver — disabled by default. Only for an AUTHORIZED upstream that
   * challenges its own paying API clients; never to bypass government portals.
   */
  captcha: {
    enabled: process.env.CAPTCHA_SOLVER_ENABLED === "true",
    apiKey: process.env.CAPTCHA_SOLVER_API_KEY ?? "",
  },
  /**
   * Pricing — a LICENSED provider (e.g. Levi Yitzhak) drops in here. Disabled by
   * default; when off, the report shows a transparent self-estimate instead of
   * authoritative prices, and never labels the estimate as Levi Yitzhak.
   */
  pricing: {
    enabled: process.env.PRICING_PROVIDER_ENABLED === "true",
    apiKey: process.env.PRICING_PROVIDER_API_KEY ?? "",
    endpoint: process.env.PRICING_ENDPOINT ?? "",
    /** Display name of the licensed source, shown as provenance. */
    sourceName: process.env.PRICING_SOURCE_NAME ?? "מחירון מורשה",
  },
} as const;
