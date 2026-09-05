# Phase 1: scoring integrity

## Goal

Make every value comparison explainable and honest about the evidence behind it, without mixing acquisition friction or personal taste into the numeric score.

## Scope

- Give each watch an optional, explicit scoring category (`diver`, `chronograph`, `gmt`, or `dress`).
- Use legacy tags only as a backwards-compatible category inference. Ambiguous or unrecognized tags do not silently become `dress`.
- Calculate case, bracelet, and durability dimensions from recorded sub-inputs only. Recorded absence is evidence; an omitted field is not.
- Weight composite quality by the amount of evidence behind each rated dimension.
- Publish an overall evidence percentage and `low`, `medium`, or `high` confidence label beside the score.
- Normalize prices to USD for sorting and comparison highlighting while displaying the original currency.
- Cover the caliber names already present in the collection.

## Non-goals

- Acquisition friction remains descriptive and never enters a score.
- Design rank remains subjective and separate from value.
- Price-band expectations remain absolute in this phase; continuous price interpolation is a later change.
- No live exchange-rate or notification service is introduced.

## Scoring contract

Each rated dimension returns a verified-capability score and evidence coverage. Coverage is the fraction of that dimension's available inputs that were actually recorded. Unknown features add no verified points, but they also reduce coverage and therefore the dimension's influence on the composite. A thinly supported dimension cannot carry the same influence as a fully documented one.

For tri-state fields, `false` is recorded evidence of absence and `undefined` is unknown. Unknown inputs are excluded from the dimension calculation rather than converted to zero.

Confidence is derived from evidence coverage across applicable dimensions:

- High: at least 80%
- Medium: at least 50%
- Low: below 50%

A strap-only watch excludes bracelet from the applicable evidence denominator. A watch without a scoring category can still show raw technical dimensions, but it cannot receive a price-band value score.

## Acceptance criteria

- A missing durability, finishing, or bracelet sub-input never reduces its dimension score.
- Adding a recorded `false` value can legitimately change a score and increases evidence coverage.
- Unknown and ambiguous categories do not receive a value score.
- Existing unambiguous tag-based watches remain compatible.
- Current recorded calibers resolve to a tier.
- EUR, GBP, JPY, and other supported currencies sort and highlight by normalized value.
- The detail and collection views state score confidence.
- Data validation accepts only supported explicit scoring categories.
- Unit tests cover incomplete evidence, ambiguous category handling, confidence thresholds, caliber aliases, and normalized price comparisons.

## Follow-up phases

1. Replace price-band steps with continuous price interpolation.
2. Redesign the mobile header and progressively disclose the watch form.
3. Make the value matrix filterable and reduce point collisions.
4. Add best-offer, landed-cost, price-freshness, and target-notification workflows.
