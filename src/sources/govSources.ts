/**
 * Extraction layer — government open-data adapters.
 *
 * Each function performs ONE concern's retrieval and returns raw records plus
 * any non-fatal errors. No normalization happens here (that's the normalizer's
 * job); these adapters only know how to *find* records.
 */
import { RESOURCES } from "../config.js";
import { datastoreSearch, datastoreSearchSharded, type Record_ } from "../core/ckan.js";

export interface RawFetch {
  records: Record_[];
  errors: Error[];
}

/**
 * Locate the vehicle in the registries, trying each in priority order. Returns
 * the first registry that has a hit, along with which category it was found in.
 * This both retrieves the core record AND classifies the vehicle.
 */
export async function findVehicle(plate: number): Promise<
  RawFetch & { category: string }
> {
  const order: Array<{ key: keyof typeof RESOURCES; category: string }> = [
    { key: "privateCommercial", category: "private_commercial" },
    { key: "motorcycle", category: "motorcycle" },
    { key: "heavyTruck", category: "heavy_truck" },
    { key: "personalImport", category: "personal_import" },
    { key: "inactiveWithDegem", category: "inactive" },
    { key: "offRoad", category: "off_road" },
  ];

  const allErrors: Error[] = [];
  for (const { key, category } of order) {
    const res = RESOURCES[key];
    const { records, errors } = await datastoreSearchSharded(res.ids, {
      [res.plateField as string]: plate,
    });
    allErrors.push(...errors);
    if (records.length > 0) {
      return { records, errors: allErrors, category };
    }
  }
  return { records: [], errors: allErrors, category: "unknown" };
}

/** Ownership/structure history — carries last-test mileage + change flags. */
export async function fetchHistory(plate: number): Promise<RawFetch> {
  const res = RESOURCES.history;
  return datastoreSearchSharded(res.ids, { [res.plateField as string]: plate });
}

/** Off-road / final-cancellation record (scrapped vehicles). */
export async function fetchOffRoad(plate: number): Promise<RawFetch> {
  const res = RESOURCES.offRoad;
  return datastoreSearchSharded(res.ids, { [res.plateField as string]: plate });
}

/** Disabled-parking tag (column name has a space: "MISPAR RECHEV"). */
export async function fetchDisabledTag(plate: number): Promise<RawFetch> {
  const res = RESOURCES.disabledTag;
  try {
    const records = await datastoreSearch(res.ids[0]!, { [res.plateField as string]: plate });
    return { records, errors: [] };
  } catch (e) {
    return { records: [], errors: [e as Error] };
  }
}

/**
 * Full technical spec for a model, joined by tozeret_cd + degem_cd + year.
 * The WLTP table is keyed by model, not plate — we pass the IDs we read off the
 * vehicle's registry record.
 */
export async function fetchDegemSpec(
  tozeretCd: number,
  degemCd: number,
  year: number,
): Promise<RawFetch> {
  const res = RESOURCES.degemWltp;
  try {
    const records = await datastoreSearch(res.ids[0]!, {
      tozeret_cd: tozeretCd,
      degem_cd: degemCd,
      shnat_yitzur: year,
    });
    return { records, errors: [] };
  } catch (e) {
    return { records: [], errors: [e as Error] };
  }
}

/**
 * Official new-car list price for this exact model+year, from the Ministry of
 * Transport price-list dataset (joined by tozeret_cd + degem_cd + year). Returns
 * the matching row(s); the normalizer reads `mehir` + `shem_yevuan`.
 */
export async function fetchListPrice(
  tozeretCd: number,
  degemCd: number,
  year: number,
): Promise<RawFetch> {
  const res = RESOURCES.newCarPriceList;
  try {
    const records = await datastoreSearch(res.ids[0]!, {
      tozeret_cd: tozeretCd,
      degem_cd: degemCd,
      shnat_yitzur: year,
    });
    return { records, errors: [] };
  } catch (e) {
    return { records: [], errors: [e as Error] };
  }
}

/**
 * All list-price rows for a model across every year on record (same model, any
 * year). Used to build a price-range "scale" for comparable vehicles.
 */
export async function fetchModelPriceHistory(
  tozeretCd: number,
  degemCd: number,
): Promise<RawFetch> {
  const res = RESOURCES.newCarPriceList;
  try {
    const records = await datastoreSearch(res.ids[0]!, { tozeret_cd: tozeretCd, degem_cd: degemCd }, 50);
    return { records, errors: [] };
  } catch (e) {
    return { records: [], errors: [e as Error] };
  }
}

/**
 * Recalls matched by manufacturer name + model build window. The recall table
 * uses make NAME (TOZAR_TEUR) and build-year range, so we filter client-side
 * after pulling the manufacturer's recalls.
 */
export async function fetchRecalls(makeName: string, year: number): Promise<RawFetch> {
  const res = RESOURCES.recall;
  try {
    const records = await datastoreSearch(res.ids[0]!, { TOZAR_TEUR: makeName }, 500);
    const matched = records.filter((r) => {
      const begin = Number(r["BUILD_BEGIN_A"]);
      const end = Number(r["BUILD_END_A"]);
      if (!Number.isFinite(begin) || !Number.isFinite(end)) return true; // keep if unknown window
      return year >= begin && year <= end;
    });
    return { records: matched, errors: [] };
  } catch (e) {
    return { records: [], errors: [e as Error] };
  }
}
