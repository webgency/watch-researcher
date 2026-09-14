# Workflow review: completing decisions in context

Reviewed September 14, 2026 against main `5994a10`. This is a proposal, not a shipped workflow change. The mobile Value presentation is separate in PR #68.

## Finding

Vitrine explains its evidence rules more successfully than it helps someone satisfy them. Small research tasks frequently lead to the general watch editor. The user must translate a goal into fields, remember why they left, save unrelated form state, and reconstruct the decision afterward.

The recommended interaction is: **act where the question appears → review only the relevant inputs → save → see the decision update in place**. Keep the full editor for broad watch maintenance.

## What was verified

- In the production browser at 390px: choose Omega Seamaster as the next watch for Fitzroy Auto, then click **Add dated asks**. The destination is `/watch/w24/edit`, with no section anchor or return context.
- That edit form contains 45 input/select/textarea controls. Its Retailer links section begins approximately 4,225px down the document in this state. These are measurements of this watch and viewport, not universal values.
- Use the edit page's Back link: the trade-up candidate is empty again. Save also routes to the bare detail URL; no candidate or calculation basis is persisted by the trade-up component.
- **Add sold comp** already opens an inline form without leaving the detail page. No sale was saved during the review.
- Code inspection covered trade-up, Market, the general watch form and scrape path, Price, Alerts, and the update/store boundary. No collection or alert records were modified for this review.

This is an expert walkthrough plus the owner's reported friction, not a multi-user usability study. Expected benefits below should be verified through task testing.

## Prioritized opportunities

| Priority / severity | Observed friction | Proposed behavior | UX principle |
| --- | --- | --- | --- |
| 1 / Major | Trade-up's “Add dated asks” leaves the comparison for the full editor and loses the candidate on return. | **Add pre-owned listing** opens beneath the evidence gap. Preserve the candidate and ask/target choice; update the range and difference after saving. | Recognition rather than recall; efficiency |
| 1 / Major | Market's Asks section has no add/edit action. Empty states explain requirements but offer no direct way to satisfy them. | Add **Add listing** to the section and **Update price** to each row. Reuse the same focused listing form used in trade-up. | Help in context; user control |
| 1 / Major | “0 of 2 sources” states the rule but cannot diagnose why a particular link does not count. | Show qualifying listings and excluded listings with specific reasons: missing price/date, new condition, duplicate source. Offer the corresponding repair beside the row. | Visibility of status; error recovery |
| 1 / Major | A selected candidate without an offer/target says to open another watch to add one. | **Add candidate listing** or **Set target** edits the selected candidate in place, explicitly naming the watch being changed. | Recognition rather than recall; error prevention |
| 2 / Major | “Refresh from retailer” uses the broad autofill routine, which can populate brand, model, image, tracked price, specs, and tags as well as the link. | Separate **Check listing price** from **Refresh watch details**. Review the listing's old/new price and observation date before saving only that listing. | Match task to action; error prevention |
| 2 / Major | Targets are visible in decision surfaces but edited in the general form. | Add **Set target / Edit target** beside the displayed target. Save amount and currency locally, then show the updated comparison and alert rule. | Efficiency; visibility of status |
| 2 / Moderate | Sold comps are easier to add than asking-price evidence, yet they do not feed the current trade-up estimate. | Preserve inline entry; use **Record a completed sale** and label recorded sales as context. Say near the estimate that it uses asking prices. Never silently substitute one evidence type for another. | Consistency; match to the real world |
| 2 / Moderate | Price history tells the reader to run the enrich script; stale evidence has a warning but no contextual refresh action. | Provide **Update price** and **Check listing** in the app. Distinguish a changed price from “checked today, unchanged.” | Help in context; visibility of status |
| 2 / Moderate | Alerts offer global settings and event-level mute actions, while the related watch page has no clear alert setup summary. | Add compact watch-level alert status: enabled types, target, and mute state, linking to global settings. Confirm saves inline and retain the existing error feedback. | Consistency; visibility of status |
| 2 / Moderate | Published pages hide write actions but still describe tasks requiring writes. | Show a contextual read-only explanation where a local write action would appear. Do not imply that Pages can save; offer an editable-app destination only if one is actually configured. | Visibility of status; error prevention |
| 3 / Moderate | Trade-up's 69-item alphabetic candidate select omits shortlist priority and requires scanning a long list. | Search candidates by name; optionally show next-purchase and must-have candidates first, with all candidates still available. Persist the selection and basis in the URL. | Recognition rather than recall; efficiency |

These principles draw on [Nielsen's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/). Keeping the complete editor available while exposing only task-relevant fields follows [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/). The recommendations are applications to this code and observed workflow, not claims that those sources evaluated Vitrine.

## The first flow to improve

1. Open an owned watch and choose a wishlist candidate. Both watches remain named throughout the task.
2. The estimate says **Add 2 pre-owned listings to estimate your watch's asking range**, with one primary action: **Add pre-owned listing**. At one source, say **Add 1 more qualifying source**.
3. An inline form opens there. Show listing URL, asking price/currency, condition, and **Price seen on**. Derive the source from the URL. Preselect pre-owned for this entry point but allow correction. Do not assume an unknown imported condition.
4. Allow manual entry immediately. URL extraction is optional assistance: show loading, retain the URL on failure, and allow review before any write. The first implementation need not add scraping to deliver the main usability improvement.
5. Before saving, explain whether the listing will count. A second link on the same site must not promise a second independent observation: the current engine groups by normalized hostname. Also show missing dates/prices and condition mismatches. Saving a useful but excluded listing can remain allowed with an explicit explanation.
6. Save the listing, keep the form's context and selected candidate, and update progress in place. After one source: **Listing saved. One more qualifying source needed.** After two: display low/median/high, confidence, freshness, and the resulting difference.
7. Use a plain result heading such as **Additional amount needed**, with **Candidate costs less** for a negative result. Explain the signed range nearby. Asking prices remain distinct from actual sale proceeds; fees and shipping remain excluded.

On mobile, prefer a short form that expands in place. If extraction review later grows substantially, a focused sheet could hold it, but it must retain the underlying comparison and return focus on close. Avoid a full-page wizard for each listing.

## Shared interaction rules

- One listing editor, used from Market and Trade-up with the relevant watch and condition supplied by the entry point.
- Keep the selected candidate even while updating that candidate's evidence or target. Show “Adding a listing for [watch]” to prevent edits to the wrong watch.
- Keep drafts after failed saves. Show field-specific errors, Saving, a concise saved confirmation, and explicit Cancel. Keyboard focus enters the form and returns to its trigger.
- Recompute from saved data after success. Do not update an estimate optimistically from an unsaved listing.
- Save only the task's fields. Preserve other links, listing history, watched targets, prices, and scores. Fetch the current collection under the write lock before appending/updating a listing; sending a stale whole links array can erase another edit.
- Reuse store validation, `carryAskHistories`, and existing alert recording. Unchanged prices must not append history entries. A confirmation date can change independently of the price-move series.
- Preserve evidence gates and ask/sold separation. “Make it easier” must not mean treating missing values as estimates, counting the headline twice, or changing scores.

## Suggested delivery sequence

**First PR — complete trade-up evidence in place.** Add the shared manual listing editor to Market/Trade-up; eligibility feedback; save/error/confirmation states; persistence of candidate and basis; and a clear published-mode message. This directly removes the editor detour without requiring more market data or a scraper redesign.

**Second PR — finish the price decisions.** Inline candidate listing/target actions, watch target editing, and scoped listing refresh with a review step. Keep watch-wide autofill separately named.

**Third PR — connect monitoring.** Watch-level alert status/settings and actionable stale-price states. Bring the existing inline sold-comp form into the same interaction conventions.

The long candidate dropdown and terminology cleanup can accompany the first PR if they stay small. Authentication, a hosted write backend, new valuation formulas, and automated market crawling are separate projects.

## Acceptance tasks

- From an owned watch, select a candidate, add one valid listing, then a second independent listing; never leave the page, lose the selection, or re-enter watch identity.
- Add a same-site listing, omit a date, or choose new condition; understand exactly why the evidence count did not increase.
- Simulate a failed save; correct or retry with the draft intact and no displayed estimate from unsaved input.
- Change a candidate target in place and distinguish a planning amount from an available listing.
- Refresh an unchanged ask: show a newer confirmation date without adding a fake price move.
- Repeat the flow at 320px and by keyboard; verify focus, readable errors, and no horizontal overflow.
- On the published site, understand why saving is unavailable without encountering a broken button.
- Use explicit test fixtures for automated behavior. Real-data numeric acceptance still requires independently verified listings; do not invent collection evidence to close that checkbox.

## Implementation evidence

- `src/components/TradeUpPanel.tsx:22` — candidate and basis are local state; `:74` links to the general editor; `:130` sends missing candidate evidence elsewhere.
- `src/components/WatchForm.tsx:160` — broad URL autofill; `:341` returns to bare detail; `:614` retailer-link editor.
- `src/components/MarketChapter.tsx:162` — asks display and evidence counts; `:325` documents sold/ask separation.
- `src/components/AddSoldComp.tsx:76` — existing inline-entry precedent.
- `src/components/PriceHistoryPanel.tsx:90` — script instruction in product copy.
- `src/components/AlertAction.tsx:37` — immediate setting updates and failure feedback.
- `src/lib/valuation.ts:134` — hostname source grouping; `src/lib/store.ts:69` — history and alert preservation in updates.
