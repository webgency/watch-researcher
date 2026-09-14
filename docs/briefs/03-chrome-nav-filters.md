# 03 — Chrome: nav, filters, stats

**PR title:** `ui: pill nav and collection toolbar layout`  
**Depends on:** 01 helpful  
**Refs:** `docs/ux-visual-opportunities.md`, `docs/branding.md`

## Problem

Header and collection filters feel like an admin tool; Lug²Lug’s pill nav and grouped controls feel like a product.

## Implement

1. **Header:** pill/cluster nav for Compare · Value · (+ Add when not static); active state uses azalea or cocoa-900 border per branding (azalea = selection accent).
   *Revised 2026-09-13:* Compare was removed from the header. It acts on a selection rather than being a destination, and the collection's sticky selection tray already starts comparisons.
2. **Filter toolbar:** two rows on `sm+` — (1) status chips (2) priority · fresh offers · sort — consistent control heights/radii.
3. **Stat strip:** Total / Next purchase / Must have / Owned — larger numbers, readable labels (avoid tiny 10px type).
4. Soften read-only banner if present: editorial note + link, not warning-tape emoji.

## Out of scope
New routes, Market+, scoring changes.

## Done when
- [ ] Nav and filters feel grouped and aligned
- [ ] Stats readable
- [ ] No functional regressions to filter/sort/compare selection
