// Relational plausibility rules for watch specs, in one place.
//
// spec-ranges.mjs bounds each measurement on its own. These rules bound them
// against each other, which is where the real corruption showed up: every bad
// value the collection has carried was individually in range and only wrong
// next to its neighbours. A case diameter overwritten with the thickness (15mm
// wide, 15.5mm thick), a diameter overwritten with the lug-to-lug (45.5 and
// 45.5), a lug-to-lug duplicated from the diameter.
//
// Plain .mjs so scripts/validate-data.mjs can import it under bare Node;
// validation.ts wraps it for the write path.
//
// Two severities, because they are used differently:
//   error — a value that cannot be right. Fails npm run validate:data.
//   warn  — a value that is unlikely but possible. Reported, never fatal, so a
//           legitimate outlier is not unfixable and the add form still accepts
//           a partial record while the user is still typing.

import { LUG_TO_LUG_MIN_RATIO } from "./spec-ranges.mjs";

const num = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Thickness that a case cannot plausibly exceed as a share of its width.
 * The collection's thickest legitimate case is the Sinn-style 13.8 on 41
 * (0.337); 0.42 leaves room for a genuinely chunky diver without admitting
 * the 20-on-39 that a scrape once produced.
 */
export const MAX_THICKNESS_RATIO = 0.42;

/**
 * Lug-to-lug beyond this multiple of the diameter means one of the two is
 * wrong. Long-lugged divers reach about 1.25; 1.45 is well clear of them.
 */
export const MAX_LUG_TO_LUG_RATIO = 1.45;

/** Diameters outside this band are possible but worth a second look. */
export const LIKELY_DIAMETER_MM = [25, 46];

/** Power reserves outside this band are possible but worth a second look. */
export const LIKELY_POWER_RESERVE_HOURS = [20, 200];

/**
 * Caliber strings carrying these phrases are scraper spill, not a caliber —
 * "3 produced by Sellita based on" came in as a caliber once.
 */
const CALIBER_GARBAGE = /based on|produced by/i;

/**
 * Length past which a caliber string is probably prose. A warning, never an
 * error: "Co-Axial Master Chronometer 8800" is 32 characters and correct, and
 * so are four other real calibers in the collection.
 */
export const LIKELY_CALIBER_MAX_LENGTH = 28;

/**
 * Each rule applies only when its own inputs are present, so a record holding
 * nothing but a brand and a model trips none of them. Missing stays missing.
 */
export const PLAUSIBILITY_RULES = [
  {
    id: "thickness-under-diameter",
    severity: "error",
    applies: (s) => num(s.caseDiameterMm) && num(s.caseThicknessMm),
    check: (s) => s.caseThicknessMm < s.caseDiameterMm,
    message: (s) =>
      `caseThicknessMm ${s.caseThicknessMm} at or above caseDiameterMm ${s.caseDiameterMm}; one of them is a misread`,
  },
  {
    id: "thickness-ratio",
    severity: "error",
    applies: (s) => num(s.caseDiameterMm) && num(s.caseThicknessMm) && s.caseDiameterMm > 0,
    check: (s) => s.caseThicknessMm / s.caseDiameterMm <= MAX_THICKNESS_RATIO,
    message: (s) =>
      `caseThicknessMm ${s.caseThicknessMm} is ${(s.caseThicknessMm / s.caseDiameterMm).toFixed(2)} of caseDiameterMm ${s.caseDiameterMm}, over ${MAX_THICKNESS_RATIO}`,
  },
  {
    // The spec proposed lugToLug > caseDiameterMm outright. That is wrong for
    // this collection: cushion and rectangular cases legitimately measure the
    // same or less across the lugs than across the case — the Echo/Neutra
    // Rivanera is 40mm wide and 40mm lug-to-lug per the manufacturer, and the
    // Dennison ALD is 37mm wide and 35.6mm. The ratio floor catches a swap
    // without condemning them.
    id: "lug-to-lug-floor",
    severity: "error",
    applies: (s) => num(s.caseDiameterMm) && num(s.lugToLugMm),
    check: (s) => s.lugToLugMm >= s.caseDiameterMm * LUG_TO_LUG_MIN_RATIO,
    message: (s) =>
      `lugToLugMm ${s.lugToLugMm} well under caseDiameterMm ${s.caseDiameterMm}; the two are probably swapped`,
  },
  {
    id: "lug-to-lug-ceiling",
    severity: "error",
    applies: (s) => num(s.caseDiameterMm) && num(s.lugToLugMm),
    check: (s) => s.lugToLugMm <= s.caseDiameterMm * MAX_LUG_TO_LUG_RATIO,
    message: (s) =>
      `lugToLugMm ${s.lugToLugMm} is over ${MAX_LUG_TO_LUG_RATIO}x caseDiameterMm ${s.caseDiameterMm}`,
  },
  {
    id: "lug-width-under-diameter",
    severity: "error",
    applies: (s) => num(s.caseDiameterMm) && num(s.lugWidthMm),
    check: (s) => s.lugWidthMm < s.caseDiameterMm,
    message: (s) => `lugWidthMm ${s.lugWidthMm} at or above caseDiameterMm ${s.caseDiameterMm}`,
  },
  {
    id: "caliber-garbage",
    severity: "error",
    applies: (s) => typeof s.caliber === "string" && s.caliber.length > 0,
    check: (s) => !CALIBER_GARBAGE.test(s.caliber),
    message: (s) => `caliber ${JSON.stringify(s.caliber)} reads as scraped prose, not a caliber`,
  },
  {
    // Exactly equal is how both duplicated-field bugs presented. It is also
    // how the Rivanera legitimately measures, so this can only ever warn —
    // but it is the one signal that would have caught the Venezianico Nereide
    // being recorded at its lug-to-lug of 45.5mm instead of its 39mm case.
    id: "lug-to-lug-equals-diameter",
    severity: "warn",
    applies: (s) => num(s.caseDiameterMm) && num(s.lugToLugMm),
    check: (s) => s.lugToLugMm !== s.caseDiameterMm,
    message: (s) =>
      `lugToLugMm equals caseDiameterMm exactly (${s.caseDiameterMm}); check it is not a duplicated field`,
  },
  {
    id: "diameter-band",
    severity: "warn",
    applies: (s) => num(s.caseDiameterMm),
    check: (s) => s.caseDiameterMm >= LIKELY_DIAMETER_MM[0] && s.caseDiameterMm <= LIKELY_DIAMETER_MM[1],
    message: (s) =>
      `caseDiameterMm ${s.caseDiameterMm} is outside the usual ${LIKELY_DIAMETER_MM[0]}-${LIKELY_DIAMETER_MM[1]}mm`,
  },
  {
    id: "power-reserve-band",
    severity: "warn",
    applies: (s) => num(s.powerReserveHours),
    check: (s) =>
      s.powerReserveHours >= LIKELY_POWER_RESERVE_HOURS[0] &&
      s.powerReserveHours <= LIKELY_POWER_RESERVE_HOURS[1],
    message: (s) =>
      `powerReserveHours ${s.powerReserveHours} is outside the usual ${LIKELY_POWER_RESERVE_HOURS[0]}-${LIKELY_POWER_RESERVE_HOURS[1]}h`,
  },
  {
    id: "caliber-length",
    severity: "warn",
    applies: (s) => typeof s.caliber === "string" && s.caliber.length > 0,
    check: (s) => s.caliber.length <= LIKELY_CALIBER_MAX_LENGTH,
    message: (s) => `caliber ${JSON.stringify(s.caliber)} is unusually long for a caliber name`,
  },
];

/**
 * Every rule the specs break, as { id, severity, message }. Empty for a record
 * with nothing recorded.
 */
export function plausibilityIssues(specs) {
  if (!specs || typeof specs !== "object") return [];
  return PLAUSIBILITY_RULES.filter((rule) => rule.applies(specs) && !rule.check(specs)).map((rule) => ({
    id: rule.id,
    severity: rule.severity,
    message: rule.message(specs),
  }));
}

/** Only the issues that cannot be right. These fail npm run validate:data. */
export function plausibilityErrors(specs) {
  return plausibilityIssues(specs).filter((issue) => issue.severity === "error");
}

/** Only the issues that are unlikely but possible. Never fatal. */
export function plausibilityWarnings(specs) {
  return plausibilityIssues(specs).filter((issue) => issue.severity === "warn");
}
