# 06 — P1c In-app alerts

**PR title:** `feat: in-app market alerts (P1c)`  
**Depends on:** 04; 05 for price_drop  
**Full spec:** `docs/prd-p1-market-intel-trade-up.md` §7.3, 11 P1c

## Implement

- Alert types: `target_met`, `price_drop` (default ≥5%), `fresh_offer`
- In-app feed page or `/value` section + mute; email optional later
- Dedupe: one per watch+type per 24h unless price improves
- Cite sources + as-of; never claim missing sold data

## Out of scope
Push/mobile native, marketing email blasts, paid Stripe gate (document Pro later only).

## Done when
- [ ] target_met and price_drop work in dogfood
- [ ] Dedupe behaves
- [ ] Copy is collector-framed, not flip-framed
