import { MOVEMENT_TYPES, WatchSpecs } from "./types";

export interface SpecField {
  key: keyof WatchSpecs;
  label: string;
  unit?: string;
  type: "number" | "text" | "select";
  options?: readonly string[];
  /** For comparison highlighting: is a higher or lower value generally "better"? */
  prefer?: "higher" | "lower";
}

// Single source of truth for spec fields — drives the entry form, the detail
// view, and the comparison table. Add a field here and it shows up everywhere.
export const SPEC_FIELDS: SpecField[] = [
  { key: "caseDiameterMm", label: "Case diameter", unit: "mm", type: "number" },
  { key: "caseThicknessMm", label: "Thickness", unit: "mm", type: "number", prefer: "lower" },
  { key: "lugToLugMm", label: "Lug-to-lug", unit: "mm", type: "number" },
  { key: "lugWidthMm", label: "Lug width", unit: "mm", type: "number" },
  { key: "caseMaterial", label: "Case material", type: "text" },
  { key: "movement", label: "Movement", type: "select", options: MOVEMENT_TYPES },
  { key: "caliber", label: "Caliber", type: "text" },
  { key: "powerReserveHours", label: "Power reserve", unit: "h", type: "number", prefer: "higher" },
  { key: "waterResistanceM", label: "Water resistance", unit: "m", type: "number", prefer: "higher" },
  { key: "crystal", label: "Crystal", type: "text" },
  { key: "dialColor", label: "Dial", type: "text" },
  { key: "braceletStrap", label: "Bracelet / strap", type: "text" },
  { key: "complications", label: "Complications", type: "text" },
];

export function formatSpecValue(field: SpecField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.unit) return `${value} ${field.unit}`;
  return String(value);
}
