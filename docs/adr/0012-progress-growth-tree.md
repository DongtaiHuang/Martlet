# 0012. Landmark progress shown as a growing pixel-art tree

- **Status:** Proposed
- **Date:** 2026-11-21
- **Builds on:** [0009](0009-landmark-photo-unlocks.md) (landmark unlocks; this is its "profile progress" follow-up)

## Context

ADR 0009 lists progress ("5 / 20 landmarks") as follow-up work. A plain progress bar on the Landmarks page didn't give students much reason to keep exploring. We want a visible reward that grows as they unlock more landmarks, something they want to show friends and that works in a demo.

Constraints:
- It must not add new data or permissions: progress and fruit come from the user's existing `landmark_unlocks` and photos (RLS from 0009).
- It must work on phones (375 px) and stay light, with no extra libraries or image assets to manage.
- Motion must respect users who prefer reduced motion.
- The landmark count will change, so growth can't be hard-coded to 6 landmarks.

## Decision

### A dedicated progress page
- New page `/progress` with its own **Progress** nav item. The progress bar ("X of N landmarks unlocked") sits at the top, then the tree, its stage name, a hint ("Unlock 1 more landmark to grow into a mature tree"), and a checklist of landmarks.
- The progress bar moves off `/landmarks`, which links to the tree instead. The home feed's Landmarks view links there too.

### Seven growth stages
- **Seed → Sprout → Sapling → Young tree → Growing tree → Mature tree → Full bloom** (`lib/progress.ts`).
- `treeStage(unlocked, total)`: seed at 0 unlocked, full bloom **only** at 100%, and every unlock in between moves the tree along (with 6 landmarks, exactly one stage per unlock). Works for any landmark count.

### The scene: one tree in a wide open field, pixel art, colour
- The tree stands **centred in a wide open field** under a big sky (clouds, distant hills, a low horizon, grass that gets denser toward the viewer, a foreground band of flowers). It starts as a seed a few pixels tall and ends filling the sky, so the change in scale is the reward.
- **One consistent design** across stages: the same trunk, branch layout, canopy clusters, shading and palette, revealed and scaled by stage. Full bloom adds blossoms and a small martlet bird.
- **Pixel art**, generated in code (`components/progress/pixel-tree.ts`): the scene is painted on a 120×60 grid and shaded with ordered (Bayer) dithering, so output is deterministic. The grid is converted to **one SVG `<path>` per colour** (row runs), about 33 KB per stage, cached per stage on the server.
- **Colour by default** (blue sky, golden field, green tree, red blossoms). The black-and-white palette is kept as an option (`<GrowthTree palette="bw" />`).
- Rendered by a **Server Component**; no client JavaScript.

### Photo fruit
- Each landmark photo the user has added hangs on the tree as a **red apple**, in unlock order (`listMyUnlocks()` in `lib/landmarks.ts`, the user's own rows only, with signed photo URLs). Canopies are wide enough at every stage to hold them; sprouts and saplings carry 1-pixel berries, young trees 2×2 apples, mature trees 3×3.
- Fruit spots are chosen inside the lower canopy by farthest-point sampling, so they spread out and keep their places as more are added. Full-bloom blossoms are pale pink so they can't be mistaken for fruit.
- Each fruit is a link (larger hit area than the fruit itself). **Hover or keyboard focus** shows a ring and a preview card (photo, landmark, caption), CSS-only. **Click** opens `/landmarks/<id>#my-photo`, where the user's photo in the gallery is scrolled to and highlighted. Phones have no hover, so a tap opens the photo directly.

### Motion (CSS only, `app/globals.css`)
- The leaves shift one pixel left and right (a pixel-art sway), falling leaves (red petals at full bloom) drop in steps, and the bird bobs.
- All motion stops, and falling leaves are hidden, under `prefers-reduced-motion: reduce`.

### Previewing stages
- The stage chips under the tree are links: `/progress?stage=N` (0–6) shows that stage **for display only**. The progress bar, checklist, and unlocks always show real data, a banner says "Previewing … Your real progress hasn't changed", and invalid values are ignored.
- Available in production (useful for demos). Nothing is stored; it is just a URL.

### Accessibility
- The SVG has `role="img"` with a label such as "Your tree: Sapling (2 of 6 landmarks unlocked)" or "Preview of the Full bloom stage".
- The progress bar uses `role="progressbar"` with values; stage chips mark the shown stage with `aria-current="step"`.

## Alternatives considered

- **Smooth vector tree in a round frame** (first iteration): clean, but the tree filled the frame at every stage, so growth didn't feel big. Replaced by the open-field scene.
- **Black and white**: tried; kept as a palette option, but colour reads better as a reward.
- **Hand-drawn image or sprite per stage** (PNG/GIF): more artistic control, but 7+ assets to produce and keep consistent, no easy palette switch, and animation would need sprite sheets.
- **Canvas or an animation library** (e.g. Lottie): needs client JavaScript and a new dependency for something CSS handles.
- **Storing the preview stage or a "demo mode" flag**: unnecessary; a URL parameter that never touches data is simpler and can't corrupt progress.

## Consequences

- Students get a visible, shareable reward for exploring, and the demo can show full bloom instantly.
- No schema, RLS, or API changes; progress is derived from existing unlocks.
- Each `/progress` load includes ~33 KB of inline SVG. Acceptable for one page; if it grows, the stages could be pre-rendered to static files.
- The art lives in code: changing the look means editing the generator (positions, palette, thresholds) rather than swapping images. Output is deterministic, so changes are easy to review by rendering all stages.
- On phones each "pixel" is only ~3 screen pixels, so the blocky look is strongest on larger screens. A coarser grid would make it chunkier but with less detail.
- Adding or removing landmarks changes how many unlocks each stage needs; full bloom always requires every landmark.
- Anyone can preview any stage via the URL. That's intentional (it's cosmetic), and the banner makes it clear it isn't their real progress.
- Touches shared UI: a sixth nav item (tight but fits at 320 px), and the Landmarks page's progress bar is replaced by a link.
