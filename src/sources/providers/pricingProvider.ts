/**
 * Pricing provider resolution (DI).
 *
 * מחירון לוי יצחק and similar Israeli price lists are PAID, COPYRIGHTED products
 * with no free/public API. We do not scrape them — that is unauthorized use of
 * their IP and would put data we can't stand behind into a sold report. Instead:
 *
 *  - If you license one, wire it here via PRICING_ENDPOINT + PRICING_PROVIDER_API_KEY
 *    and it becomes the authoritative price (labeled with PRICING_SOURCE_NAME).
 *  - Otherwise the report shows a transparent self-estimate (see estimateValue),
 *    explicitly labeled as an estimate — never as Levi Yitzhak.
 */
import { PROVIDERS } from "../../config.js";
import { defaultProviderContext, type ProviderContext } from "./context.js";
import type { PricingProvider, PricingProviderResult, PricingQuery } from "./types.js";

class DisabledPricingProvider implements PricingProvider {
  readonly name = "disabled";
  async price(_query: PricingQuery): Promise<PricingProviderResult> {
    return {
      available: false,
      reason:
        "No licensed pricing source configured. מחירון לוי יצחק is a paid product with no free " +
        "API; wire a licensed source via PRICING_ENDPOINT + PRICING_PROVIDER_API_KEY. Until then " +
        "an honest self-estimate is shown.",
    };
  }
}

/** Delegates to a licensed pricing API over the resilient transport. */
class LicensedPricingProvider implements PricingProvider {
  readonly name = "licensed";
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly sourceName: string,
    private readonly ctx: ProviderContext,
  ) {}

  async price(query: PricingQuery): Promise<PricingProviderResult> {
    if (!this.endpoint || !this.apiKey) {
      return { available: false, reason: "PRICING_ENDPOINT / PRICING_PROVIDER_API_KEY missing." };
    }
    const url = `${this.endpoint}?plate=${encodeURIComponent(query.plate)}`;
    const res = await this.ctx.fetcher.fetchHtml(url, {
      enabled: true, // authorized, licensed endpoint
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
    });
    if (!res.ok || !res.html) {
      return { available: false, reason: `pricing source unavailable: ${res.reason ?? "no body"}` };
    }
    try {
      const data = JSON.parse(res.html) as { amount?: number; currency?: string };
      if (typeof data.amount !== "number") {
        return { available: false, reason: "pricing source returned no amount." };
      }
      return {
        available: true,
        amount: data.amount,
        currency: data.currency ?? "ILS",
        source: this.sourceName,
      };
    } catch (e) {
      return { available: false, reason: `pricing parse error: ${(e as Error).message}` };
    }
  }
}

export function resolvePricingProvider(
  ctx: ProviderContext = defaultProviderContext(),
): PricingProvider {
  if (PROVIDERS.pricing.enabled && PROVIDERS.pricing.endpoint) {
    return new LicensedPricingProvider(
      PROVIDERS.pricing.endpoint,
      PROVIDERS.pricing.apiKey,
      PROVIDERS.pricing.sourceName,
      ctx,
    );
  }
  return new DisabledPricingProvider();
}
