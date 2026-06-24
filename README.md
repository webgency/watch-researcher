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

For a production build:

```bash
npm run build
npm start
```

---

## What it does today (Phase 1 — MVP)

- **Collection view** — every watch as a card, with search, status filters (wishlist / owned / sold), and sorting (recently added, priority, price, brand, case size).
- **Favorites** — heart any watch right on its card to pin it to the top. There's a "♥ Favorites" filter and a "Favorites first" sort, and favorites always float above everything else regardless of the sort you pick.
- **Quick add** — the "+ Add watch" button opens a fast form: brand, model, price, a link, and an image. Need full specs? Add them later via Edit, or jump to the "Full form".
- **Drag-and-drop images** — no scraping required. Drop an image (or click to choose) on the add/edit form and it's auto-downscaled and saved inline with the watch in `watches.json`, so it commits and publishes with the rest of your collection. You can still paste an image URL instead.
- **Add / edit watches** — a full form covering basics, specifications, multiple retailer links, tags, and notes.
- **Side-by-side comparison** — select 2+ watches and compare them in a spec/price table. The **best value in each row is highlighted** (lowest price, larger power reserve, etc.).
- **Per-watch detail page** — full specs, all retailer links, and notes.
- **Dashboard stats** — total watches, wishlist count, owned count, and total wishlist value (grouped per currency).

The collection comes pre-seeded with **32 watches from your wishlist**.

> **Heads-up on the seeded data:** brand, model, reference number, links, and tags were taken straight from your links. Case sizes, movements, and well-known calibers (e.g. Omega 8800, Longines L888/L688, Tudor MT5450-U, Certina Powermatic 80) were pre-filled where they could be identified with confidence — **please double-check them**. **Prices were intentionally left blank** so you can enter the figure you're actually tracking. Just open any watch and hit **Edit**.

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
| `priority`, `grail` | wishlist ranking + "grail" flag |
| `notes` | free text |
| `purchase`, `sale` | filled in as a watch moves through `owned` → `sold` |

Spec fields are defined once in `src/lib/specs.ts` and drive the form, detail view, and comparison table — add a field there and it appears everywhere.

### Editing data directly

You can edit `data/watches.json` by hand if you prefer, or use the in-app forms (which write to the same file via the API in `src/app/api/watches`).

---

## Deploying to GitHub Pages (auto-published, read-only)

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) builds a **static, read-only** export of your collection and deploys it to GitHub Pages on every push, so you can browse, search, sort, and compare from any device:

**https://webgency.github.io/watch-researcher/**

How it works:

- The build runs with `NEXT_PUBLIC_STATIC=true`, which switches Next.js to `output: 'export'` and adds the `/watch-researcher` base path (see `next.config.mjs`).
- `scripts/prepare-pages.mjs` removes the server-only routes (the JSON API and the add/edit forms) — Pages can't run a server.
- Write actions (Add / Edit / Delete) are hidden on the published site, which shows a "read-only" banner.

**One-time setup:** enable Pages under **Settings → Pages → Source: GitHub Actions** (the workflow token can't create the Pages site automatically in all orgs).

**Editing stays local:** add or edit watches with `npm run dev`, commit `data/watches.json`, and push — the site rebuilds automatically.

To preview the static build locally:

```bash
NEXT_PUBLIC_STATIC=true npm run build && npx serve out
```

## Roadmap — growing the collection

**Phase 2 — Price & value**
- Price-history snapshots per watch + a target-price flag ("ping me under $X")
- Best-price surfacing across multiple retailer links
- Currency conversion to a single home currency

**Phase 3 — Collection management**
- Status workflow (wishlist → bought → owned → sold) with purchase/sale price & dates
- Richer dashboard: total spent, value by brand/movement, size distribution
- Wishlist prioritisation & budget planning ("what's next")
- Overlap detection ("you already have a 39mm diver")
- Service-history reminders; insurance/valuation CSV/PDF export

**Phase 4 — Convenience**
- **Link auto-fetch**: paste a URL → auto-fill specs, price, and image (see note below)
- CSV / JSON import-export + backup
- Mobile / PWA so you can check it in-store
- Shareable read-only wishlist (gift hints)

---

## Notes for later

- **Auto-fetching specs from links:** this would scrape the retailer page when you paste a URL. It needs open outbound network access, so it should run on your own machine (or a self-hosted deployment) rather than a locked-down sandbox. The data model already supports everything it would populate.
- **Editing online (instead of read-only Pages):** the JSON-file store writes to disk, which works locally and on a long-running server but **not** on serverless/static hosts. For a fully editable online version, deploy to a server host (Render / Fly / a VPS) or swap `src/lib/store.ts` for a database (SQLite / Postgres / Turso) — the function signatures stay the same, so nothing else changes.

---

## Project structure

```
src/
  app/
    page.tsx                 # collection
    compare/page.tsx         # side-by-side comparison
    watch/new/page.tsx       # add
    watch/[id]/page.tsx      # detail
    watch/[id]/edit/page.tsx # edit
    api/watches/...          # REST API (GET/POST/PUT/DELETE)
  components/                # CollectionView, WatchCard, CompareTable, WatchForm, ...
  lib/
    types.ts                 # domain model
    store.ts                 # JSON-file persistence
    specs.ts                 # spec field definitions
    format.ts                # currency / date helpers
data/
  watches.json               # your collection (version-controlled)
```
