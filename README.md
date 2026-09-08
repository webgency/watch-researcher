# ⌚ Watch Researcher

A personal app to **track your watch wishlist, judge each watch against its price band, and grow your collection** over time.

Built with Next.js (App Router) + TypeScript + Tailwind CSS. Your collection lives in a single, version-controlled JSON file (`data/watches.json`) — no database to set up, easy to back up, and you can literally commit your wishlist.

Currently tracking **67 watches** (64 wishlist, 3 owned).

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Validate, lint, and build in one go:

```bash
npm run check
```

---

## What it does

### Browsing and editing

- **Collection view** — every watch as a card, with search, status/priority filters, and sorting by wishlist priority, value vs. band, quality score, recently added, price, brand, or case size.
- **Wishlist tiers** — Next purchase, Must have, Love it, Interested, Maybe later, or Pass.
- **Add / edit watches** — one form covering basics, URL autofill, specs, image, multiple retailer links, tags, and notes.
- **Side-by-side comparison** — select 2+ watches and compare them in a spec/price table, with the best value in each row highlighted.
- **Per-watch detail page** — full specs, retailer links, notes, the peer-band standing panel, and price history.
- **Price tracking** — set a target price per watch and the collection view flags it once the all-in price drops to it. Every price change is recorded as a history entry, with the latest move and lowest recorded price shown on the detail page.
- **Dashboard stats** — totals by status and wishlist tier.
- **Overlap detection** (`/overlap`) — groups entries that would be the same purchase, so a 60-item wishlist becomes a handful of decisions. Each watch's own page warns when it has a twin.

### Scoring

The app's opinionated half. It answers "is this watch good *for its money*?" while keeping your taste separate from the arithmetic.

- **Peer-band standing** (`/watch/[id]`) — five dimensions (movement, case & finishing, wearability, durability, bracelet) scored 0–1 against a fixed rubric for the watch's **category** (diver / chronograph / GMT / dress) and **price band** (under $500 → $5000+). Shows which dimensions beat or trail par for that band and how much evidence supports the composite.
- **Design rank** (`/design`) — your own 1–5 read on how a watch looks. Deliberately the one judgement in the app that is yours rather than calculated.
- **Value matrix** (`/value`) — value-vs-band on one axis, your design rank on the other, splitting the collection into buy / aspirational / sensible / skip quadrants.
- **Overlap** (`/overlap`) — entries in the same category, within 1.5mm of case diameter and 1.5x on the all-in price, grouped as one decision. Each group names its value leader and your design leader **separately**, because the useful case is the one where they disagree. A watch missing a category, a diameter, or a price is listed as unchecked with the reason, never grouped on a guessed value.

Three principles hold the model together, and they're worth preserving if you extend it:

1. **Missing data is never a zero.** A dimension without source data comes back `undefined` and is excluded from the composite — the UI shows "unrated" with the reason, rather than a score the data doesn't support.
2. **Friction is never numeric.** Availability, bracelet upcharges, and thin secondary markets render as text chips and never enter a score.
3. **Par is absolute, not relative.** A watch at exactly its band's rubric reference scores 0.5, so the split doesn't drift as you add watches. Peer groups here are small (2–4 watches), so percentile ranking only appears once a group has n ≥ 6.

---

## Data model

Each watch (`src/lib/types.ts`):

| Field | Notes |
| --- | --- |
| `brand`, `model` | required |
| `referenceNumber` | optional |
| `status` | `wishlist` \| `owned` \| `sold` |
| `wishlistTier` | next purchase, must have, love it, interested, maybe later, pass |
| `designUniqueness` | your 1–5 design rank; drives the value matrix's vertical axis |
| `price` | `{ amount, currency }` — the headline price you're tracking |
| `priceUpdatedAt` | ISO timestamp, set by the enrich script |
| `priceHistory[]` | every distinct price seen, oldest first — appended to only when the price actually moves |
| `targetPrice` | "ping me under $X"; compared against the all-in landed price |
| `landedPrice` | all-in cost (base + bracelet delta + shipping + duty); falls back to `price` |
| `links[]` | retailer links, each with optional price + `new`/`pre-owned` condition |
| `specs` | case diameter, thickness, lug-to-lug, lug width, material, movement, caliber, power reserve, water resistance, crystal, dial, bracelet/strap, complications |
| `qualityFlags` | verifiable engineering details feeding the score — regulation, accuracy spec, coating hardness, antimagnetism, sapphire bezel, drilled lugs, micro-adjust clasp, quick-release, bracelet included, AR layers |
| `friction` | availability, expected ship date, bracelet upcharge, brand liquidity — **never** folded into a score |
| `scoringCategory` | Explicit `diver`, `gmt`, `chronograph`, or `dress` rubric; use this for hybrid watches |
| `tags[]` | Descriptive labels; a single unambiguous legacy category tag can still infer `scoringCategory` |
| `notes` | free text |
| `purchase`, `sale` | filled in as a watch moves through `owned` → `sold` |

Spec fields are defined once in `src/lib/specs.ts` and drive the form, detail view, and comparison table — add a field there and it appears everywhere.

### Editing data directly

Edit `data/watches.json` by hand, or use the in-app forms (which write to the same file via the API in `src/app/api/watches`). Validate hand edits before committing:

```bash
npm run validate:data
```

This checks enum values, types, and **spec plausibility** (`src/lib/spec-ranges.mjs`) — it will reject a 200mm case or a lug-to-lug shorter than the diameter.

---

## Data-maintenance scripts

All need real outbound network access, so run them from a local terminal. The cloud sandbox routes traffic through an egress proxy that blocks retailer domains.

```bash
node scripts/enrich-watches.mjs --dry
```

Scrapes price and image from each watch's retailer links. `--dry` reports only; `--force` overwrites existing values; `--id=foo` limits to one watch.

**`--refresh` is what builds price history.** The default run only fills gaps, so it never re-reads a price it already has and therefore never observes a move. Run it on a schedule to accumulate a series:

```bash
node scripts/enrich-watches.mjs --refresh
```

```bash
node scripts/backfill-specs.mjs --dry --limit=5
```

Fills missing specs, tags, and quality flags via the Claude API with web search. Conservative by design: only fills gaps, never overwrites, and drops implausible readings. Needs `ANTHROPIC_API_KEY`. `friction` is deliberately excluded — it goes stale too fast and `brandLiquidity` is a judgement call.

```bash
node scripts/backfill-prices.mjs
```

One-off estimated prices for retailers whose bot protection defeats the scraper. Skips any watch that already has a price.

---

## Deploying to GitHub Pages (auto-published, read-only)

`.github/workflows/deploy-pages.yml` builds a **static, read-only** export and deploys it on every push:

**https://webgency.github.io/watch-researcher/**

How it works:

- `npm run build:static` builds from a temporary prepared copy with `NEXT_PUBLIC_STATIC=true`, which switches Next.js to `output: 'export'` and adds the `/watch-researcher` base path (see `next.config.mjs`).
- `scripts/prepare-pages.mjs` strips the server-only routes from that copy — Pages can't run a server.
- Write actions (Add / Edit / Delete) are hidden, and `/design` shows a "needs the live app" placeholder since ranking writes to disk.

**One-time setup:** enable Pages under **Settings → Pages → Source: GitHub Actions**.

**Editing stays local:** add or edit watches with `npm run dev`, commit `data/watches.json`, and push — the site rebuilds automatically.

Preview the static build locally:

```bash
npm run build:static && npx serve out
```

---

## Roadmap

**Phase 2 — Price & value** *(partly done)*
- ✅ Per-band value scoring and a value matrix
- ✅ USD normalization for scoring, covering every currency the form offers — rates are a dated snapshot in `src/lib/currency-rates.mjs`, refreshed by hand (the file says how); a live rate source would remove the drift entirely
- ✅ Price-history snapshots per watch + a target-price flag ("ping me under $X")
- ⬜ Best-price surfacing across multiple retailer links
- ⬜ Actual notification when a target is met — today the collection view flags it, but nothing pushes

**Phase 3 — Collection management**
- ⬜ Richer dashboard: total spent, value by brand/movement, size distribution
- ✅ Overlap detection ("you already have a 39mm diver") — `/overlap`, plus an "also on your list" panel on each detail page
- ⬜ Service-history reminders; insurance/valuation CSV/PDF export

**Phase 4 — Convenience**
- ⬜ CSV / JSON import-export + backup
- ⬜ Mobile / PWA so you can check it in-store
- ⬜ Shareable read-only wishlist (gift hints)

---

## Notes for later

- **Auto-fetching specs from links:** the add form scrapes the retailer page when you paste a URL. Needs open outbound network access, so it works best on your own machine.
- **Editing online (instead of read-only Pages):** the JSON-file store writes to disk, which works locally and on a long-running server but **not** on serverless/static hosts. For a fully editable online version, deploy to a server host (Render / Fly / a VPS) or swap `src/lib/store.ts` for a database (SQLite / Postgres / Turso) — the function signatures stay the same, so nothing else changes.
- **Exchange rates go stale:** `src/lib/currency-rates.mjs` is a dated snapshot, not a feed. A few percent of drift can move a watch across a price band and change the rubric it's scored against. `npm run validate:data` warns once the snapshot passes `RATES_STALE_AFTER_DAYS` (90) *and* you hold something priced in a non-USD currency — it stays quiet otherwise, since drift can't affect an all-USD collection. The file documents the one-liner to refresh.
- **Caliber coverage:** `CALIBER_TIER_PATTERNS` in `src/lib/scoring.ts` is a hand-maintained substring table. An unrecognized caliber leaves `movement` unrated rather than guessing, so adding watches from new movement families means adding entries there.

---

## Project structure

```
src/
  app/
    page.tsx                 # collection
    compare/page.tsx         # side-by-side comparison
    value/page.tsx           # value matrix (value vs. design rank)
    overlap/page.tsx         # groups of entries that are the same purchase
    design/page.tsx          # design ranker
    watch/new/page.tsx       # add form
    watch/[id]/page.tsx      # detail + standing panel
    watch/[id]/edit/page.tsx # edit
    api/watches/...          # REST API (GET/POST/PUT/DELETE) + /scrape
  components/                # CollectionView, WatchCard, CompareTable, WatchForm,
                             # ValueMatrix, DesignRanker, StandingPanel, ...
  lib/
    types.ts                 # domain model
    scoring.ts               # standing engine, design score, quadrants
    overlap.ts               # duplicate-purchase grouping
    rubrics.ts               # dimensions, price bands, per-category rubric tables
    store.ts                 # JSON-file persistence
    validation.ts            # runtime input/data validation
    specs.ts                 # spec field definitions
    spec-ranges.mjs          # plausibility bounds, shared with validate-data
    brands.ts                # brand catalog lookup
    scrape.ts / extract.ts   # retailer page fetching + field extraction
    config.ts                # IS_STATIC flag
    format.ts                # currency / date helpers
data/
  watches.json               # your collection (version-controlled)
  brands.json                # brand reputation tiers
scripts/                     # enrich, backfill, validate, static-build helpers
```

Tests live next to their subjects (`src/lib/scoring.test.ts`, `src/lib/extract.test.ts`) and run with `npm test`.
