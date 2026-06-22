/** Input validation for the request layer. */
import { z } from "zod";

/**
 * Israeli plates are 5–8 digits. We accept any human formatting (dashes,
 * spaces) and reduce to digits, then range-check the length.
 */
export const reportRequestSchema = z.object({
  plate: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s.length >= 5 && s.length <= 8, {
      message: "Plate must be 5–8 digits after stripping non-digits.",
    }),
  /** Optional — only used by the lien provider when enabled. */
  ownerId: z.string().transform((s) => s.replace(/\D/g, "")).optional(),
  ownershipDate: z.string().optional(),
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

export function parsePlate(input: string): number {
  const digits = input.replace(/\D/g, "");
  return Number(digits);
}
