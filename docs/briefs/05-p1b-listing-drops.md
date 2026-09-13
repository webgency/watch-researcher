# 05 — P1b Listing price-drop trail

**PR title:** `feat: listing price-drop observations (P1b)`  
**Depends on:** 04  
**Full spec:** `docs/prd-p1-market-intel-trade-up.md` §7.2, 11 P1b

## Implement

- Track observations per listing URL (first seen ask → later asks)
- Unchanged price does not spam history (same spirit as `priceHistory`)
- Detail UI: simple “−$X since first seen (date)” or mini trail
- Hook enrich/manual refresh to append when price changes

## Out of scope
Alert delivery (06), email.

## Done when
- [ ] At least one URL shows a drop trail after refresh/simulation
- [ ] No duplicate observations for unchanged prices
