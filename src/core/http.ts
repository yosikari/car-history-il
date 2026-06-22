/**
 * Resilient HTTP fetch with retry, exponential backoff + jitter, timeout,
 * and User-Agent rotation. Built on the native fetch in Node >= 18.
 *
 * Handles the "Resilience" directive: transient failures, rate limits (429),
 * and basic bot-detection avoidance via realistic rotating UAs. This is the
 * one place network failure policy lives.
 */
import { HTTP } from "../config.js";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retriable = false,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

let uaIndex = 0;
function nextUserAgent(): string {
  const ua = HTTP.userAgents[uaIndex % HTTP.userAgents.length]!;
  uaIndex++;
  return ua;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 429 and 5xx are transient; honor Retry-After when present.
 *
 * NOTE: data.gov.il returns 409 for "Invalid query" on legacy shards whose
 * plate column is not indexed — that is permanent, not transient, so 409 is
 * deliberately NOT retriable here. The CKAN layer detects and skips those.
 */
function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  /** Override default retry count for this call. */
  maxRetries?: number;
  signal?: AbortSignal;
}

/**
 * Fetch a URL and parse JSON, with full retry/backoff handling.
 * Throws HttpError on non-retriable failure or once retries are exhausted.
 */
export async function fetchJson<T = unknown>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? HTTP.maxRetries;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP.timeoutMs);
    // Chain caller's abort signal into ours.
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": nextUserAgent(),
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
          ...opts.headers,
        },
      });

      if (!res.ok) {
        const retriable = isRetriableStatus(res.status);
        if (retriable && attempt < maxRetries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : backoff(attempt);
          await sleep(wait);
          continue;
        }
        throw new HttpError(`HTTP ${res.status} for ${url}`, res.status, retriable);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isNetwork = err instanceof TypeError; // fetch network failure
      const transient = isAbort || isNetwork || (err instanceof HttpError && err.retriable);
      if (transient && attempt < maxRetries) {
        await sleep(backoff(attempt));
        continue;
      }
      if (err instanceof HttpError) throw err;
      throw new HttpError(
        `Network error for ${url}: ${(err as Error)?.message ?? String(err)}`,
        undefined,
        transient,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new HttpError(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/** Exponential backoff with full jitter. */
function backoff(attempt: number): number {
  const expo = HTTP.baseBackoffMs * 2 ** attempt;
  return Math.floor(Math.random() * expo);
}
