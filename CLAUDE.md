# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A personal Next.js (App Router) + TypeScript + Tailwind app for tracking a watch wishlist. The collection is a single version-controlled JSON file — `data/watches.json`, 55 watches — read and written through `src/lib/store.ts`. There is no database.

## Commands

```bash
npm run check          # validate:data + lint + build — run this before proposing a change is done
npm test               # vitest, 41 tests
npm run dev            # local dev server
npm run validate:data  # data-only check; fast, run after any edit to watches.json
npm run build:static   # GitHub Pages export, into out/
```

## Architecture notes

**`data/watches.json` is the source of truth.** The in-app forms rewrite the whole file, which reorders keys — so a one-field edit can show up as a 500-line diff. When reviewing a change to this file, diff it *semantically* (parse both sides and compare field by field) rather than reading the raw patch, or you will badly misjudge the scope.

**The scoring engine is the opinionated part** — `src/lib/scoring.ts` (standing engine, design score, quadrants) and `src/lib/rubrics.ts` (dimensions, price bands, per-category rubric tables). Three invariants hold it together. They were each arrived at by fixing a bug where the opposite behavior misled, so preserve them:

1. **Missing data is never a zero.** A dimension without source data returns `undefined` and is excluded from the composite. `unratedReason()` explains which input is missing. Never substitute a neutral or mid value to "fill in" a gap — a fabricated score reads as a measured failure.
2. **Friction is never numeric.** `friction` (availability, bracelet upcharge, brand liquidity) renders as text chips via `frictionChips()`. It must not enter any score.
3. **Par is absolute.** A watch at its band's rubric reference scores 0.5. Peer groups are small (2–4), so they supply only the label and count; percentile ranking is gated behind `n >= 6`.

`unratedReason()` mirrors the gates in `scoreDimensions()`. Change one and the other must follow.

**`CALIBER_TIER_PATTERNS`** in `scoring.ts` is a hand-maintained substring table, ordered most-specific-first. Unknown calibers return `undefined` (unrated), never a fallback tier. Adding watches from new movement families means adding entries here.

**`src/lib/spec-ranges.mjs` is `.mjs` on purpose** — it's imported by both the TypeScript app and `scripts/validate-data.mjs`, which runs under bare Node with no build step. Don't convert it to `.ts`.

**Static export.** `IS_STATIC` (`NEXT_PUBLIC_STATIC=true`) drops dynamic rendering and hides write actions. `scripts/prepare-pages.mjs` deletes `src/app/api`, `watch/new`, and `watch/[id]/edit` from a throwaway copy before building — Pages can't run a server. Any new server-dependent route needs handling in both places.

**Spec fields are declared once** in `src/lib/specs.ts` and drive the form, detail view, and comparison table together. Add a field there, not in three components.

## Data-maintenance scripts

`scripts/enrich-watches.mjs` (scrapes prices/images) and `scripts/backfill-specs.mjs` (fills specs via the Claude API with web search; needs `ANTHROPIC_API_KEY`) require **real outbound network access**. The cloud sandbox blocks retailer domains through its egress proxy — every fetch returns 403. Run them locally, and use `--dry` first.

Both are conservative: they fill gaps and never overwrite. Keep it that way.

## Conventions

- Comments explain *why*, especially in the scoring code, where several constants encode a decision that a plausible-looking alternative got wrong. Match that density — don't strip the rationale comments.
- Work on a branch off `claude/epic-sagan-reqnic` (the default branch here), not directly on it.
- `.github/workflows/deploy-pages.yml` triggers on `main` and `claude/epic-sagan-reqnic`. Renaming the default branch means updating that trigger.
