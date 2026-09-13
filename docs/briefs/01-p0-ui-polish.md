# 01 — P0 UI polish

**PR title:** `ui: priority popover dismiss, quieter cards, ordinals`  
**Depends on:** nothing (do this first if not already merged)  
**Refs:** `docs/ux-visual-opportunities.md` §P0

## Problem

1. Wishlist priority filter uses `<details>` and stays open after pointer leave / outside click (`CollectionView.tsx`).
2. `WatchCard` dumps too many score pills + Above/Below/Unrated prose.
3. Peer percentiles render as `22th pct`.

## Implement

### A. Priority popover
Replace toolbar `<details>` with controlled multi-select popover:
- Same labels, counts, Clear, checkbox semantics
- Close on outside click + Escape
- No hover-only open

### B. Quieter cards
- Keep image, brand/model/ref, badges, price, size·movement, best-offer block, tags
- One **hero** score pill (rubric value if rated, else design, else muted unrated)
- Collapse Above/Below/Unrated behind closed `<details>` “Score details” (or equivalent)
- Prefer image + title as navigation vs full-card stretched overlay link

### C. Ordinals
Add `formatOrdinal` (correct teens) and use for percentile copy.

## Out of scope
Rename, Market panel, alerts, scoring math, `watches.json` data edits.

## Done when
- [ ] Popover dismisses correctly
- [ ] Cards quieter; score details reachable
- [ ] No broken ordinals
- [ ] Lint/typecheck clean on touched files
