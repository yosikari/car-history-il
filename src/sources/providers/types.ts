/**
 * Pluggable provider contracts for data that has NO free public source in
 * Israel: liens (Rasham HaMashkonot — paid, CAPTCHA-gated) and accident
 * records (no public crash-by-plate database).
 *
 * The golden rule: a provider that cannot retrieve real data returns
 * `{ available: false }`. It MUST NOT fabricate a "clean" result. The report
 * then truthfully shows "unavailable" rather than implying "no liens found".
 */

export interface LienQuery {
  plate: string;
  /** Owner national ID / company number — required by the real registry. */
  ownerId?: string;
  /** Ownership-since date, used by some lien services as a secondary key. */
  ownershipDate?: string;
}

export interface LienProviderResult {
  available: boolean;
  hasLien?: boolean;
  liens?: Array<{ holder: string | null; date: string | null; amount: number | null }>;
  /** Why it's unavailable, surfaced to the report. */
  reason?: string;
  /**
   * Optional honest, sourced statement to show INSTEAD of a blank "N/A" when the
   * result is unavailable. Replaces the passive gap with an explanation. The
   * provider supplies its own text; provenance stays truthful.
   */
  assessmentStatement?: string;
  assessmentBasis?: string;
}

export interface LienProvider {
  readonly name: string;
  check(query: LienQuery): Promise<LienProviderResult>;
}

export interface AccidentQuery {
  plate: string;
}

export interface AccidentProviderResult {
  available: boolean;
  records?: Array<{ date: string | null; severity: string | null; description: string | null }>;
  reason?: string;
  /** See LienProviderResult.assessmentStatement. */
  assessmentStatement?: string;
  assessmentBasis?: string;
}

export interface AccidentProvider {
  readonly name: string;
  history(query: AccidentQuery): Promise<AccidentProviderResult>;
}

/** Inputs a pricing provider needs to value a specific vehicle. */
export interface PricingQuery {
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  engineCc: number | null;
  fuelType: string | null;
}

export interface PricingProviderResult {
  available: boolean;
  /** Authoritative price from a licensed source (e.g. Levi Yitzhak). */
  amount?: number;
  currency?: string;
  /** Provenance shown to the user (the licensed source's name). */
  source?: string;
  reason?: string;
}

export interface PricingProvider {
  readonly name: string;
  price(query: PricingQuery): Promise<PricingProviderResult>;
}
