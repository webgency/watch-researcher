# 00 — Working agreements (read first)

**Repo:** `webgency/watch-researcher`  
**Product name in UI:** Vitrine (repo path / GitHub Pages base may still be `watch-researcher`)

## Always

- Follow `docs/branding.md` (Manrope, cocoa/azalea). Do not reintroduce slate-only chrome or emoji logos.
- Never invent prices, sold comps, or provenance.
- Deal / market rules stay honest: ≥2 independent **dated** retailer sources for fair bands; headline `price` is **not** a second observation (`src/lib/valuation.ts`).
- Overlap / similar-dial notes are FYI only — never change wishlist tiers or scores.
- Prefer small PRs; match existing Tailwind / `.card` / `.btn-*` / `.input` patterns in `src/app/globals.css`.
- Preserve static GitHub Pages mode (`IS_STATIC`) and local editable mode.

## Never in these phases

- Auth / Stripe / multi-tenant SaaS (schema-ready comments OK only where a brief says so)
- Bulk Chrono24/eBay crawlers
- Click-to-buy / messaging dealers as the user
- Flip / “wealth transfer” copy
- Renaming the git repo

## Agent output

- PR with clear title/body
- Note files touched
- Call out any brief ambiguity instead of inventing product behavior
