/**
 * Accident provider resolution — constructed via dependency injection.
 *
 * Israel has no public accident-by-plate database. The report's honest accident
 * signal comes from DERIVED risk indicators (computed in the normalizer from
 * real registry data). This provider is the slot for an actual records source
 * (an insurer/aggregator feed) accessed via an injected `ProviderContext`.
 * Disabled by default; never fabricates.
 */
import { PROVIDERS } from "../../config.js";
import { defaultProviderContext, type ProviderContext } from "./context.js";
import type { AccidentProvider, AccidentProviderResult, AccidentQuery } from "./types.js";

/** Contract for an authorized accident-records source. */
export interface AccidentVerificationService {
  readonly name: string;
  verify(query: AccidentQuery): Promise<AccidentProviderResult>;
}

class DisabledAccidentProvider implements AccidentProvider {
  readonly name = "disabled";
  async history(_query: AccidentQuery): Promise<AccidentProviderResult> {
    return {
      available: false,
      reason:
        "No accident-record source configured. Israel has no public crash-by-plate " +
        "database; see derived risk indicators for honest signals from registry data.",
    };
  }
}

class VerifiedAccidentProvider implements AccidentProvider {
  readonly name = "verified-source";
  constructor(
    private readonly service: AccidentVerificationService,
    private readonly ctx: ProviderContext,
  ) {}
  async history(query: AccidentQuery): Promise<AccidentProviderResult> {
    return this.service.verify(query);
  }
}

class SourceAccidentService implements AccidentVerificationService {
  readonly name = "source-api";
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly ctx: ProviderContext,
  ) {}
  async verify(query: AccidentQuery): Promise<AccidentProviderResult> {
    if (!this.endpoint || !this.apiKey) {
      return { available: false, reason: "ACCIDENT_VERIFY_ENDPOINT / ACCIDENT_PROVIDER_API_KEY missing." };
    }
    const url = `${this.endpoint}?plate=${encodeURIComponent(query.plate)}`;
    const res = await this.ctx.fetcher.fetchHtml(url, {
      enabled: true, // authorized endpoint
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
    });
    if (!res.ok || !res.html) {
      return { available: false, reason: `source unavailable: ${res.reason ?? "no body"}` };
    }
    try {
      const data = JSON.parse(res.html) as { records?: AccidentProviderResult["records"] };
      return { available: true, records: data.records ?? [] };
    } catch (e) {
      return { available: false, reason: `source parse error: ${(e as Error).message}` };
    }
  }
}

export function resolveAccidentProvider(
  ctx: ProviderContext = defaultProviderContext(),
): AccidentProvider {
  if (PROVIDERS.accident.enabled && PROVIDERS.accident.verifyEndpoint) {
    const service = new SourceAccidentService(
      PROVIDERS.accident.verifyEndpoint,
      PROVIDERS.accident.apiKey,
      ctx,
    );
    return new VerifiedAccidentProvider(service, ctx);
  }
  return new DisabledAccidentProvider();
}
