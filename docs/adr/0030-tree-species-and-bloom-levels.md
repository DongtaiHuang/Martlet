# 0030. Tree species and levels after full bloom

- **Status:** Accepted
- **Date:** 2026-11-24
- **Extends:** [0012](0012-progress-growth-tree.md) (one tree design, seven stages)
- **Issue:** #133

## Context

ADR 0012 gives every student the same tree, and growth stops at full bloom, which needs every landmark unlocked. Students asked to choose a kind of tree (sakura, pine, maple, willow, sequoia) and for more levels, so the tree stays worth coming back to after full bloom. The constraints from 0012 still hold: no new data or permissions, deterministic pixel art cached on the server, light on phones, and motion that respects reduced-motion settings.

## Decision

### Six species, one generator
- `TREE_SPECIES`: **classic** (the existing tree, unchanged pixel for pixel), **sakura, maple, pine, willow, sequoia** (`lib/progress.ts`).
- `components/progress/pixel-tree.ts` describes each species' canopy as shapes (ellipses, or triangular tiers for pine) plus trunk rules:
  - sakura: wide and flat
  - maple: dense and round
  - pine: tiers on a straight leader
  - willow: a dome with hanging strands
  - sequoia: a long bare red trunk under a narrow column
- The existing shading, dithering, branches, falling leaves and fruit placement apply to every species. Stages 0–2 (seed to sapling) look the same for all species.
- Each species overrides the leaf, blossom and wood colours in the colour palette. Photo fruit stays red everywhere, and the black-and-white palette keeps its greys, so there only the shape differs.

### Choosing a species
- A form on `/progress` posts to a server action that stores the species in the `martlet.tree` cookie (one year, `SameSite=Lax`). The page is server-rendered, so it needs the species at request time. A cookie does that without a database change, and the form works without JavaScript.
- Unknown values fall back to classic. The choice is cosmetic and per device; nothing is stored about the student.

### Levels after full bloom
- Full bloom still needs **every landmark** (`treeStage` unchanged). After that, `bloomLevel(meetups)` adds three levels from meetups hosted plus joined, read from the existing activity counts (ADR 0020):

  | Level | Meetups | What changes |
  |---|---|---|
  | Songbird tree | 3 | a second bird |
  | Wildflower meadow | 10 | a ring of flowers around the trunk |
  | Ancient tree | 25 | twice the blossoms and a third bird |

- `/progress?stage=6&bloom=N` previews a level, like the existing stage preview. It never changes real progress.
- Scenes are cached per (species, stage, fruit count, bloom level). Every scene stays under the existing size budget; a unit test enforces 40 KB of path data.

## Consequences

- More variety with no new tables, grants or client JavaScript beyond the form.
- The species doesn't follow a student across devices (the cookie is per browser). Moving it to the profile later needs an RPC that uses the session user.
- Not done yet: unlocking species through achievements, and seasonal variants of sakura and maple tied to ADR 0024 themes.
