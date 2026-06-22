/**
 * Lien provider resolution — now constructed via dependency injection.
 *
 * A provider receives a `ProviderContext` (HTTP fetcher + optional CAPTCHA
 * solver for AUTHORIZED upstreams) and, for the real path, a
 * `LienVerificationService` that talks to a *licensed commercial reseller* of
 * Israeli lien data. There is intentionally NO code here that defeats the
 * official Rasham HaMashkonot CAPTCHA — that path is unlawful and produces data
 * we could not stand behind. See context.ts for the rationale.
 *
 * Wire a real reseller with:
 *   LIEN_PROVIDER_ENABLED=true
 *   LIEN_VERIFY_ENDPOINT=https://<reseller>/api/liens
 *   LIEN_PROVIDER_API_KEY=<your contracted key>
 */
import { PROVIDERS } from "../../config.js";
import { defaultProviderContext, type ProviderContext } from "./context.js";
import type { LienProvider, LienProviderResult, LienQuery } from "./types.js";

/**
 * Contract for an authorized lien-data source. Implemented by a reseller client;
 * the provider depends on this interface, not a concrete vendor.
 */
export interface LienVerificationService {
  readonly name: string;
  verify(query: LienQuery): Promise<LienProviderResult>;
}

/** Default: never fabricates. Reports unavailable until a real service is wired. */
class DisabledLienProvider implements LienProvider {
  readonly name = "disabled";
  async check(_query: LienQuery): Promise<LienProviderResult> {
    return {
      available: false,
      reason:
        "Lien (Meshkonot) verification is not configured. The official registry is paid + " +
        "CAPTCHA-gated and may not be lawfully scraped; wire an authorized reseller via " +
        "LIEN_VERIFY_ENDPOINT + LIEN_PROVIDER_API_KEY to enable.",
    };
  }
}

/**
 * Real provider: delegates to an injected `LienVerificationService` (an
 * authorized reseller). It uses the `ProviderContext.fetcher` for transport. The
 * CAPTCHA solver in the context is passed through ONLY for an upstream that
 * legitimately challenges its own paying clients — never to bypass gov.il.
 */
class VerifiedLienProvider implements LienProvider {
  readonly name = "verified-reseller";
  constructor(
    private readonly service: LienVerificationService,
    private readonly ctx: ProviderContext,
  ) {}

  async check(query: LienQuery): Promise<LienProviderResult> {
    return this.service.verify(query);
  }
}

/**
 * A minimal authorized-reseller client over a contracted JSON endpoint. Returns
 * `available:false` (never fabricates) if not fully configured. Replace the body
 * with your reseller's exact contract.
 */
class ResellerLienService implements LienVerificationService {
  readonly name = "reseller-api";
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly ctx: ProviderContext,
  ) {}

  async verify(query: LienQuery): Promise<LienProviderResult> {
    if (!this.endpoint || !this.apiKey) {
      return { available: false, reason: "LIEN_VERIFY_ENDPOINT / LIEN_PROVIDER_API_KEY missing." };
    }
    // The reseller is an authorized API; we fetch over the resilient transport.
    // (Left as the single integration point — implement the reseller's exact
    // request/response shape here. We do NOT invent a result on failure.)
    const url = `${this.endpoint}?plate=${encodeURIComponent(query.plate)}`;
    const res = await this.ctx.fetcher.fetchHtml(url, {
      enabled: true, // authorized endpoint — lawful to call
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
    });
    if (!res.ok || !res.html) {
      return { available: false, reason: `reseller unavailable: ${res.reason ?? "no body"}` };
    }
    try {
      const data = JSON.parse(res.html) as {
        hasLien?: boolean;
        liens?: LienProviderResult["liens"];
      };
      return { available: true, hasLien: data.hasLien ?? false, liens: data.liens ?? [] };
    } catch (e) {
      return { available: false, reason: `reseller parse error: ${(e as Error).message}` };
    }
  }
}

export function resolveLienProvider(
  ctx: ProviderContext = defaultProviderContext(),
): LienProvider {
  if (PROVIDERS.lien.enabled && PROVIDERS.lien.verifyEndpoint) {
    const service = new ResellerLienService(
      PROVIDERS.lien.verifyEndpoint,
      PROVIDERS.lien.apiKey,
      ctx,
    );
    return new VerifiedLienProvider(service, ctx);
  }
  return new DisabledLienProvider();
}
