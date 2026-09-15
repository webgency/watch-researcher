# 09 — Scrape / autofill: full spec coverage (multi-locale)

**PR title:** `fix: multilingual specs scrape + thin Shopify body fallback`  
**Depends on:** none (can ship anytime; high leverage for multi-user)  
**Fixture:** `https://viiswatch.com/en/products/flieger-gmt-42-adriatic` (German SPEZIFIKATIONEN; Shopify `body_html` is marketing-only)

## Problem

Autofill often returns price + diameter + GMT and misses caliber, L2L, thickness, WR, crystal, AR, strap, quality flags.

**Root cause on Viis (and similar EU Shopify brands):**

1. `productExtractionText` in `src/lib/scrape.ts` only trusts the full HTML when it finds an **English** technical anchor (`Specifications` / `Technical Details` / `Tech Specs`).
2. Viis uses **`SPEZIFIKATIONEN`**. No English anchor → function returns **only** Shopify `body_html`.
3. Viis `body_html` is ~600 chars of marketing (“case diameter of 42 mm… GMT”) — no Kaliber / Abmessungen table.
4. Claude extraction (`extract.ts`) never sees the rich HTML; regex `extractSpecs` only sees English marketing phrases.
5. Extra: Shopify `vendor` is `"Mein Shop"` → brand becomes wrong without a domain map; German labels and `11,3` / `13,4` decimals are not matched.

This is a product-critical gap if Vitrine is offered to other collectors: **spec scrape quality is table-stakes**.

## Goals

1. Pull the same fields a careful human would from a typical brand PDP (all `SPEC_FIELDS` + relevant `qualityFlags` when stated).
2. Work for **DE / FR / ES / IT / EN** label variants without inventing values.
3. When Shopify description is thin, still use the product HTML safely.
4. Surface **scrape coverage** so thin autofill is honest (not a silent half-fill).

## Implement

### A. Multilingual technical anchors
Extend `TECHNICAL_SECTION_ANCHORS` (and heading match in `primaryProductText`) to include at least:

- DE: `SPEZIFIKATIONEN`, `Technische Daten`, `Technische Details`, `Abmessungen`
- FR: `Spécifications`, `Caractéristiques techniques`
- ES: `Especificaciones`, `Ficha técnica`
- IT: `Specifiche`, `Scheda tecnica`
- EN: keep existing

### B. Thin Shopify body → HTML fallback
In `productExtractionText`:

- If `shopifyBodyHtml` stripped length is below a threshold (e.g. **1200 chars**) **or** lacks ≥2 strong spec signals (caliber token, WR, lug-to-lug / L2L, thickness), **prefer** `primaryProductText(html)` even when no English anchor matched — as long as a multilingual anchor or a dense “label: value” block exists.
- Keep the collection-page safety: never mix sibling cards.

Add unit tests with saved Viis HTML + thin `body_html` asserting: diameter 42, L2L 49, thickness (prefer **exkl. Glas 11.3** if both present, else document choice), lug 20, Miyota 9075, WR 100, sapphire + AR, leather strap, GMT, `arCoated`, `quickRelease` if stated.

### C. Locale-aware regex (`extractSpecs` / `extractQualityFlags`)
Support DE (and common EU) labels; normalize `,` decimals (`11,3` → `11.3`):

| Field | Add patterns for |
|-------|------------------|
| diameter | `Gehäusedurchmesser`, `Durchmesser` |
| L2L | `Abstand der Bandanstöße`, `Bandanstöße`, `Horn-zu-Horn` |
| thickness | `Gehäusehöhe`, `Höhe` (prefer exkl. Glas when labeled) |
| lug width | `Anstoßbreite`, `Bandbreite` |
| WR | `Wasserdichtigkeit`, `Wasserdicht` + ATM/Bar |
| caliber | `Kaliber:` |
| crystal | `Saphirglas`, `Antireflex` → sapphire + `arCoated` |
| strap | `Armband:` / `Kalbsleder` |
| power reserve | `Gangreserve` |
| movement | `Automatik`, `Typ: Automatik` |

Do **not** invent; only match explicit labels.

### D. Brand / identity
- `DOMAIN_BRANDS["viiswatch.com"] = "VIIS"` (and similar when `vendor` is a Shopify default like `Mein Shop`).
- Prefer page `Marke:` / JSON-LD brand over junk vendors.

### E. Scrape coverage (multi-user honesty)
Return and optionally show on the add form:

- `specsFound` / `specsPossible` (count of `SPEC_FIELDS` filled)
- short note: `partial — page locale or layout limited extraction` when coverage < ~60%

Never claim complete autofill when fields are blank.

### F. Working agreements
Add to `00-working-agreements.md`: scrape must not invent specs; prefer incomplete + coverage over guessed numbers; multilingual PDPs are in scope.

## Out of scope

- Headless browser / Playwright for JS-only PDPs (follow-up if needed)
- Bulk Chrono24 crawling
- Changing scoring math

## Done when

- [ ] Viis Flieger GMT 42 Adriatic fixture autofills caliber, L2L, thickness, WR, crystal/AR, strap, GMT
- [ ] Thin Shopify body no longer blocks HTML specs when SPEZIFIKATIONEN (or peers) exist
- [ ] Comma decimals parse
- [ ] Brand is VIIS not “Mein Shop”
- [ ] Coverage signal exists for partial scrapes
- [ ] Lint/typecheck + tests green
