// Typed surface for the category vocabulary.
//
// The tag table lives in ./categories.mjs so scripts/audit-data.mjs can import
// it under bare Node. This file adds the types and the one thing that needs
// TypeScript: the water-resistance expectation for the fifth category.

import {
  CATEGORIES as CATEGORY_LIST,
  TAG_TO_CATEGORY as TAG_MAP,
  CATEGORY_WR_EXPECTATION as WR_EXPECTATION,
  categoriesInTags as categoriesInTagsJs,
  categoryFor as categoryForJs,
  normalizeTags as normalizeTagsJs,
  resolveCategory as resolveCategoryJs,
} from "./category-tags.mjs";

import { CATEGORY_EXPECTATION as RUBRIC_EXPECTATION } from "./rubrics";
import type { ScoringCategory, Watch } from "./types";

/**
 * The five categories the collection is scored against.
 *
 * `sports` is the one that is not yet a ScoringCategory. Roughly a third of
 * the collection — Formex Essence, Tissot Gentleman, Straum Jan Mayen — is
 * neither diver nor dress, and forcing those into `dress` at 30m understates
 * them exactly the way the old `dress` default overstated the divers. Wiring
 * it into the scored rubric means adding a column to RUBRICS in rubrics.ts,
 * which is Phase 1 work; until then it resolves and reports but does not score.
 */
export type Category = ScoringCategory | "sports";

export const CATEGORIES: readonly Category[] = CATEGORY_LIST as Category[];

/** Descriptive tags mapped to the category they imply. Keys are lowercase. */
export const TAG_TO_CATEGORY: Readonly<Record<string, Category>> = TAG_MAP as Record<string, Category>;

export interface CategoryExpectation {
  wrM: number;
  needsBezel: boolean;
  needsScrewCrown: boolean;
}

/**
 * Fitness-for-purpose expectations for all five categories.
 *
 * The four scored categories are re-exported from rubrics.ts rather than
 * restated, so there is one set of numbers. `sports` is added here at 100m:
 * enough that a watch calling itself a sports watch should survive swimming,
 * well short of what a diver is held to.
 */
export const CATEGORY_EXPECTATION: Readonly<Record<Category, CategoryExpectation>> = {
  ...RUBRIC_EXPECTATION,
  sports: { wrM: 100, needsBezel: false, needsScrewCrown: false },
};

/** Water resistance each category is judged against, for bare-Node consumers. */
export const CATEGORY_WR_EXPECTATION: Readonly<Record<Category, number>> =
  WR_EXPECTATION as Record<Category, number>;

/**
 * Category implied by a tag list, or undefined when none resolve.
 * There is no default: unknown is unrated, never `dress`.
 */
export function resolveCategory(tags: string[] = []): Category | undefined {
  return resolveCategoryJs(tags);
}

/** Explicit `scoringCategory` when set, else the tags. Undefined means unrated. */
export function categoryFor(watch: Pick<Watch, "scoringCategory" | "tags">): Category | undefined {
  return categoryForJs(watch);
}

/** Tags lowercased, trimmed and de-duplicated, order preserved. */
export function normalizeTags(tags: string[] = []): string[] {
  return normalizeTagsJs(tags);
}

/** Every distinct category the tags resolve to. More than one means a hybrid. */
export function categoriesInTags(tags: string[] = []): Category[] {
  return categoriesInTagsJs(tags);
}
