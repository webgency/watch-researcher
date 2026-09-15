# 08 — Demote wishlist tiers (VFM-first)

**PR title:** `ui: demote wishlist tiers on value views; simplify priority`  
**Depends on:** P0 UI polish ideally merged (priority popover exists)  
**Refs:** `docs/briefs/00-working-agreements.md`; product note — value for money is the primary next-buy signal; tiers must never read as a second verdict

## Problem

Wishlist priority (`next-purchase` / `must-have` / `love-it` / …) sits next to rubric value and deal evidence and *feels* like a competing score. Scores already ignore `wishlistTier` (keep that). The bug is presentation and default sort/filter chrome, not the field existing.

Sergio’s next-buy priority is fluid as new pieces appear; VFM ranking matters more than emotional tier labels.

## Goals

1. **Value / VFM surfaces** lead with rubric value, deal confidence, and evidence — not tier chips.
2. **Collection / wishlist** may keep a *simpler* personal priority for filtering only.
3. **Never** let tier change rubric, deal score, quadrant, or overlap FYI behavior.

## Implement

### A. Value-first chrome
- Any view that is primarily about value-for-money (value list, matrix/standing if still shown, compare-by-value sorts): **hide** `WishlistTierBadge` / priority chips by default.
- Default sort on those surfaces: rubric **value** (desc), then deal freshness / best offer — **not** `wishlistTier`.
- Keep tier as an optional filter only if cheap; do not show “Must have” stat strip on the value view (move those counts to collection/wishlist only).

### B. Simplify the tier vocabulary (collection / wishlist only)
Replace the six emotional tiers with three (migration below):

| New | Maps from (existing) |
|-----|----------------------|
| `shortlist` | `next-purchase`, `must-have`, `love-it` |
| `watching` | `interested`, `maybe-later`, unset |
| `pass` | `pass` |

Update `WishlistTier` in `src/lib/types.ts`, labels, validation, `CollectionView` priority popover, `WatchForm` / priority menus, badges.

### C. Migration
- One-shot migrate `data/watches.json` (and any seed) with the mapping above.
- Keep API tolerant of old strings for one release *or* migrate in the same PR and update validation to new enum only — prefer single clean cut.
- Static GitHub Pages mode must still render.

### D. Working agreements
Add to `docs/briefs/00-working-agreements.md`:

- Wishlist / shortlist labels are personal priority only; they never feed scoring.
- Value views hide tier chips; collection may show simplified `watching` | `shortlist` | `pass`.

## Out of scope

- Deleting the field entirely (can revisit later if unused)
- Changing scoring math, deal rules, or overlap FYI rules
- Market panel / alerts / trade-up
- Renaming the product or repo

## Done when

- [ ] Value-oriented UI does not show tier chips as a co-equal verdict beside rubric value
- [ ] Default value sort is VFM-related, not tier rank
- [ ] Tier enum simplified to `watching` | `shortlist` | `pass` with data migrated
- [ ] Scores still ignore tier (add/adjust a unit or audit assertion if one exists)
- [ ] Lint/typecheck clean on touched files
