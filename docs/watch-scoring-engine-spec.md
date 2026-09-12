# Watch Researcher: Evaluation Engine Redesign

Design rationale and Phase 1 implementation brief.

> **Historical document, written 2026-08-13, before the engine existed.** Kept
> for the argument in "Why the current matrix is the wrong shape" and "Target
> design" — that reasoning is why `scoring.ts` and `rubrics.ts` have the shape
> they do, and the three invariants in CLAUDE.md are its short form. The design
> shipped as specified: five dimensions, absolute rubric par, landed price,
> friction never scored.
>
> It is **not** a description of the code as it stands. Everything from "Phase 1
> scope" onward is the brief as written at the time, and the reference sketch in
> particular has diverged — read the source for current behaviour.

---

## Why the current matrix is the wrong shape

The two-axis matrix (objective value, subjective desirability) produces a single
composite score per watch. Three problems:

**1. The scale is global, not peer-relative.** "Good value" only means something
against a comparison set. A 200m diver at $780 should be judged against other
200m divers at $600-900, not against a $7,100 Seamaster. On a global scale the
$278 Sheffield always looks like a genius buy and the Omega always looks like a
mistake. Both true, both useless.

**2. A composite destroys the attribute deltas.** The useful part of any
comparison is the handful of specs where two watches actually diverge, with the
fifteen identical ones suppressed. "Three millimeters thinner, regulated,
hardened coating, micro-adjust clasp" is a decision. "7.4" is not.

**3. The deciding factors often are not specs.** Availability, pre-order lead
time, whether the bracelet is a paid upcharge, and resale liquidity routinely
flip a recommendation. A watch can win the spec sheet and lose the decision. If
the model cannot hold non-spec disqualifiers, it will produce confident wrong
answers.

---

## Target design

### Five dimensions instead of one objective axis

`movement`, `caseCraft`, `wearability`, `durability`, `bracelet`. Each scored
0-1. The composite still exists to drive the 2x2, but the five sub-scores are
what gets displayed.

### Fixed rubrics, not percentiles

The original design scored each dimension as a percentile within a peer group.
**Do not do this.** With 36 watches split by category and price band, most peer
groups have 2-4 members. A percentile over n=3 is noise dressed as precision and
will swing every time a watch is added.

Instead: score each dimension against a **fixed rubric** defined per category
and price band. What counts as good movement, case craft, and so on for a diver
at $500-1000 is hardcoded reference data. This works from the first watch, is
stable across additions, and is more defensible.

Peer groups survive, but only for:

- the display context label ("divers, $500-1000")
- filtering the 2x2 view
- optional percentile ranking, used **only** when a group has n >= 6

### Landed price, not list price

`price` is insufficient. Add a computed `landedPrice`: base configuration, plus
bracelet or strap delta, plus shipping and duty. A watch listed at $776 with a
$189 bracelet upcharge is not cheaper than one listed at $790 all-in.

### Friction flags, never scored

Availability state, expected ship date, bracelet upcharge, brand liquidity.
These gate the verdict as displayed chips. They are never folded into a numeric
score and never averaged with anything.

### Wearability as thickness-to-diameter ratio

Absolute thickness is misleading across diameters. Ratio is the honest proxy for
how a watch wears. Roughly 0.26 is excellent, 0.36 is chunky. This also gives a
systematic answer to case-size questions instead of a gut call.

---

## Phase 1 scope: scoring engine only

No UI changes. Pure functions, no I/O.

### Files

| File | Action |
| --- | --- |
| `src/lib/types.ts` | Add `QualityFlags`, `Friction`, `landedPrice` to `Watch`. All optional. Existing data must remain valid. |
| `src/lib/rubrics.ts` | New. Category plus price-band reference values for the five dimensions. |
| `src/lib/scoring.ts` | New. `scoreDimensions()`, `computeStanding()`, peer group derivation. |
| `src/lib/validation.ts` | Extend to cover new fields. |
| tests | Unit tests for `scoring.ts`. |

### Do not change

The JSON store, the API routes, or any component.

### Test cases required

- watch with missing specs
- unknown caliber
- watch with no tags
- peer group of size 1

---

## Constraints

**Unknown calibers must not silently default to a mid value.** Return
`undefined` for the movement dimension, exclude it from the composite, and
surface "movement unrated". Do not fabricate 0.5.

**Missing specs propagate as `undefined`, never as zero.** A watch with no
recorded thickness should score *nothing* on wearability, not score badly.

**Friction flags never enter any numeric score.**

---

## Reference implementation sketch

> **Superseded — do not read as API documentation.** This sketch is what was
> proposed in August; the shipped engine went further. `CALIBER_TIER` here is a
> `Record`, but the real `CALIBER_TIER_PATTERNS` is an ordered array matched
> most-specific-first by substring. The sketch also predates design-appeal Elo,
> currency normalization, evidence coverage, and the calibration harness. It is
> preserved to show the starting point, not the destination.

Adapt as needed. The rubric lookup replaces the percentile call in
`scoreDimensions`; the shapes below are the contract.

```ts
// src/lib/scoring.ts
import type { Watch } from "./types";

export type Dimension =
  | "movement"
  | "caseCraft"
  | "wearability"
  | "durability"
  | "bracelet";

// Caliber quality tiers. Extend as watches are added.
// Unknown calibers return undefined, they do NOT fall back to a mid value.
const CALIBER_TIER: Record<string, number> = {
  "nh35": 0.30, "nh34": 0.32, "nh38": 0.35,
  "miyota 9015": 0.55, "miyota 9039": 0.55, "9039": 0.55, "miyota 9075": 0.62,
  "st-1901b": 0.70, "sellita sw200-1": 0.58, "sellita sw510-m": 0.72,
  "soprod c125 gmt": 0.68, "powermatic 80": 0.60,
  "m100": 0.80, "co-axial master chronometer 8800": 0.95,
};

// Fitness for purpose, not raw maximums, so a 50m dress watch is not
// penalised for failing to be a diver.
const CATEGORY_EXPECTATION = {
  diver:       { wrM: 200, needsBezel: true,  needsScrewCrown: true },
  chronograph: { wrM: 50,  needsBezel: false, needsScrewCrown: false },
  gmt:         { wrM: 100, needsBezel: false, needsScrewCrown: false },
  dress:       { wrM: 30,  needsBezel: false, needsScrewCrown: false },
} as const;

export interface QualityFlags {
  regulatedPositions?: number;   // 0 or absent = unregulated
  accuracySpecSpd?: number;      // e.g. 12 for +/-12s/d
  hardenedCoatingHv?: number;    // e.g. 1000
  antimagneticAm?: number;       // e.g. 25000
  sapphireBezelInsert?: boolean;
  drilledLugs?: boolean;
  microAdjustClasp?: boolean;
  quickRelease?: boolean;
  braceletIncluded?: boolean;
  arLayers?: number;
}

export interface Friction {
  availability: "in-stock" | "pre-order" | "sold-out" | "discontinued";
  expectedShipDate?: string;         // ISO, for pre-orders
  braceletUpchargeUsd?: number;
  brandLiquidity: 1 | 2 | 3 | 4 | 5; // 5 = established secondary market
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Any dimension lacking source data returns undefined, not a number. */
export function scoreDimensions(
  w: Watch
): Partial<Record<Dimension, number>> {
  const s = w.specs ?? {};
  const f: QualityFlags = w.qualityFlags ?? {};
  const cat = (w.tags?.[0] ?? "dress") as keyof typeof CATEGORY_EXPECTATION;
  const exp = CATEGORY_EXPECTATION[cat] ?? CATEGORY_EXPECTATION.dress;

  const out: Partial<Record<Dimension, number>> = {};

  const caliberKey = (s.caliber ?? "").toLowerCase().trim();
  const caliberBase = CALIBER_TIER[caliberKey];
  if (caliberBase !== undefined) {
    // Regulation is expensive and almost nobody at this price point does it.
    const regBonus = f.regulatedPositions
      ? Math.min(0.2, f.regulatedPositions * 0.05)
      : 0;
    const prBonus =
      s.powerReserveHours !== undefined
        ? clamp01((s.powerReserveHours - 38) / 42) * 0.1
        : 0;
    out.movement = clamp01(caliberBase + regBonus + prBonus);
  }

  if (s.caseDiameterMm !== undefined && s.caseThicknessMm !== undefined) {
    const ratio = s.caseThicknessMm / s.caseDiameterMm;
    out.wearability = clamp01((0.36 - ratio) / 0.10);
  }

  if (Object.keys(f).length > 0) {
    out.caseCraft = clamp01(
      0.35 +
        (f.hardenedCoatingHv ? 0.2 : 0) +
        (f.sapphireBezelInsert ? 0.15 : 0) +
        (f.drilledLugs ? 0.1 : 0) +
        (Math.min(f.arLayers ?? 0, 8) / 8) * 0.2
    );
    out.bracelet = clamp01(
      (f.braceletIncluded ? 0.4 : 0) +
        (f.microAdjustClasp ? 0.35 : 0) +
        (f.quickRelease ? 0.25 : 0)
    );
  }

  if (s.waterResistanceM !== undefined) {
    out.durability = clamp01(
      0.5 * clamp01(s.waterResistanceM / exp.wrM) +
        0.25 * ((s.crystal ?? "").toLowerCase().includes("sapphire") ? 1 : 0) +
        0.25 * clamp01((f.antimagneticAm ?? 0) / 25000)
    );
  }

  return out;
}

/** Percentile within pool (0-1). Use ONLY when pool.length >= 6. */
export function percentile(value: number, pool: number[]): number | undefined {
  if (pool.length < 6) return undefined;
  const below = pool.filter((p) => p < value).length;
  return below / (pool.length - 1);
}

export interface Standing {
  peerLabel: string;      // "divers, $500-1000"
  peerCount: number;
  dimensions: Partial<Record<Dimension, { raw: number; rubricBand: string }>>;
  unrated: Dimension[];   // missing source data
  qualityScore: number;   // composite of rated dimensions only
  valueScore: number;     // quality relative to landedPrice within band
  beats: Dimension[];     // above rubric reference for the band
  trails: Dimension[];    // below rubric reference for the band
  frictions: string[];    // human-readable, never numeric
}
```

---

## Deliverable

Working code, plus a short note covering:

1. Which of the 36 seeded watches currently have enough data to produce a full
   standing, and which produce a partial one.
2. Which fields are the highest-value to backfill first, ranked by how many
   watches they unblock.

Point 2 matters. Most seed records lack caliber, thickness, and any finishing
detail, so the engine will run and say very little until backfill happens.
Better to know which twenty fields to fill than to discover the gap after the
UI is built.

---

## Phase 2 (not in scope, for context only)

Display: replace the single score on the watch card with five horizontal bars,
one per dimension, with the rubric reference marked as a tick. Under it, one
generated line: "Top of band for divers under $1k. Wins on wearability and case
craft, trails on bracelet. Pre-order, Q4 2026." Friction chips render in a
distinct treatment. The 2x2 stays as the browse view but plots only within the
selected peer group.
