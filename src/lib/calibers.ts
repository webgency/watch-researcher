// Typed surface for the caliber vocabulary.
//
// The table itself lives in ./calibers.mjs because scripts/audit-data.mjs runs
// under bare Node and cannot import TypeScript. This file adds the types the
// app needs and nothing else; it is the import the app should use.

import {
  CALIBER_ALIASES as ALIASES,
  CANONICAL_CALIBERS as CANONICAL,
  QUARTZ_MOVEMENTS as QUARTZ,
  isKnownCaliber as isKnownCaliberJs,
  isQuartzMovement as isQuartzMovementJs,
  normalizeCaliber as normalizeCaliberJs,
} from "./caliber-aliases.mjs";

import type { MovementType } from "./types";

/** Movement types the caliber tier scale deliberately does not rate. */
export const QUARTZ_MOVEMENTS: ReadonlySet<string> = QUARTZ;

/** Canonical caliber keys, most-specific-first. Mirrors scoring.ts's tier table. */
export const CANONICAL_CALIBERS: readonly string[] = CANONICAL;

/** Cleaned spellings that substring matching resolves wrongly or not at all. */
export const CALIBER_ALIASES: Readonly<Record<string, string>> = ALIASES;

/**
 * Canonical caliber key for a free-text caliber string.
 *
 * Returns undefined when nothing is recorded, and — deliberately — when the
 * movement is quartz: a quartz caliber has no place on a scale anchored on
 * hacking, beat rate and power reserve, so it is unrated rather than rated low.
 * An unrecognized mechanical caliber comes back as its cleaned string, so
 * "we do not know this movement" stays distinguishable from "none recorded".
 */
export function normalizeCaliber(raw?: string, movement?: MovementType | string): string | undefined {
  return normalizeCaliberJs(raw, movement);
}

/** True when the caliber resolves to a key the tier table knows. */
export function isKnownCaliber(raw?: string, movement?: MovementType | string): boolean {
  return isKnownCaliberJs(raw, movement);
}

/** True when the movement is one the tier scale deliberately does not rate. */
export function isQuartzMovement(movement?: MovementType | string): boolean {
  return isQuartzMovementJs(movement);
}
