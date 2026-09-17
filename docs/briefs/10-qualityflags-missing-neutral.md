# 10 — Quality flags: missing ≠ false (+ diver scrape mapping)

**PR title:** `fix: treat unknown qualityFlags as neutral; infer AR; enrich diver flags`  
**Depends on:** none (safe alongside 08/09); pair with brief 09 scrape coverage if touching `scrape.ts`  
**Refs:** `docs/briefs/00-working-agreements.md`; known under-call: Baltic Aquascaphe MK2 Blue (high design × muted rubric from empty flags) vs hand-flagged peers (e.g. UBIQ Trek Aqualight)

## Problem

Value rubric rewards filled `qualityFlags` (`arCoated`, `quickRelease`, `braceletIncluded`, `microAdjustClasp`, `hardenedCoatingHv`, …). Autofill/scrape often **omits** flags. Omitted is scored like **feature absent**, so a cheap entry with hand-filled flags outranks a better diver with a thin row. Matrix can push the thin row toward “aspirational” (high design × soft value) even when the real PDP has double-dome sapphire + internal AR + sapphire bezel + 200 m.

This is a **data-honesty** bug, not a request to bake brand prestige into the rubric.

## Goals

1. **Unknown flags are neutral** — never the same as `false`.
2. **Safe inference** from `specs.crystal` (and enrich/scrape) so AR is not left blank when the text already says so.
3. **Quiet UI honesty** when value may be understated due to incomplete flags.
4. **Scrape/enrich** maps common diver PDP language → flags (Baltic-class).

## Implement

### A. Tri-state flags in scoring (P0)

Find the rubric / quality contribution in `src/lib/scoring.ts` (and helpers in `rubrics.ts` / related). For each boolean-ish quality flag:

- `true` → award as today  
- `false` → withhold award / apply absence logic as today **only when explicitly false**  
- **missing / `undefined` / `null`** → **contribute 0** (no award, no “missing feature” penalty)

Add unit tests: identical specs+price, one watch with empty `qualityFlags`, one with `arCoated: false` explicitly — empty must score **≥** the explicit-false case on the flag component; empty must not lose to a peer solely for omitted AR when crystal text is unused (see B).

Do **not** change wishlist tiers, deal ≥2 dated sources rule, or overlap FYI rules.

### B. Crystal → `arCoated` inference (P0)

At score time **or** enrich (prefer one place; document which):

- If `qualityFlags.arCoated` is not explicitly `false`, and `specs.crystal` matches `/AR|anti-?reflective|antireflex/i`, treat as `arCoated: true` for scoring (and optionally persist on enrich).
- If crystal clearly states sapphire with no AR language, leave `arCoated` unknown (neutral), do not invent `false`.

Unit test with crystal strings like `"Double-dome sapphire, internal AR"` and `"Saphirglas, Antireflex"`.

### C. Incomplete-data chip (P0 UI)

On value list / detail (VFM surfaces): if core specs exist (crystal and/or WR) but key flags are still unknown after inference, show a quiet chip/hint: **“Incomplete specs — value may be understated”**. Not a second verdict; no emoji; follow `docs/branding.md`.

### D. Scrape / enrich mapping for diver PDPs (P1)

In `src/lib/scrape.ts` / enrich path, when PDP text states it, set:

| Signal | Write |
|--------|--------|
| Internal / anti-reflective / Antireflex | `qualityFlags.arCoated: true` |
| Sapphire bezel insert | Prefer new optional `qualityFlags.sapphireBezel: true` **if** you extend the type + rubric; else append clear phrase to `specs.complications` / crystal notes — do not silently drop |
| Screw-down crown | Optional `qualityFlags.screwDownCrown: true` if you extend type; else notes/specs only |
| Quick-release straps | `qualityFlags.quickRelease: true` |
| Bracelet included in base price vs +option | `braceletIncluded: true` only when included in the tracked ask |
| Micro-adjust clasp | `microAdjustClasp: true` when stated |

**Fixture:** save a trimmed Baltic Aquascaphe MK2 Blue PDP HTML (or mock) asserting: WR 200, sapphire crystal + internal AR → `arCoated`, sapphire bezel language captured, rubric not muted vs empty-flag clone at same price.

If adding new flag keys, update `types.ts`, validation, WatchForm toggles, and rubric weights in the same PR (small, explicit).

### E. Deal score (P2 — document only unless trivial)

Deal still needs ≥2 independent **dated** `links[]` (`valuation.ts`). One brand URL → weak deal. Do not fabricate a second source. Optional: UI copy that deal confidence is low with a single observation (if not already clear).

## Out of scope

- Baking brand prestige / “Baltic always wins” into rubric (use `friction.brandLiquidity` + human judgment)
- Bulk Chrono24/eBay crawlers
- Changing deal ≥2 rule math beyond honesty copy
- Wishlist tier demotion (brief 08) / multilingual scrape anchors (brief 09) except shared scrape touchpoints
- Manual one-off `watches.json` edits for a single SKU (user can patch data separately; this brief is engine + scrape)

## Working agreements

Add one line to `docs/briefs/00-working-agreements.md`:

- Quality flags are tri-state; **omitted ≠ false**. Rubric must not punish incomplete autofill.

## Done when

- [ ] Unknown flags are neutral in rubric unit tests (`true` / `false` / omit)
- [ ] Crystal→AR inference (or enrich persist) covered by a test
- [ ] Baltic-class fixture no longer under-scores purely from empty flags
- [ ] Value UI shows incomplete-data hint when applicable
- [ ] Working agreements updated
- [ ] Static GitHub Pages mode still builds
- [ ] PR title/body lists files touched

## Suggested test matrix

| Case | Expect |
|------|--------|
| Flags omit, crystal has “internal AR” | Scores as AR present (inference) |
| Flags `{ arCoated: false }`, crystal mentions AR | Explicit false wins (no force-true) |
| Flags omit, crystal “sapphire” only | Neutral on AR (no false penalty) |
| Hand-filled rich flags vs omit+inference same crystal | Same AR contribution |
