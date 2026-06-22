/**
 * Provider dependency-injection context.
 *
 * Every provider (lien, accident, future sources) is constructed with a single
 * `ProviderContext` carrying its shared dependencies, so swapping an HTTP client
 * or plugging in an authorized verification service changes nothing upstream.
 *
 * On "CAPTCHA solving": the interface below exists so that an AUTHORIZED,
 * contracted data source which legitimately issues CAPTCHA challenges to its own
 * paying API clients can be served. It is NOT a tool for defeating the access
 * controls of the public Rasham HaMashkonot / gov.il portals — doing that is
 * unauthorized access under Israel's Computer Law 5755-1995 and a ToS breach,
 * and it makes the resulting lien data legally unusable in a sold report. Ships
 * with NO implementation; resolves to a NoopCaptchaSolver that does nothing.
 */
import { resilientFetcher, type ResilientFetcher } from "./resilientFetcher.js";

/** A CAPTCHA challenge surfaced by an authorized upstream API. */
export interface CaptchaChallenge {
  kind: "recaptcha-v2" | "hcaptcha" | "image";
  siteKey?: string;
  /** The page/endpoint the challenge is bound to. */
  pageUrl?: string;
  imageBase64?: string;
}

export interface CaptchaSolver {
  readonly name: string;
  readonly enabled: boolean;
  /** Returns a solution token, or null if it cannot/should not solve. */
  solve(challenge: CaptchaChallenge): Promise<string | null>;
}

/**
 * Default solver: does nothing. Present so providers can depend on the interface
 * without a real solver being configured. We deliberately do NOT ship a
 * 2captcha implementation pointed at government portals (see file header).
 */
export class NoopCaptchaSolver implements CaptchaSolver {
  readonly name = "noop";
  readonly enabled = false;
  async solve(_challenge: CaptchaChallenge): Promise<string | null> {
    return null;
  }
}

export interface ProviderContext {
  /** Resilient HTML transport (rotating UA / retry / optional headless render). */
  fetcher: ResilientFetcher;
  /** CAPTCHA solver for AUTHORIZED upstreams only. Disabled by default. */
  captcha: CaptchaSolver;
}

/** Build the default context. Override pieces in tests or when wiring a source. */
export function defaultProviderContext(overrides: Partial<ProviderContext> = {}): ProviderContext {
  return {
    fetcher: resilientFetcher,
    captcha: new NoopCaptchaSolver(),
    ...overrides,
  };
}
