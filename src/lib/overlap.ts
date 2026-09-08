// ---------------------------------------------------------------------------
// Overlap detection.
//
// A 60-watch wishlist stops being a list and becomes a decision problem: the
// same watch turns up three times under three brand names, and browsing can't
// show you that. This groups entries that would be the same purchase — same
// role on the wrist, same size, same money — so the choice is between groups
// rather than between sixty rows.
//
// It follows the same rules as the scoring engine:
//   - Missing data is never filled in. A watch without a resolvable category or
//     a recorded case diameter is reported as unchecked, with the reason, and
//     never clustered on a guessed value.
//   - Friction never enters the grouping or the ranking. It is display only.
//   - Value and design stay separate. A group has a value leader and a design
//     leader, and they are allowed to disagree — that disagreement is the most
//     useful thing this page produces, so it is never averaged away.
// ---------------------------------------------------------------------------

import { RubricCategory } from "./rubrics";
import {
  deriveCategory,
  landedPriceUsd,
  standingSummaries,
  StandingSummary,
} from "./scoring";
import { Watch } from "./types";

/**
 * How far two case diameters can differ and still wear as the same watch.
 *
 * 1.5mm is the width of the cross-shopping people actually do: 39 against 40,
 * 41 against 42. Past that the wrist presence changes and they stop being
 * substitutes. Held deliberately below 2mm, which would chain 38 to 42 through
 * the clique rule below and produce groups nobody would call duplicates.
 */
export const SIZE_TOLERANCE_MM = 1.5;

/**
 * How far apart two all-in prices can be and still compete for the same money.
 *
 * A ratio, not a band. Price bands are the right unit for scoring, where an
 * absolute reference matters, but they are the wrong unit here: a $980 and a
 * $1050 diver sit in different bands and are obviously the same decision. 1.5x
 * is roughly the point where the cheaper one stops being an alternative and
 * starts being a different budget.
 */
export const PRICE_RATIO_LIMIT = 1.5;

/** A group needs at least two members to be an overlap at all. */
export const MIN_CLUSTER_SIZE = 2;

export type ExclusionReason =
  | "sold"
  | "no-category"
  | "no-diameter"
  | "no-price";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  sold: "Sold — no longer a purchase decision",
  "no-category": "No scoring category, and its tags don't resolve to one",
  "no-diameter": "No case diameter recorded",
  "no-price": "No price recorded",
};

export interface OverlapMember {
  watch: Watch;
  summary: StandingSummary;
  /** All-in USD price used for grouping. Always present on a member. */
  priceUsd: number;
  /** Case diameter used for grouping. Always present on a member. */
  diameterMm: number;
}

/** Whether the objective read and your own eye pick the same watch. */
export type OverlapAgreement = "agree" | "diverge" | "unknown";

export interface OverlapCluster {
  /** Stable across runs: member ids, sorted, joined. */
  id: string;
  category: RubricCategory;
  /** Display context, e.g. "39-40mm divers, $620-910". */
  label: string;
  diameterRange: [number, number];
  priceRangeUsd: [number, number];
  /** Value-rated members first, best value first; unrated members last. */
  members: OverlapMember[];
  /**
   * Ids holding the top value score. Empty when no member is value-rated;
   * longer than one on a tie, so the UI never invents a winner.
   */
  valueLeaderIds: string[];
  /** Ids holding the top design score, on the same terms. */
  designLeaderIds: string[];
  /** "diverge" is the interesting case: best value is not the one you like. */
  agreement: OverlapAgreement;
  /** Ids of members already owned — the strongest reason to skip the rest. */
  ownedIds: string[];
  /** Brands appearing more than once here: near-certain same-model duplicates. */
  repeatedBrands: string[];
}

export interface UncheckedWatch {
  watch: Watch;
  reason: ExclusionReason;
}

export interface OverlapReport {
  clusters: OverlapCluster[];
  /** Watches that could not be grouped, with why. Never silently dropped. */
  unchecked: UncheckedWatch[];
  /** Watches that were checked and matched nothing. */
  distinctCount: number;
  /** Total considered, i.e. everything except `unchecked`. */
  checkedCount: number;
}

interface Candidate {
  watch: Watch;
  category: RubricCategory;
  diameterMm: number;
  priceUsd: number;
}

/** Two watches are substitutes when they wear the same and cost about the same. */
function compatible(a: Candidate, b: Candidate): boolean {
  if (Math.abs(a.diameterMm - b.diameterMm) > SIZE_TOLERANCE_MM) return false;
  const [low, high] = a.priceUsd <= b.priceUsd ? [a.priceUsd, b.priceUsd] : [b.priceUsd, a.priceUsd];
  if (low <= 0) return false;
  return high / low <= PRICE_RATIO_LIMIT;
}

/** Ids at the maximum of `score`, or [] when nothing is scored. */
function leadersBy(
  members: OverlapMember[],
  score: (member: OverlapMember) => number | null | undefined
): string[] {
  let best: number | undefined;
  const leaders: string[] = [];
  for (const member of members) {
    const value = score(member);
    if (value === null || value === undefined) continue;
    if (best === undefined || value > best) {
      best = value;
      leaders.length = 0;
      leaders.push(member.watch.id);
    } else if (value === best) {
      leaders.push(member.watch.id);
    }
  }
  return leaders;
}

const CATEGORY_PLURAL: Record<RubricCategory, string> = {
  diver: "divers",
  chronograph: "chronographs",
  gmt: "GMTs",
  dress: "dress watches",
  sports: "sports watches",
};

function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clusterLabel(category: RubricCategory, sizes: [number, number], prices: [number, number]): string {
  const size = sizes[0] === sizes[1] ? `${formatMm(sizes[0])}mm` : `${formatMm(sizes[0])}-${formatMm(sizes[1])}mm`;
  const low = Math.round(prices[0]);
  const high = Math.round(prices[1]);
  const price = low === high ? `$${low.toLocaleString("en-US")}` : `$${low.toLocaleString("en-US")}-${high.toLocaleString("en-US")}`;
  return `${size} ${CATEGORY_PLURAL[category]}, ${price}`;
}

/**
 * Overlapping groups across the collection.
 *
 * Owned watches are grouped alongside wishlist ones on purpose: "you already
 * own one of these" is the whole point. Sold ones are dropped — they are not a
 * purchase decision any more.
 *
 * Deliberately not detected here: the cheaper-equivalent case, where the same
 * watch exists two price tiers down. That is a different question (what should
 * I pay?) and the value score already answers it per watch.
 */
export function findOverlaps(watches: Watch[], onWarning?: (message: string) => void): OverlapReport {
  const candidates: Candidate[] = [];
  const unchecked: UncheckedWatch[] = [];

  for (const watch of watches) {
    if (watch.status === "sold") {
      unchecked.push({ watch, reason: "sold" });
      continue;
    }
    const category = deriveCategory(watch);
    if (!category) {
      unchecked.push({ watch, reason: "no-category" });
      continue;
    }
    const diameterMm = watch.specs?.caseDiameterMm;
    if (diameterMm === undefined) {
      unchecked.push({ watch, reason: "no-diameter" });
      continue;
    }
    const priceUsd = landedPriceUsd(watch, onWarning);
    if (priceUsd === undefined) {
      unchecked.push({ watch, reason: "no-price" });
      continue;
    }
    candidates.push({ watch, category, diameterMm, priceUsd });
  }

  // Standings are computed once against the whole collection, so peer labels
  // and percentiles match what the detail page shows.
  const summaries = standingSummaries(
    candidates.map((candidate) => candidate.watch),
    watches
  );

  const grouped = new Map<RubricCategory, Candidate[]>();
  for (const candidate of candidates) {
    const list = grouped.get(candidate.category);
    if (list) list.push(candidate);
    else grouped.set(candidate.category, [candidate]);
  }

  const clusters: OverlapCluster[] = [];
  let clustered = 0;

  for (const [category, list] of grouped) {
    // Ascending diameter, then price, then id: a stable order so the same data
    // always produces the same groups.
    const sorted = [...list].sort(
      (a, b) =>
        a.diameterMm - b.diameterMm ||
        a.priceUsd - b.priceUsd ||
        a.watch.id.localeCompare(b.watch.id)
    );
    const taken = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      const seed = sorted[i];
      if (taken.has(seed.watch.id)) continue;

      // Every member must be compatible with every other member, not merely
      // with the seed. Single-link growth would chain 38mm to 41mm through a
      // 39.5mm middle and call three different watches the same one.
      const group: Candidate[] = [seed];
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        if (taken.has(next.watch.id)) continue;
        if (group.every((member) => compatible(member, next))) group.push(next);
      }
      if (group.length < MIN_CLUSTER_SIZE) continue;

      for (const member of group) taken.add(member.watch.id);
      clustered += group.length;

      const members: OverlapMember[] = group
        .map((candidate) => ({
          watch: candidate.watch,
          summary: summaries[candidate.watch.id],
          priceUsd: candidate.priceUsd,
          diameterMm: candidate.diameterMm,
        }))
        .sort((a, b) => {
          const av = a.summary.standing.valueScore;
          const bv = b.summary.standing.valueScore;
          // Unrated members sort last rather than to the bottom of the scale:
          // no score is not the same claim as a bad one.
          if (av === undefined && bv === undefined) {
            return (b.summary.designScore ?? -1) - (a.summary.designScore ?? -1)
              || a.watch.brand.localeCompare(b.watch.brand);
          }
          if (av === undefined) return 1;
          if (bv === undefined) return -1;
          return bv - av || a.watch.brand.localeCompare(b.watch.brand);
        });

      const diameters = group.map((candidate) => candidate.diameterMm);
      const prices = group.map((candidate) => candidate.priceUsd);
      const diameterRange: [number, number] = [Math.min(...diameters), Math.max(...diameters)];
      const priceRangeUsd: [number, number] = [Math.min(...prices), Math.max(...prices)];

      const valueLeaderIds = leadersBy(members, (member) => member.summary.standing.valueScore);
      const designLeaderIds = leadersBy(members, (member) => member.summary.designScore);
      const agreement: OverlapAgreement =
        valueLeaderIds.length === 0 || designLeaderIds.length === 0
          ? "unknown"
          : valueLeaderIds.some((id) => designLeaderIds.includes(id))
            ? "agree"
            : "diverge";

      const brandCounts = new Map<string, number>();
      for (const member of members) {
        const key = member.watch.brand.trim().toLowerCase();
        brandCounts.set(key, (brandCounts.get(key) ?? 0) + 1);
      }
      const repeatedBrands = members
        .map((member) => member.watch.brand.trim())
        .filter((brand, index, all) => all.indexOf(brand) === index)
        .filter((brand) => (brandCounts.get(brand.toLowerCase()) ?? 0) > 1);

      clusters.push({
        id: members.map((member) => member.watch.id).sort().join("+"),
        category,
        label: clusterLabel(category, diameterRange, priceRangeUsd),
        diameterRange,
        priceRangeUsd,
        members,
        valueLeaderIds,
        designLeaderIds,
        agreement,
        ownedIds: members.filter((member) => member.watch.status === "owned").map((member) => member.watch.id),
        repeatedBrands,
      });
    }
  }

  // Biggest, then most expensive: the groups where a wrong pick costs most.
  clusters.sort(
    (a, b) =>
      b.members.length - a.members.length ||
      b.priceRangeUsd[1] - a.priceRangeUsd[1] ||
      a.label.localeCompare(b.label)
  );

  return {
    clusters,
    unchecked,
    checkedCount: candidates.length,
    distinctCount: candidates.length - clustered,
  };
}
