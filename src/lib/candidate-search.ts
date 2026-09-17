import { formatMoney } from "./format";
import { CANDIDATE_TIER_ORDER, candidateTier, type TradeUpCandidate } from "./trade-up";
import { WISHLIST_TIER_LABELS, type WishlistTier } from "./types";

export interface CandidateGroup {
  tier: WishlistTier;
  label: string;
  candidates: TradeUpCandidate[];
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Candidates matching a search, grouped Shortlist, Watching, Pass. Every term
 * must appear in the brand and model, ignoring case and accents, so
 * "nomos glashutte" finds "NOMOS Glashütte". Empty groups are omitted and the
 * incoming order (A–Z within a tier) is kept.
 */
export function groupCandidates(candidates: TradeUpCandidate[], query: string): CandidateGroup[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = candidates.filter((candidate) => {
    const label = normalize(candidate.label);
    return terms.every((term) => label.includes(term));
  });
  return CANDIDATE_TIER_ORDER
    .map((tier) => ({ tier, label: WISHLIST_TIER_LABELS[tier], candidates: matches.filter((candidate) => candidateTier(candidate) === tier) }))
    .filter((group) => group.candidates.length > 0);
}

/** The price a candidate would be compared at: its best dated ask, else its
 * target, labelled so a planning amount never reads as an available listing. */
export function candidatePriceSummary(candidate: TradeUpCandidate): string {
  if (candidate.best.status === "available") return `${formatMoney(candidate.best.offer.price)} ask`;
  if (candidate.target) return `Target ${formatMoney(candidate.target.price)}`;
  return "No ask or target";
}
