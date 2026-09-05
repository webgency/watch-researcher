// Category vocabulary: how a descriptive tag becomes a scoring category.
//
// Plain .mjs for the same reason as spec-ranges.mjs and caliber-aliases.mjs —
// scripts/audit-data.mjs runs under bare Node with no build step.
// src/lib/categories.ts is the typed surface the app imports.
//
// The basename differs from categories.ts on purpose: same-basename twins make
// an extensionless "./categories" import resolve to whichever the bundler
// prefers, which is how the typed surface got silently bypassed once already.

/** The five categories the collection is scored against. */
export const CATEGORIES = ["diver", "chronograph", "gmt", "dress", "sports"];

/**
 * Descriptive tags mapped to the category they imply.
 *
 * Keys are lowercase; lookups lowercase and trim first, because the data has
 * carried "GMT", "Chronograph" and "CHRONOGRAPH" as separate spellings of the
 * same thing. normalizeTags() below is what stops that recurring.
 */
export const TAG_TO_CATEGORY = {
  diver: "diver",
  dive: "diver",
  divers: "diver",
  chronograph: "chronograph",
  chrono: "chronograph",
  gmt: "gmt",
  worldtimer: "gmt",
  "world-timer": "gmt",
  traveler: "gmt",
  dress: "dress",
  formal: "dress",
  sports: "sports",
  sport: "sports",
  field: "sports",
};

/**
 * Category implied by a tag list, or undefined when none of them resolve.
 *
 * There is deliberately no default. The previous `?? "dress"` graded every
 * untagged watch against a 30m water-resistance expectation, so a 300m diver
 * cleared its target tenfold and scored a perfect mark on a standard it was
 * never being judged by. Unknown is unrated, the same rule unknown calibers
 * already follow.
 *
 * Scanning is in array order, so tag[0] is the scoring category by convention.
 * That convention only decides watches with no explicit `scoringCategory`:
 * deriveCategory() in scoring.ts reads that field first, and refuses to let tag
 * order pick a rubric for a hybrid. Every hybrid in the collection carries the
 * explicit field, so the two never disagree — categories.test.ts asserts it.
 */
export function resolveCategory(tags = []) {
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const hit = TAG_TO_CATEGORY[tag.toLowerCase().trim()];
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Scoring category for a whole watch: the explicit field when set, else the
 * tags. Undefined means unrated, never a fallback.
 */
export function categoryFor(watch) {
  return watch?.scoringCategory ?? resolveCategory(watch?.tags ?? []);
}

/**
 * Tags lowercased, trimmed, emptied-out and de-duplicated, order preserved.
 * Applied on write so "GMT" and "gmt" cannot coexist as two tags again.
 */
export function normalizeTags(tags = []) {
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const clean = tag.toLowerCase().trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

/** Every distinct category the tags resolve to. More than one means a hybrid. */
export function categoriesInTags(tags = []) {
  const found = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const hit = TAG_TO_CATEGORY[tag.toLowerCase().trim()];
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}
