# ⌚ Watch Researcher

A personal app to **track your watch wishlist, compare specs and prices side by side, and grow your collection** over time.

Built with Next.js (App Router) + TypeScript + Tailwind CSS. Your collection lives in a single, version-controlled JSON file (`data/watches.json`) — no database to set up, easy to back up, and you can literally commit your wishlist.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

For validation and a production build:

```bash
npm run check
npm start
```

---

## What it does today (Phase 1 — MVP)

- **Collection view** — every watch as a card, with search, status/desirability filters, and sorting (desirability, recently added, price, brand, case size).
- **Wishlist tiers** — categorize each watch as Next purchase, Must have, Love it, Interested, Maybe later, or Pass.
- **Add / edit watches** — one full form covering basics, URL autofill, specifications, image, multiple retailer links, tags, and notes.
- **Side-by-side comparison** — select 2+ watches and compare them in a spec/price table. The **best value in each row is highlighted** (lowest price, larger power reserve, etc.).
- **Per-watch detail page** — full specs, all retailer links, and notes.
- **Dashboard stats** — total watches, next-purchase count, must-have count, and owned count.

The collection comes pre-seeded with **36 watches from your wishlist**.

> **Heads-up on the seeded data:** brand, model, reference number, links, and tags were taken straight from your links. Case sizes, movements, and well-known calibers (e.g. Omega 8800, Longines L888/L688, Tudor MT5450-U, Certina Powermatic 80) were pre-filled where they could be identified with confidence — **please double-check them**. Prices are tracked where they were available; edit any watch to adjust the figure you're actually tracking.

---

## Data model

Each watch (`src/lib/types.ts`):

| Field | Notes |
| --- | --- |
| `brand`, `model` | required |
| `referenceNumber` | optional |
| `status` | `wishlist` \| `owned` \| `sold` |
| `price` | `{ amount, currency }` — the price you're tracking |
| `links[]` | retailer links, each with optional price + `new`/`pre-owned` condition |
| `specs` | case diameter, thickness, lug-to-lug, lug width, movement, caliber, power reserve, water resistance, crystal, dial, bracelet/strap, complications |
| `tags[]` | e.g. `diver`, `GMT`, `chronograph` |
| `wishlistTier` | desirability bucket: next purchase, must have, love it, interested, maybe later, or pass |
| `notes` | free text |
| `purchase`, `sale` | filled in as a watch moves through `owned` → `sold` |

Spec fields are defined once in `src/lib/specs.ts` and drive the form, detail view, and comparison table — add a field there and it appears everywhere.

### Editing data directly

You can edit `data/watches.json` by hand if you prefer, or use the in-app forms (which write to the same file via the API in `src/app/api/watches`).

Validate hand edits before committing:

```bash
npm run validate:data
```

---

## Deploying to GitHub Pages (auto-published, read-only)

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) builds a **static, read-only** export of your collection and deploys it to GitHub Pages on every push, so you can browse, search, sort, and compare from any device:

**https://webgency.github.io/watch-researcher/**

How it works:

- `npm run build:static` builds from a temporary prepared copy with `NEXT_PUBLIC_STATIC=true`, which switches Next.js to `output: 'export'` and adds the `/watch-researcher` base path (see `next.config.mjs`).
- `scripts/prepare-pages.mjs` removes the server-only routes from that temporary copy — Pages can't run a server.
- Write actions (Add / Edit / Delete) are hidden on the published site, which shows a "read-only" banner.

**One-time setup:** enable Pages under **Settings → Pages → Source: GitHub Actions** (the workflow token can't create the Pages site automatically in all orgs).

**Editing stays local:** add or edit watches with `npm run dev`, commit `data/watches.json`, and push — the site rebuilds automatically.

To preview the static build locally:

```bash
npm run build:static && npx serve out
```

## Roadmap — growing the collection

**Phase 2 — Price & value**
- Price-history snapshots per watch + a target-price flag ("ping me under $X")
- Best-price surfacing across multiple retailer links
- Price refreshes that keep all tracked prices normalized to USD

**Phase 3 — Collection management**
- Status workflow (wishlist → bought → owned → sold) with purchase/sale price & dates
- Richer dashboard: total spent, value by brand/movement, size distribution
- Wishlist tier insights & budget planning ("what's next")
- Overlap detection ("you already have a 39mm diver")
- Service-history reminders; insurance/valuation CSV/PDF export

**Phase 4 — Convenience**
- **Link auto-fetch improvements**: price-history snapshots and richer retailer-specific parsers
- CSV / JSON import-export + backup
- Mobile / PWA so you can check it in-store
- Shareable read-only wishlist (gift hints)

---

## Notes for later

- **Auto-fetching specs from links:** the add form scrapes the retailer page when you paste a URL. It needs open outbound network access, so it works best on your own machine or a self-hosted deployment.
- **Editing online (instead of read-only Pages):** the JSON-file store writes to disk, which works locally and on a long-running server but **not** on serverless/static hosts. For a fully editable online version, deploy to a server host (Render / Fly / a VPS) or swap `src/lib/store.ts` for a database (SQLite / Postgres / Turso) — the function signatures stay the same, so nothing else changes.

---

## Project structure

```
src/
  app/
    page.tsx                 # collection
    compare/page.tsx         # side-by-side comparison
    watch/new/page.tsx       # add form
    watch/[id]/page.tsx      # detail
    watch/[id]/edit/page.tsx # edit
    api/watches/...          # REST API (GET/POST/PUT/DELETE)
  components/                # CollectionView, WatchCard, CompareTable, WatchForm, ...
  lib/
    types.ts                 # domain model
    store.ts                 # JSON-file persistence
    validation.ts            # runtime input/data validation
    specs.ts                 # spec field definitions
    format.ts                # currency / date helpers
data/
  watches.json               # your collection (version-controlled)
```
