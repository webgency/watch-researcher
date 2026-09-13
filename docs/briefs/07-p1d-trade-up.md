# 07 — P1d Trade-up panel

**PR title:** `feat: trade-up panel on owned detail (P1d)`  
**Depends on:** 04  
**Full spec:** `docs/prd-p1-market-intel-trade-up.md` §7.4, 11 P1d

## Implement

- On **owned** detail: Exit range from market evidence (pre-owned default) or insufficient
- Pick a wishlist candidate: bridge = candidate best ask (or target) − exit median
- Label assumptions: listed prices; fees/shipping not included
- Does **not** mutate tiers or scores

## Out of scope
Auto-listing for sale, dealer messaging, flip ROI %.

## Done when
- [ ] Exit + bridge render for a real owned vs wishlist pair
- [ ] Insufficient state clear when evidence thin
