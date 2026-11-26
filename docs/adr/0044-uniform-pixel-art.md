# 0044. One pixel-art style for the games

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0012](0012-progress-growth-tree.md) and [0030](0030-tree-species-and-bloom-levels.md) (pixel tree), [0013](0013-landmark-map-tower-pins.md) (pixel towers and chick), [0024](0024-seasonal-themes-and-scenes.md) (pixel sprites in code)
- **Changes:** [0010](0010-martlet-avatar-expression-tracking.md) (low-poly avatar look) and [0037](0037-martlet-drift.md) (Drift's look), as the later PRs land

## Context

Marty and his nest, the landmark towers, the map chick, the seasonal scenes and the progress tree all share one look: pixel art generated in code as crisp SVG. The games don't. Martlet Flight draws smooth vector shapes, Blackjack uses plain HTML cards, and Martlet Drift and the 3D avatar are smooth low-poly three.js scenes. The avatar's default plumage (navy) doesn't match Marty's burgundy either. The same sprite code is also copied into five files, each with its own palette.

## Decision

- **One helper and one palette.** `lib/pixel/sprite.ts` holds the grid-to-sprite code (letter grids, outlines, overlays, one path per colour), drawn as SVG or onto a canvas. `lib/pixel/palette.ts` holds Marty's colours, the campus scenery colours shared with the towers and the tree, and day and night skies. New pixel art uses these. The existing copies can move onto them when those files are next touched.
- **2D games draw pixel sprites.** Martlet Flight draws everything on a small canvas, one canvas pixel per art pixel (2 game units each). That canvas is scaled up with smoothing off. The game uses a compact Marty with three wing frames and the avatar accessories, plus pixel columns, campus buildings, Mount Royal, clouds and a pixel digit font. Physics and hitboxes are unchanged. Blackjack's cards, chips and table get pixel sprites in a later PR.
- **3D scenes are pixelated, not replaced.** Drift and the MediaPipe avatar keep three.js. They render at low resolution with nearest-neighbour upscaling, flat colours from the palette and no smooth shading, so face and arm tracking keep working.
- **Marty is the default plumage.** A "Marty" plumage (burgundy and cream) becomes the default. The other plumages stay as options, drawn with Marty's outline, cream chest and coral beak, and saved choices keep working.

## Consequences

- The whole site reads as one game world, and new pixel art takes less code.
- Pixel scaling isn't always a whole number on every screen, so a few art pixels may be one device pixel wider than others. That's the same trade-off as the pixel tree (ADR 0012).
- Hand-drawn sprites live in code as letter grids, which is easy to review in a diff and needs no image files. Changing art means editing those grids.
