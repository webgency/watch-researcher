# Watch detail presentation — 2026-09-13

## Intent

Use the Lug²Lug reference as a prompt for clearer presentation, while retaining
Vitrine's Manrope typography, cocoa/azalea palette and evidence-based decisions.

- **Hierarchy / figure-ground:** remove the image card's border, shadow and white
  surface so the watch leads. Preserve source images, proportions and colors.
  Embedded photographic backgrounds remain; this does not generate cutouts.
- **Proximity:** put the key fit and movement facts alongside identity and price.
- **Progressive disclosure:** key specs remain visible; a measurement button opens
  its schema-defined chapter, and Full specifications opens all chapters. Missing
  fields are still named inside the expanded view, never replaced with values.
- **Affordance / consistency:** the interactive specs have hover, focus and +/−
  cues, native button keyboard behavior and an expanded state. Ordinary tags stay
  passive. The full-specification control has a minimum 44px target height.

This is a design hypothesis, not evidence of improved task completion. Review by
finding case dimensions, opening movement details, and reaching market evidence
on desktop and phone. No scoring, watch data or market calculations change.

Sources: [NN/g: visual design principles](https://www.nngroup.com/articles/principles-visual-design/),
[NN/g: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

## Verification

- Spec helpers: 22 tests passed across `specs` and `spec-chapters`.
- Browser: full specification expansion fits at 320, 375, 768 and 1440px,
  including the long Omega caliber name. Case/Movement switching and keyboard
  Space/Enter toggling passed.
- The mobile review also exposed fixed-width standing rows overflowing at 320px.
  Meters now sit beneath labels on phones; evidence coverage gets a full row.
  Scoring logic and all collection data remain unchanged.
- Final `npm run check` and `npm run build:static` passed, including TypeScript
  and all 78 static pages. Data audits retain existing warnings.

Preview: `http://localhost:3110/watch/mqxzzmf7e5kge7`.
Branch: `codex/watch-detail-ux`, separate from the pending alerts branch.
