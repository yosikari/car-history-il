import type { UnifiedVehicleReport } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Strip everything but digits — mirrors the backend's plate normalization. */
export function normalizePlate(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Fetch a unified vehicle report. Throws ApiError on 400/404/5xx. */
export async function fetchReport(plate: string): Promise<UnifiedVehicleReport> {
  const clean = normalizePlate(plate);
  const res = await fetch(`/api/vehicle/${clean}`);
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = (await res.json())?.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    const msg =
      res.status === 404
        ? "לא נמצא רכב עם מספר רישוי זה במאגר."
        : res.status === 400
          ? "מספר רישוי לא תקין."
          : "אירעה שגיאה בשליפת הנתונים. נסו שוב מאוחר יותר.";
    throw new ApiError(msg, res.status, code);
  }
  return (await res.json()) as UnifiedVehicleReport;
}

/** URL for the branded PDF download (handled by the existing backend route). */
export function pdfUrl(plate: string): string {
  return `/api/vehicle/${normalizePlate(plate)}/pdf`;
}
