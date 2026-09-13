# Evidence coverage

The displayed percentage averages recorded-input coverage across applicable scoring dimensions. It is not a probability, a rating of the watch, or market-price confidence. Missing required inputs can leave a dimension unrated even when some supporting inputs are present. Unknown inputs never become fabricated scores. A verified strap-only configuration excludes the bracelet dimension.

`EvidenceCoverage` uses `evidenceBreakdown` to explain recorded and missing inputs in Collection cards/table, Value, and the detail page. Keep its input list aligned with `scoreDimensionEvidence`; changes to scoring inputs must update both and the coverage tests. Market-value confidence remains separate.

## NOMOS Club Campus night sky, ref. 719

Verified September 13, 2026 against https://nomos-glashuette.com/en-us/club/club-campus-night-sky-719:

- DUW 4001 is an in-house hand-wound movement with the NOMOS swing and DUW regulation systems. The app assigns it the same 0.80 architecture tier as DUW 3202; that tier is an app judgment, not a manufacturer rating. Reserve and regulation are scored separately.
- The product page states regulation in six positions and 53 hours of reserve.
- The listed configuration includes a vegan velour strap; metal bracelets cost extra. `braceletIncluded: false` refers to this configuration, not all offered variants.

Coverage is `(1 movement + 1 wearability + 0 case construction + 2/3 durability) / 4 = 66.7%`. Case-construction flags and antimagnetic rating stay unknown unless separately verified. Do not mark unmentioned features false to increase coverage.
