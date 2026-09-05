#!/usr/bin/env node
//
// Reports the Phase 0 acceptance criteria against data/watches.json.
//
// validate:data answers "is this record well formed?". This answers "is the
// collection ready to be scored?" — which is a different question, because
// every gap Phase 0 exists to close is a perfectly well-formed record that the
// scoring engine cannot read: a tag whose capitalisation misses the lookup, a
// caliber spelled a way the tier table does not recognise, a category that
// resolves only because a default filled it in.
//
// Exits non-zero when a criterion fails, so it can gate npm run check.
// Findings that need a human are listed but never fail the run.

import { readFile } from "node:fs/promises";
import { isKnownCaliber, isQuartzMovement, normalizeCaliber } from "../src/lib/caliber-aliases.mjs";
import {
  CATEGORY_WR_EXPECTATION,
  categoriesInTags,
  categoryFor,
  resolveCategory,
} from "../src/lib/category-tags.mjs";
import { plausibilityErrors, plausibilityWarnings } from "../src/lib/spec-plausibility.mjs";
import { RUBRIC_CATEGORIES } from "../src/lib/rubric-categories.mjs";
import { BRACELET_FLAG_KEYS, CASE_CRAFT_FLAG_KEYS } from "../src/lib/quality-flag-inputs.mjs";

const DATA_URL = new URL("../data/watches.json", import.meta.url);

/**
 * Caliber coverage target, from the spec: 27 of 30 mechanical records, i.e.
 * 90%. Held as a ratio rather than a count because the collection has grown
 * past the 30 the spec was written against.
 */
const CALIBER_TARGET_RATIO = 27 / 30;

const raw = JSON.parse(await readFile(DATA_URL, "utf8"));
const watches = Array.isArray(raw) ? raw : raw.watches;
const label = (w) => `${w.id} ${w.brand} ${w.model}`.slice(0, 68);

const criteria = [];
const notes = [];

function criterion(name, ok, detail) {
  criteria.push({ name, ok, detail });
}

// --- 1. Category resolution, with no fallback ------------------------------
// The removed `?? "dress"` is the reason this is criterion one: it did not
// fail loudly, it graded an untagged 300m diver against a 30m expectation.
const unresolved = watches.filter((w) => categoryFor(w) === undefined && w.category !== "unknown");
const flaggedUnknown = watches.filter((w) => w.category === "unknown");
criterion(
  "every record resolves to a category, or is flagged category: unknown",
  unresolved.length === 0,
  `${watches.length - unresolved.length}/${watches.length} resolved` +
    (flaggedUnknown.length ? `, ${flaggedUnknown.length} flagged unknown` : "")
);
for (const w of unresolved) notes.push(`no category: ${label(w)} tags=${JSON.stringify(w.tags ?? [])}`);

// No record may reach a category by default. Probed with a tag set that
// resolves to nothing rather than counted over the data: with the default
// removed, a fallback cannot show up as a record, only as a reintroduced
// `?? "dress"` — and that is a one-line change nothing else here would catch.
const fallbackProbe = resolveCategory(["not-a-category"]);
criterion(
  "an unresolvable tag set returns undefined, not a default category",
  fallbackProbe === undefined,
  fallbackProbe === undefined ? "no default" : `defaults to ${fallbackProbe}`
);

// --- 2. Plausibility -------------------------------------------------------
const specErrors = watches.flatMap((w) =>
  plausibilityErrors(w.specs).map((i) => `${label(w)} — ${i.message}`)
);
const specWarnings = watches.flatMap((w) =>
  plausibilityWarnings(w.specs).map((i) => `${label(w)} — ${i.message}`)
);
criterion("no plausibility violations", specErrors.length === 0, `${specErrors.length} errors, ${specWarnings.length} warnings`);
for (const line of specErrors) notes.push(`implausible: ${line}`);

// --- 3. Caliber coverage ---------------------------------------------------
// Quartz is excluded rather than counted as a miss: the tier scale is anchored
// on hacking, beat rate and power reserve, so a quartz caliber is deliberately
// unrated and counting it would understate the coverage that matters.
const mechanical = watches.filter((w) => !isQuartzMovement(w.specs?.movement));
const matched = mechanical.filter((w) => isKnownCaliber(w.specs?.caliber, w.specs?.movement));
const ratio = mechanical.length ? matched.length / mechanical.length : 1;
criterion(
  `caliber match rate at or above ${(CALIBER_TARGET_RATIO * 100).toFixed(0)}% of mechanical records`,
  ratio >= CALIBER_TARGET_RATIO,
  `${matched.length}/${mechanical.length} (${(ratio * 100).toFixed(1)}%), target 27/30`
);
for (const w of mechanical) {
  if (isKnownCaliber(w.specs?.caliber, w.specs?.movement)) continue;
  const key = normalizeCaliber(w.specs?.caliber, w.specs?.movement);
  notes.push(`unmatched caliber: ${label(w)} — ${key === undefined ? "none recorded" : JSON.stringify(key)}`);
}

// --- 4. Case diameter ------------------------------------------------------
// Highest-value single field: it gates wearability and feeds three of the
// plausibility rules.
const noDiameter = watches.filter((w) => typeof w.specs?.caseDiameterMm !== "number");
criterion(
  "caseDiameterMm present on every record",
  noDiameter.length === 0,
  `${watches.length - noDiameter.length}/${watches.length}`
);
for (const w of noDiameter) notes.push(`no caseDiameterMm: ${label(w)}`);

// --- Findings that need a human, never fatal -------------------------------

// A category the Phase 0 layer resolves but RUBRICS has no column for.
// computeStanding needs a rubric to produce a valueScore, so such a watch
// would have no value score at all and fall out of the quadrant chart — not
// merely be a dimension short. Empty today; sports was the last one.
const unscored = watches.filter((w) => {
  const category = categoryFor(w);
  return category !== undefined && !RUBRIC_CATEGORIES.includes(category);
});
if (unscored.length) {
  notes.push(
    `${unscored.length} record(s) resolve to a category RUBRICS has no column for. ` +
      `They have no valueScore and no quadrant until one is added:`
  );
  for (const w of unscored) notes.push(`  ${categoryFor(w)}: ${label(w)}`);
}

// An explicit scoringCategory that contradicts the tags. The field wins, so a
// stale one silently grades the watch against the wrong rubric.
for (const w of watches) {
  if (!w.scoringCategory) continue;
  const fromTags = categoriesInTags(w.tags ?? []);
  if (fromTags.length && !fromTags.includes(w.scoringCategory)) {
    notes.push(
      `category mismatch: ${label(w)} — scoringCategory=${w.scoringCategory}, tags say ${fromTags.join("/")}`
    );
  }
}

// A watch whose recorded water resistance falls well short of the bar its
// category is judged against is usually mis-categorised, not badly built —
// the same failure as the old dress default, pointing the other way.
for (const w of watches) {
  const category = categoryFor(w);
  const wr = w.specs?.waterResistanceM;
  const bar = category ? CATEGORY_WR_EXPECTATION[category] : undefined;
  if (typeof wr !== "number" || bar === undefined || wr >= bar) continue;
  notes.push(
    `under its category bar: ${label(w)} — ${wr}m against the ${bar}m expected of a ${category}`
  );
}

// qualityFlags gate caseCraft and bracelet. The spec's advice is to accept
// partial coverage rather than attack it, so this reports and never fails.
// The key lists are imported rather than restated here; a test locks them to
// what scoreDimensionEvidence actually reads.
const has = (w, keys) => keys.some((k) => w.qualityFlags?.[k] !== undefined);
const caseCraft = watches.filter((w) => has(w, CASE_CRAFT_FLAG_KEYS)).length;
const bracelet = watches.filter((w) => has(w, BRACELET_FLAG_KEYS)).length;
const lugToLug = watches.filter((w) => typeof w.specs?.lugToLugMm === "number").length;

// --- Report ----------------------------------------------------------------
console.log(`Phase 0 audit — ${watches.length} watches\n`);
console.log("Acceptance criteria");
for (const c of criteria) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);

console.log("\nCoverage (reported, not gated)");
console.log(`  caseCraft inputs   ${caseCraft}/${watches.length}`);
console.log(`  bracelet inputs    ${bracelet}/${watches.length}`);
console.log(`  lugToLugMm         ${lugToLug}/${watches.length}`);

if (specWarnings.length) {
  console.log(`\nPlausibility warnings (${specWarnings.length}, not gated)`);
  for (const line of specWarnings) console.log(`  - ${line}`);
}

if (notes.length) {
  console.log(`\nNeeds research (${notes.length})`);
  for (const line of notes) console.log(`  - ${line}`);
}

const failed = criteria.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\nPhase 0 audit FAILED: ${failed.length} of ${criteria.length} criteria not met.`);
  process.exit(1);
}
console.log(`\nPhase 0 audit passed: ${criteria.length}/${criteria.length} criteria met.`);
