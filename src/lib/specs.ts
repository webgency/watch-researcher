import { Dimension } from "./rubrics";
import { MOVEMENT_TYPES, QualityFlags, WatchSpecs } from "./types";

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

export interface QualityFlagField {
  key: keyof QualityFlags;
  label: string;
  unit?: string;
  /**
   * "boolean" fields are tri-state on purpose — see QUALITY_FLAG_UNSET. A
   * plain checkbox cannot express the difference the scoring engine cares
   * about most, between "not recorded" and "recorded as absent".
   */
  type: "number" | "boolean";
  /**
   * Which dimension the flag feeds, or undefined for flags that are recorded
   * but not scored. Grouping the form by this is the point of the section: a
   * dimension whose flags are all blank stays unrated, and the entry form is
   * where that becomes a visible choice rather than a silent omission.
   */
  dimension?: Dimension;
  hint?: string;
}

/** Sentinel for a tri-state flag left unrecorded. Never written to the store. */
export const QUALITY_FLAG_UNSET = "";

// Single source of truth for quality flags, same contract as SPEC_FIELDS.
// Ordered by the dimension each one feeds so the form can group them and show
// which dimensions a watch is on track to leave unrated.
export const QUALITY_FLAG_FIELDS: QualityFlagField[] = [
  {
    key: "regulatedPositions",
    label: "Regulated positions",
    type: "number",
    dimension: "movement",
    hint: "0 or blank = unregulated.",
  },
  { key: "hardenedCoatingHv", label: "Surface hardening", unit: "HV", type: "number", dimension: "caseCraft" },
  { key: "sapphireBezelInsert", label: "Sapphire bezel insert", type: "boolean", dimension: "caseCraft" },
  { key: "drilledLugs", label: "Drilled lugs", type: "boolean", dimension: "caseCraft" },
  { key: "arLayers", label: "AR coating layers", type: "number", dimension: "caseCraft" },
  {
    key: "braceletIncluded",
    label: "Bracelet included",
    type: "boolean",
    dimension: "bracelet",
    // "No" is not a bad bracelet, it means there is none to judge, and
    // scoreDimensions drops the dimension entirely rather than scoring 0.
    hint: 'Set "No" for a strap-only watch — the dimension goes unrated, not zero.',
  },
  { key: "microAdjustClasp", label: "Micro-adjust clasp", type: "boolean", dimension: "bracelet" },
  { key: "quickRelease", label: "Quick-release", type: "boolean", dimension: "bracelet" },
  { key: "antimagneticAm", label: "Antimagnetic", unit: "A/m", type: "number", dimension: "durability" },
  {
    key: "accuracySpecSpd",
    label: "Accuracy spec",
    unit: "s/d",
    type: "number",
    hint: "Recorded for reference; no dimension reads it.",
  },
];

export function formatSpecValue(field: SpecField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.unit) return `${value} ${field.unit}`;
  return String(value);
}
