/**
 * Simple file-backed cache for assembled reports, keyed by plate.
 *
 * Purpose (per the "Storage" directive): avoid redundant queries against
 * data.gov.il, reducing latency and the risk of rate-limiting/bans. Government
 * data updates ~daily, so a multi-hour TTL is safe. Swap this module for Redis
 * in a multi-instance deployment — the interface is intentionally minimal.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { CACHE } from "../config.js";
import type { UnifiedVehicleReport } from "./schema.js";

interface CacheEnvelope {
  storedAt: number;
  report: UnifiedVehicleReport;
}

/**
 * Disable the file cache entirely. Required on read-only/ephemeral filesystems
 * (e.g. Vercel serverless) — set CACHE_DISABLED=true. When disabled, every
 * request fetches fresh from data.gov.il.
 */
const CACHE_DISABLED = process.env.CACHE_DISABLED === "true";

function keyToFile(plate: string): string {
  return path.join(CACHE.dir, `${plate}.json`);
}

export async function getCached(plate: string): Promise<UnifiedVehicleReport | null> {
  if (CACHE_DISABLED) return null;
  try {
    const raw = await fs.readFile(keyToFile(plate), "utf8");
    const env = JSON.parse(raw) as CacheEnvelope;
    if (Date.now() - env.storedAt > CACHE.reportTtlMs) return null;
    return env.report;
  } catch {
    return null;
  }
}

export async function setCached(plate: string, report: UnifiedVehicleReport): Promise<void> {
  if (CACHE_DISABLED) return;
  await fs.mkdir(CACHE.dir, { recursive: true });
  const env: CacheEnvelope = { storedAt: Date.now(), report };
  await fs.writeFile(keyToFile(plate), JSON.stringify(env), "utf8");
}
