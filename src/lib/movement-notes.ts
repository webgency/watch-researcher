// Movement character notes: what a movement is like to use, for movements the
// tier scale deliberately does not rate.
//
// Deliberately outside scoring.ts and outside Standing. A meca-quartz watch is
// unrated on movement because the mechanical tier scale (hacking, beat rate,
// power reserve) has no position for it — but "unrated" read as "nothing to
// say", which is wrong about the one thing these watches are bought for. The
// note is FYI only, in the same spirit as the overlap notes in the working
// agreements: it never reaches a score. Keeping it in its own module is what
// makes that structural rather than a rule someone has to remember.

import { MECA_QUARTZ_CALIBER_PATTERN } from "./caliber-aliases.mjs";
import type { Watch } from "./types";

export interface MovementNote {
  /** Chip text. Lowercase, like the friction chips it sits beside. */
  label: string;
  /** The longer read, shown as a tooltip on the chip and as a line in the standing panel. */
  detail: string;
}

const MECA_QUARTZ_NOTE: MovementNote = {
  label: "meca-quartz chrono feel",
  detail:
    "Quartz timekeeping with a mechanical chronograph module: the pushers click and the hands snap back to zero, as on a mechanical chronograph. FYI only — never scored on the mechanical tier scale.",
};

/**
 * The character note for this watch's movement, or undefined when it has none.
 *
 * Read from the caliber rather than from `movement`, because the caliber is the
 * evidence: a VK64 is a meca-quartz chronograph whatever the movement field
 * happens to say. (audit:calibers separately fails a VK not recorded as quartz.)
 */
export function movementNote(watch: Watch): MovementNote | undefined {
  const caliber = watch.specs?.caliber;
  if (caliber && MECA_QUARTZ_CALIBER_PATTERN.test(caliber)) return MECA_QUARTZ_NOTE;
  return undefined;
}
