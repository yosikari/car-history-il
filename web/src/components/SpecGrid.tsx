import { ReportCard, DataRow } from "./ReportCard";
import type { VehicleSpecs } from "../types";

export function SpecGrid({ specs }: { specs: VehicleSpecs }) {
  const gearbox =
    specs.gearbox === "automatic" ? "אוטומט" : specs.gearbox === "manual" ? "ידני" : null;
  return (
    <ReportCard icon="car" title="מפרט הרכב" subtitle="נתוני רישום ומנוע" meta={specs.meta}>
      <dl className="grid gap-x-10 sm:grid-cols-2">
        <DataRow label="יצרן" value={specs.make} />
        <DataRow label="דגם" value={specs.model} />
        <DataRow label="כינוי מסחרי" value={specs.commercialName} />
        <DataRow label="רמת גימור" value={specs.trimLevel} />
        <DataRow label="שנת ייצור" value={specs.year} />
        <DataRow label="סוג דלק" value={specs.fuelType} />
        <DataRow label="דגם מנוע" value={specs.engineModel} />
        <DataRow label='נפח מנוע (סמ"ק)' value={specs.engineDisplacementCc} />
        <DataRow label="כוח סוס" value={specs.horsepower} />
        <DataRow label="תיבת הילוכים" value={gearbox} />
        <DataRow label="מספר מושבים" value={specs.seats} />
        <DataRow label="הנעה" value={specs.drivetrain} />
        <DataRow label="טכנולוגיית הנעה" value={specs.powertrainTech} />
        <DataRow label="צבע" value={specs.color} />
        <DataRow label="מספר שלדה" value={specs.frameNumber} />
        <DataRow label='משקל כולל (ק"ג)' value={specs.totalWeightKg} />
        <DataRow label='כושר גרירה עם בלמים (ק"ג)' value={specs.towingBrakedKg} />
      </dl>
    </ReportCard>
  );
}
