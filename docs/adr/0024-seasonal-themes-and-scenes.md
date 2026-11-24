# 0024. Seasonal themes with decorative scenes

- **Status:** Accepted
- **Date:** 2026-11-22
- **Builds on:** [0014](0014-theme-tokens-and-dark-mode.md) (colour tokens and themes), [0019](0019-achievements.md) (achievements)

## Context

ADR 0014 made themes a set of colour variables. Students asked for seasonal themes with more character: falling snow, autumn leaves, a beach, Chinese New Year. That needs moving, clickable decorations, and Marty (the mascot) reacting to them. Colours alone can't do that.

Constraints: text contrast must not get worse, the decorations must not get in the way of using the app, and people who turn on "reduce motion" must not get animation.

## Decision

### Four seasonal themes, as ordinary themes
- **Summer, Fall, Winter and Chinese New Year** are added to `lib/theme.ts` and `app/theme.css` exactly like the other themes (light and dark palettes, checked by `scripts/check-contrast.mjs`). Nothing in the components changes for the colours.

### A decorative scene per seasonal theme
- `components/seasons/SeasonalScene.tsx`, mounted once in the root layout, watches `data-theme` and draws that season's scene (nothing for other themes). Pixel art is generated in code (`season-sprites.ts`), like Marty and the progress tree.
- **Behind the page content** (it never covers text): Winter snowfall (CSS) and moonlight; falling leaves; Summer sun rays and falling rubber ducks; Chinese New Year lanterns, goats and red pockets. Seasonal themes make the page wrapper's background transparent so this layer shows in the gaps.
- **Along the bottom of the screen**, in front, clickable: leaf piles, snowmen, floating ducks and red-pocket mounds build up over time. Clicking clears them (dissolve, melt, pop, burst). They keep clear of Marty's nest. These are buttons outside the tab order: purely playful, nothing depends on them.
- State lives only in the browser for the current visit; nothing is stored or sent.

### Marty joins in, through events
- The scene finds Marty by a `data-marty` attribute and reads where he is. It asks him to act with window events, so neither component reaches into the other:
  - `martlet:burrow`: he stops, dives into a mound (snow, leaves or water), peeks out, hops out, and the mound bursts.
  - `martlet:peck`: he stops and pecks (ducks, red pockets).
- Marty smashes snowmen he crosses and scatters leaf piles when dragged through them. Picking him up cancels any move.

### Achievement
- Clicking a red-pocket mound earns a new hidden achievement, **Lucky red pocket** (`red-pocket`), through the existing `earn()` path.

### Motion and accessibility
- Under `prefers-reduced-motion`, nothing falls, sways, shimmers or flies, and Marty doesn't burrow or peck; piles and mounds still build up quietly and can still be cleared with a plain fade.

## Alternatives considered

- **Image or video backgrounds:** heavier, harder to keep crisp and to theme for dark mode, and not interactive.
- **A canvas or particle library:** more efficient for thousands of particles, but we have tens, and DOM/CSS keeps the pixel art crisp and the clickable parts accessible to the browser.
- **Decorations in front of the content:** more visible, but they'd pass over text and hurt readability.

## Consequences

- Seasonal themes feel alive and give a reason to try the theme picker; the demo has a fun moment.
- More moving parts on every page while a seasonal theme is on: a few dozen animated elements and one animation-frame loop. Other themes render nothing extra.
- Piles and mounds at the bottom can briefly cover a control there until clicked away or scrolled past.
- `FlyingMartlet.tsx` gained the `data-marty` hook and the two event handlers; future scenes should use those events rather than reaching into Marty.
