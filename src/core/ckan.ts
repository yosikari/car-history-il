/**
 * Thin client over the data.gov.il CKAN datastore_search API.
 *
 * CKAN quirks we handle here, learned from live probing:
 *  - `filters` must be a JSON object, URL-encoded. Free-text `q` does NOT do
 *    exact plate matching reliably — always use `filters` for plate lookups.
 *  - Some datasets are sharded across multiple resource IDs (e.g. the registry
 *    "continuation" table); we query all shards and merge.
 *  - Column names are inconsistent across resources (e.g. "MISPAR RECHEV" with
 *    a space) — the caller passes the exact field name.
 */
import { CKAN_BASE } from "../config.js";
import { fetchJson, HttpError } from "./http.js";

/**
 * Some legacy datastore shards lack an index on the plate column and reject
 * filtered queries with 409 "Invalid query". This is a permanent property of
 * those shards, not a failure — callers skip them silently rather than warn.
 */
export class UnqueryableShardError extends Error {
  constructor(readonly resourceId: string) {
    super(`Resource ${resourceId} does not support this filter (unindexed column).`);
    this.name = "UnqueryableShardError";
  }
}

interface CkanResponse<T> {
  success: boolean;
  result?: { records: T[]; total: number };
  error?: unknown;
}

export type Record_ = Record<string, unknown>;

/** Query a single resource by an exact field=value filter. */
export async function datastoreSearch(
  resourceId: string,
  filters: Record<string, string | number>,
  limit = 100,
): Promise<Record_[]> {
  const params = new URLSearchParams({
    resource_id: resourceId,
    limit: String(limit),
    filters: JSON.stringify(filters),
  });
  const url = `${CKAN_BASE}/datastore_search?${params.toString()}`;
  let data: CkanResponse<Record_>;
  try {
    data = await fetchJson<CkanResponse<Record_>>(url);
  } catch (e) {
    // 409 here means the shard rejected the filter (unindexed column).
    if (e instanceof HttpError && e.status === 409) throw new UnqueryableShardError(resourceId);
    throw e;
  }
  if (!data.success || !data.result) {
    throw new Error(`CKAN query failed for ${resourceId}: ${JSON.stringify(data.error)}`);
  }
  return data.result.records;
}

/**
 * Query several resource shards with the same filter and merge results.
 * Shards are queried in parallel; a failure on one shard is tolerated as long
 * as at least one shard responds (the caller decides how to treat zero hits).
 */
export async function datastoreSearchSharded(
  resourceIds: readonly string[],
  filters: Record<string, string | number>,
  limit = 100,
): Promise<{ records: Record_[]; errors: Error[] }> {
  const settled = await Promise.allSettled(
    resourceIds.map((id) => datastoreSearch(id, filters, limit)),
  );
  const records: Record_[] = [];
  const errors: Error[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") {
      records.push(...s.value);
    } else if (s.reason instanceof UnqueryableShardError) {
      // Known, permanent limitation of legacy shards — skip without warning.
      continue;
    } else {
      errors.push(s.reason instanceof Error ? s.reason : new Error(String(s.reason)));
    }
  }
  return { records, errors };
}
