# 0046. Martlet Skies

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0006](0006-maplibre-configurable-style.md) (MapLibre basemap), [0008](0008-client-side-locate-me.md) (no real locations shared), [0013](0013-landmark-map-tower-pins.md) (pixel tower pins), [0044](0044-uniform-pixel-art.md) (pixel art)

## Context

Students asked for an open-world way to explore campus as their martlet. We already have a 3D campus map (MapLibre with OpenStreetMap buildings), pixel landmark towers and meetups on the map, and the pixel art style from ADR 0044.

## Decision

- **A single-player flying game on the real campus map** at `/play/skies`. The map is the same MapLibre basemap as Explore and Landmarks, with `pixelRatio` set to a third (one art pixel is 3 CSS pixels, as in ADR 0044) and CSS `image-rendering: pixelated`. Street and place labels are hidden because they're illegible when pixelated. The map isn't draggable: the camera follows the bird (pitched 62°, bearing equal to the bird's heading, zoom set by altitude).
- **Your pixel Marty, seen from behind**, in your avatar plumage, with three wing frames, banking into turns and casting a shadow that shrinks with height. Arrow keys or WASD steer, climb and dive, Shift or Space boosts, P pauses. Phones get on-screen pads.
- **Visit landmarks:** fly within a landmark's radius (at least 35 m) to visit it. A pop-up links to its page, and an arrow points to the nearest landmark you haven't visited. Visits are stored only in this browser. Visiting every landmark earns the hidden "Bird's-eye view" achievement. Visiting from the air never unlocks a landmark, which still needs the photo challenge (ADR 0009).
- **Find meetups:** upcoming meetups at mapped spots show as pixel speech bubbles. Flying within 45 m lists the meetups there with links. Custom-location meetups have no coordinates (ADR 0022), so they don't appear.
- **Play area:** downtown campus, from Sherbrooke Street to the foot of Mount Royal. At the edge the bird is held inside and turned back toward the start.
- **Privacy:** the bird's position is a game position, not the player's. Nothing is sent anywhere while flying. Multiplayer (seeing other students' birds) is left for later, with its own ADR.

## Consequences

- Students get a playful reason to learn where landmarks and meetups are.
- The game depends on the public OpenFreeMap tiles like the other maps. If the tiles fail, the sky-coloured background still shows and the HUD keeps working.
- Low flying near tall buildings can fill the view with a wall: there's no collision. Rooftop collision or a minimum altitude near tall buildings would need building heights from the tiles, which is left as a follow-up.
