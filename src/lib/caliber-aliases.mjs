// Caliber vocabulary: how a free-text caliber string becomes a canonical key.
//
// Plain .mjs for the same reason as spec-ranges.mjs: three consumers need the
// same table and one of them, scripts/audit-data.mjs, runs under bare Node with
// no build step. src/lib/calibers.ts re-exports these with types for the app.
//
// The basename differs from calibers.ts on purpose: same-basename twins make
// an extensionless "./calibers" import resolve to whichever the bundler
// prefers, which is how the typed surface got silently bypassed once already.
//
// This module owns *naming* only — which movements the collection knows how to
// identify. What a caliber is worth stays in CALIBER_TIER_PATTERNS in
// scoring.ts. calibers.test.ts asserts the two agree, so a key added here
// without a tier there fails the suite rather than silently going unrated.

/**
 * Movement types for which a caliber tier is meaningless, so the movement
 * dimension is deliberately unrated rather than scored low.
 *
 * The tier scale is anchored on hacking, beat rate and power reserve. A quartz
 * movement has no position on it, and placing one there makes it read as a bad
 * automatic rather than as what it is. This collection is an automatic
 * collection; quartz appears only for exceptional pieces, where the reason to
 * own one is never the movement.
 */
export const QUARTZ_MOVEMENTS = new Set(["quartz", "solar", "kinetic", "meca-quartz"]);

/**
 * Canonical caliber keys, most-specific-first — the same strings and the same
 * ordering as CALIBER_TIER_PATTERNS in scoring.ts. Order matters: "sw200-1"
 * must be tested before "sw200", or every SW200-1 resolves to the plain SW200.
 */
export const CANONICAL_CALIBERS = [
  "co-axial master chronometer 8800",
  "3285",
  "mt5450",
  "m100",
  "alb01 a",
  "mu 9419",
  "sw510",
  "l688",
  "st-1901b",
  "soprod c125",
  "l888",
  "sw300",
  "sw330",
  "ne88",
  "ne86",
  "la joux-perret",
  "miyota 9075",
  "powermatic 80",
  "rw3230",
  "peseux 7001",
  "7001",
  "miyota 9100",
  "sw200-1",
  "sw200",
  "miyota 9015",
  "miyota 9039",
  "9039",
  "france ebauche",
  "ot.g102",
  "st1721",
  "miyota 8215",
  "nh38",
  "nh34",
  "nh35",
  "meca-quartz",
  "fc-206",
  "ronda 1032",
];

/**
 * Spellings pinned to a canonical key explicitly.
 *
 * The substring pass below already reaches the caliber number inside a vendor
 * prefix ("Seiko NH35") or a grade suffix ("Sellita SW510 BH M"), so most
 * strings need no entry. These are listed anyway because they are the ones
 * whose grade letters read like part of the caliber number: pinning them means
 * reordering CANONICAL_CALIBERS later cannot quietly re-point them.
 *
 * Keys are matched against both the raw lowercased string and the cleaned one,
 * so "Sellita SW200-1 (COSC)" is found under "sellita sw200-1".
 */
export const CALIBER_ALIASES = {
  // "SW510 BH M" and "SW510 M b" are the same hand-wound chronograph as
  // "SW510-M"; the letters are the execution grade, not a different caliber.
  "sellita sw510 bh m": "sw510",
  "sellita sw510 m b": "sw510",
  "sellita sw510 m bh b": "sw510",
  "sellita sw510-m": "sw510",
  "sellita sw510": "sw510",
  // Soprod's C125 is only sold as a GMT; the collection records it both ways.
  "soprod c125 gmt": "soprod c125",
  "bespoke st-1901b seagull": "st-1901b",
  "seagull st1721": "st1721",
};

/**
 * Canonical caliber key for a free-text caliber string, or undefined when the
 * movement is quartz or nothing is recorded.
 *
 * Matching runs against the full string before the cleaned one. Parentheticals
 * are usually noise ("(COSC)", "(reworked)") but not always — "Laventure
 * Caliber 3 (Sellita SW330-2)" carries the only identifying part of the
 * caliber inside the brackets, so stripping first would lose it.
 *
 * Returns the cleaned string unchanged when no canonical key matches, so an
 * unrecognized caliber stays visible to the audit as "unknown caliber" rather
 * than collapsing into the same undefined as "no caliber recorded".
 */
export function normalizeCaliber(raw, movement) {
  if (movement && QUARTZ_MOVEMENTS.has(String(movement).toLowerCase().trim())) return undefined;
  if (!raw) return undefined;

  const full = String(raw).toLowerCase().replace(/\s+/g, " ").trim();
  const cleaned = full
    .replace(/\([^)]*\)/g, "") // "(COSC)", "(reworked)", "(automatic)"
    .replace(/[,;].*$/, "") // trailing prose: "3285, Manufacture Rolex"
    .replace(/\s+/g, " ")
    .trim();
  if (!full) return undefined;

  const alias = CALIBER_ALIASES[cleaned] ?? CALIBER_ALIASES[full];
  if (alias) return alias;

  const match =
    CANONICAL_CALIBERS.find((key) => full.includes(key)) ??
    CANONICAL_CALIBERS.find((key) => cleaned.includes(key));
  return match ?? cleaned ?? undefined;
}

/** True when the caliber resolves to a key the tier table knows. */
export function isKnownCaliber(raw, movement) {
  const key = normalizeCaliber(raw, movement);
  return key !== undefined && CANONICAL_CALIBERS.includes(key);
}

/** True when the movement is one the tier scale deliberately does not rate. */
export function isQuartzMovement(movement) {
  return Boolean(movement) && QUARTZ_MOVEMENTS.has(String(movement).toLowerCase().trim());
}
