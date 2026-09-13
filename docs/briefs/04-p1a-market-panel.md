# 04 — P1a Market panel + sold comps

**PR title:** `feat: market panel and sold comps (P1a)`  
**Depends on:** 02 (layout slots) recommended  
**Full spec:** `docs/prd-p1-market-intel-trade-up.md` §§6–7.1, 7.5, 11 P1a

## Implement

1. Watch detail **Market** chapter:
   - Best dated ask (existing `bestOffer`)
   - Fair band when `dealScore` / `marketValueSummary` sufficient; else explicit insufficient
   - List dated `links[]` with source, condition, as-of, freshness
   - Retail/headline price clearly separated from asks
2. Optional `soldComps[]` on watch (or equivalent) + manual entry path when not `IS_STATIC`
3. UI separates **Asks** vs **Solds**; never invent solds
4. Confidence copy: Insufficient / Low / Medium / High — consistent chips

## Out of scope
Alerts, listing drop trail (05), trade-up (07), bulk scrapers.

## Done when
- [ ] Market chapter live on detail
- [ ] Insufficient states honest
- [ ] Sold comps render when present
- [ ] Tests: headline price not counted as second source
