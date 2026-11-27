# 0048. McGill buildings in red on the game maps

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0046](0046-martlet-skies.md) and [0047](0047-drift-on-the-real-campus.md) (games on the campus map)

## Context

On the pixelated campus map in Martlet Skies and Martlet Drift, McGill's buildings looked like every other grey block downtown. Students asked for McGill's landmarks to stand out.

## Decision

- **Every building in the mapped McGill campus area is drawn in McGill red** (`#a6192e`) as its own 3D layer on the game maps. That's 135 buildings, such as McLennan, Leacock, Arts, Redpath, Burnside and Trottier. The footprints were taken once from OpenStreetMap (© OpenStreetMap contributors, ODbL) into `public/data/mcgill-buildings.json` (64 KB, served as a static file). Heights come from OSM `height` or `building:levels` × 3.6 m, or 14 m when neither is tagged.
- Footprints are nudged 1.5% outward and 1 m taller than the basemap's own extrusion, so the red walls sit just outside the grey ones instead of flickering against them.
- The layer is added after every style load, so it survives light/dark swaps. The Explore and Landmarks maps are unchanged.

## Consequences

- McGill's campus reads at a glance from the air and from the road.
- Buildings added or rebuilt after this snapshot won't be red until the file is regenerated with the same query: buildings inside the `amenity=university` area named McGill.
