# 0048. McGill buildings highlighted in red on the campus maps

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0046](0046-martlet-skies.md) and [0047](0047-drift-on-the-real-campus.md) (games on the campus map)

## Context

On the 3D campus maps, McGill's buildings looked like every other grey block downtown. Students asked for McGill's landmarks to stand out, in the games and on the regular maps.

## Decision

- **The buildings:** every building in the mapped McGill campus area, 135 of them (McLennan, Leacock, Arts, Redpath, Burnside, Trottier…). Their footprints were taken once from OpenStreetMap (© OpenStreetMap contributors, ODbL) into `public/data/mcgill-buildings.json` (64 KB, a static file). Heights come from OSM `height` or `building:levels` × 3.6 m, or 14 m when untagged, plus 1 m. Footprints are set 2% outside the walls so they don't flicker against the basemap's own buildings.
- **Two styles** (`components/map/mcgill-buildings.ts`):
  - **Outline**, on Explore, Landmarks and meetup maps: a crisp McGill-red line around each footprint. The buildings keep the basemap's colour and height, which keeps the reference maps clean.
  - **Solid**, in Martlet Skies and Drift: the buildings themselves in McGill red. On the pixelated game maps a thin outline is lost, partly hidden by the walls, while solid red reads clearly from the air and the road.
- A true 3D outline (red roof edges) was tried and dropped: it needs the basemap's exact building heights, and with estimated heights the rims floated or were buried.
- The highlight is re-added after every style load, so it survives light/dark swaps.

## Consequences

- Campus reads at a glance on every map.
- Buildings added or rebuilt after this snapshot aren't highlighted until the file is regenerated with the same query: buildings inside the `amenity=university` area named McGill.
