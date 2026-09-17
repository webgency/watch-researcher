import type { Watch } from "./types";

// Crystal text that states an anti-reflective coating. "AR" is matched
// case-sensitively so the letters inside ordinary words never count.
const AR_ABBREVIATION = /\bAR\b/;
const AR_WORDS = /anti-?reflect|antireflex|anti-?reflet|antirreflej|antirifless/i;

export function crystalStatesAr(crystal: string | undefined): boolean {
  return Boolean(crystal) && (AR_ABBREVIATION.test(crystal!) || AR_WORDS.test(crystal!));
}

/**
 * Fill arCoated from the crystal description when the flag is unrecorded:
 * "Double-dome sapphire, internal AR" already says the coating exists, so
 * leaving the flag blank would understate the case evidence.
 *
 * Applied where the app saves a watch (addWatch / changeWatch in store.ts),
 * not at score time: the scoring engine reads recorded flags only, and the
 * inferred value is then visible and editable in the form. Rules:
 * - an explicit arCoated (true or false) or an arLayers count always wins;
 * - a crystal that doesn't mention AR leaves the flag unknown, never false.
 * The enrich and backfill scripts write watches.json directly and don't use it.
 */
export function withCrystalArInference<T extends Pick<Watch, "specs" | "qualityFlags">>(watch: T): T {
  const flags = watch.qualityFlags;
  if (flags?.arCoated !== undefined || flags?.arLayers !== undefined) return watch;
  if (!crystalStatesAr(watch.specs?.crystal)) return watch;
  return { ...watch, qualityFlags: { ...flags, arCoated: true } };
}
