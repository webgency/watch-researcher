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

/**
 * Presentation grouping for the detail view. Every SPEC_FIELDS key appears in
 * exactly one group — `specGroups()` asserts that, so adding a field without
 * placing it here is a build-time failure rather than a silently missing row.
 */
const GROUP_LAYOUT: { title: string; keys: (keyof WatchSpecs)[] }[] = [
  {
    title: "Case",
    keys: ["caseDiameterMm", "caseThicknessMm", "lugToLugMm", "lugWidthMm", "caseMaterial", "crystal"],
  },
  { title: "Movement", keys: ["movement", "caliber", "powerReserveHours", "complications"] },
  { title: "Dial & wrist", keys: ["dialColor", "braceletStrap", "waterResistanceM"] },
];

export interface SpecGroup {
  title: string;
  fields: SpecField[];
}

function specGroups(): SpecGroup[] {
  const byKey = new Map(SPEC_FIELDS.map((field) => [field.key, field]));
  const groups = GROUP_LAYOUT.map(({ title, keys }) => ({
    title,
    fields: keys.map((key) => {
      const field = byKey.get(key);
      if (!field) throw new Error(`Spec group "${title}" references unknown field "${key}"`);
      return field;
    }),
  }));

  const placed = new Set(GROUP_LAYOUT.flatMap((group) => group.keys));
  const orphans = SPEC_FIELDS.filter((field) => !placed.has(field.key));
  if (orphans.length > 0) {
    throw new Error(`Spec fields missing from GROUP_LAYOUT: ${orphans.map((f) => f.key).join(", ")}`);
  }
  return groups;
}

export const SPEC_GROUPS: SpecGroup[] = specGroups();

export function formatSpecValue(field: SpecField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.unit) return `${value} ${field.unit}`;
  return String(value);
}
