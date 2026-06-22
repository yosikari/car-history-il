/**
 * CAPTCHA solver resolution.
 *
 * IMPORTANT: This resolves to a do-nothing `NoopCaptchaSolver` unless explicitly
 * enabled, and even when enabled it is intended ONLY for an authorized upstream
 * API that issues CAPTCHA challenges to its own paying clients. It must not be
 * used to defeat the access controls of the public Rasham HaMashkonot / gov.il
 * services — that is unauthorized access under Israel's Computer Law 5755-1995,
 * a ToS breach, and renders any retrieved lien data legally unusable.
 *
 * We deliberately do NOT bundle a turnkey 2captcha-vs-gov.il integration. A team
 * with a genuinely authorized source can implement `AuthorizedCaptchaSolver.solve`
 * against their contracted solver — at which point the responsibility for lawful
 * use sits with that explicit, deliberate wiring.
 */
import { PROVIDERS } from "../../config.js";
import { NoopCaptchaSolver, type CaptchaChallenge, type CaptchaSolver } from "./context.js";

class AuthorizedCaptchaSolver implements CaptchaSolver {
  readonly name = "authorized";
  readonly enabled = true;
  constructor(private readonly apiKey: string) {}
  async solve(_challenge: CaptchaChallenge): Promise<string | null> {
    if (!this.apiKey) return null;
    // Intentionally unimplemented. Wire your contracted solver here ONLY for an
    // authorized upstream. Throwing keeps a misconfiguration loud rather than
    // silently attempting anything against a gated public portal.
    throw new Error(
      "AuthorizedCaptchaSolver.solve is not implemented. It exists for an authorized " +
        "upstream API only and must not be pointed at gov.il access controls.",
    );
  }
}

export function resolveCaptchaSolver(): CaptchaSolver {
  if (PROVIDERS.captcha.enabled) {
    return new AuthorizedCaptchaSolver(PROVIDERS.captcha.apiKey);
  }
  return new NoopCaptchaSolver();
}
