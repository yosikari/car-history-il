/**
 * ResilientFetcher — a reusable, DISABLED-BY-DEFAULT scraping scaffold.
 *
 * Purpose: provide the resilient transport (rotating User-Agents, smart retry
 * with exponential backoff + jitter, timeout, optional headless-browser render)
 * that a *lawfully-sourced* provider would need to read a public status page.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * LAWFUL-USE BOUNDARY (read before pointing this at any host):
 *   - This module ships disabled and is NOT wired to any endpoint by default.
 *   - It must NOT be used to bypass authentication, CAPTCHAs, paywalls, or a
 *     site's Terms of Service. Israel's Rasham HaMashkonot (liens) and any
 *     by-plate accident lookup are paid and/or CAPTCHA-gated — those are out of
 *     scope here and should be integrated via a contracted, authorized provider.
 *   - Respect robots.txt, rate limits, and applicable law in your jurisdiction.
 * Enable per-call with `enabled: true` ONLY for sources you are authorized to
 * fetch (e.g. your own services, or genuinely public, ToS-permitted pages).
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Network policy (UA rotation + backoff) is shared with src/core/http.ts so
 * behavior is consistent across JSON and HTML fetches.
 */
import { HTTP } from "../../config.js";

let uaIndex = 0;
function nextUserAgent(): string {
  const ua = HTTP.userAgents[uaIndex % HTTP.userAgents.length]!;
  uaIndex++;
  return ua;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function backoff(attempt: number): number {
  return Math.floor(Math.random() * HTTP.baseBackoffMs * 2 ** attempt);
}

export interface FetchHtmlOptions {
  /** Must be explicitly true to perform any network call. Default: disabled. */
  enabled?: boolean;
  maxRetries?: number;
  headers?: Record<string, string>;
  /** Use a headless browser (Playwright) for JS-rendered pages. */
  render?: boolean;
}

export interface FetchHtmlResult {
  ok: boolean;
  status?: number;
  html?: string;
  /** Why the fetch did not run / failed — surfaced honestly to the caller. */
  reason?: string;
}

/**
 * Fetch a public page as HTML with resilient transport. Returns a result object
 * (never throws for the disabled/blocked cases) so providers can degrade to an
 * honest "unavailable" instead of crashing.
 */
export class ResilientFetcher {
  async fetchHtml(url: string, opts: FetchHtmlOptions = {}): Promise<FetchHtmlResult> {
    if (!opts.enabled) {
      return {
        ok: false,
        reason:
          "ResilientFetcher is disabled by default. Enable only for sources you are authorized " +
          "to fetch (see lawful-use note). Gated/paid portals require a contracted provider.",
      };
    }
    if (opts.render) return this.renderWithBrowser(url, opts);

    const maxRetries = opts.maxRetries ?? HTTP.maxRetries;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP.timeoutMs);
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent": nextUserAgent(),
            Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
            "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
            ...opts.headers,
          },
        });
        if (!res.ok) {
          const transient = res.status === 429 || (res.status >= 500 && res.status <= 599);
          if (transient && attempt < maxRetries) {
            await sleep(backoff(attempt));
            continue;
          }
          return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
        }
        return { ok: true, status: res.status, html: await res.text() };
      } catch (e) {
        if (attempt < maxRetries) {
          await sleep(backoff(attempt));
          continue;
        }
        return { ok: false, reason: `network error: ${(e as Error).message}` };
      } finally {
        clearTimeout(timer);
      }
    }
    return { ok: false, reason: `exhausted ${maxRetries} retries` };
  }

  /** Headless render for JS-heavy pages. Dynamic import keeps Playwright optional. */
  private async renderWithBrowser(url: string, opts: FetchHtmlOptions): Promise<FetchHtmlResult> {
    try {
      const pw: any = await import(/* @vite-ignore */ "playwright" as string);
      const browser = await pw.chromium.launch();
      try {
        const page = await browser.newPage({ userAgent: nextUserAgent() });
        if (opts.headers) await page.setExtraHTTPHeaders(opts.headers);
        await page.goto(url, { waitUntil: "networkidle", timeout: HTTP.timeoutMs });
        return { ok: true, html: await page.content() };
      } finally {
        await browser.close();
      }
    } catch (e) {
      return {
        ok: false,
        reason: `browser render unavailable: ${(e as Error).message} (install: npm i -D playwright)`,
      };
    }
  }
}

export const resilientFetcher = new ResilientFetcher();
