# 02 — Detail page museum layout

**PR title:** `ui: museum-style watch detail layout`  
**Depends on:** 01 recommended (can parallelize if careful)  
**Refs:** `docs/competitive-lug2lug.md`, `docs/ux-visual-opportunities.md`, `docs/branding.md`

## Problem

Watch detail should feel like Lug²Lug’s calm product page (hero + key specs + chapters), while remaining Vitrine (decision-oriented), not a catalog clone.

## Implement

1. **Hero:** large image; brand/model/ref; wishlist tier + status; primary price.
2. **Key-spec strip** (tabular nums): diameter · lug-to-lug · thickness · WR · caliber (omit missing; never invent).
3. **Spec chapters** with clear headings: Case · Crystal & dial · Movement · Strap/bracelet (map from existing `specs` / `qualityFlags`).
4. **Decision chrome** stays visible but secondary: rubric/deal/design summaries — not louder than name/price.
5. Reserve vertical slots (empty OK) for upcoming **Market** and **Trade-up** sections (briefs 04 / 07) so later PRs don’t reflow the whole page.
6. Respect branding: cocoa/azalea, Manrope, no emoji.

## Out of scope
Market data model, sold comps, alerts, compare redesign, fetching new specs.

## Done when
- [ ] Detail page has hero + key-spec strip + grouped specs
- [ ] Existing scores/actions still work
- [ ] Looks intentional on desktop; usable on narrow widths
