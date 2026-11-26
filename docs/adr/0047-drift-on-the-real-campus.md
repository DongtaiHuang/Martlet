# 0047. Martlet Drift on the real campus

- **Status:** Accepted
- **Date:** 2026-11-26
- **Changes:** [0037](0037-martlet-drift.md) (Drift's made-up loop, ground, trees and buildings)
- **Builds on:** [0044](0044-uniform-pixel-art.md) (pixel art), [0046](0046-martlet-skies.md) (the pixelated campus map in a game)

## Context

Martlet Drift raced a made-up loop in its own three.js world. Students asked to drift on the real campus, the same map as Explore and Martlet Skies.

## Decision

- **Real streets.** The track is a loop of real streets: Sherbrooke (McTavish to University), up University to Pine, down Pine to McTavish, and down McTavish back to Sherbrooke (about 1.8 km). Its shape was taken once from OpenStreetMap (© OpenStreetMap contributors, ODbL), converted to metres around a fixed origin and resampled every 30 m (`lib/drift-streets.ts`). Resampling rounds each junction into a bend. The run starts 90 m up Sherbrooke, on the straight.
- **The map underneath.** A pixelated, non-interactive MapLibre map (as in ADR 0046) sits under a transparent three.js layer. Every frame, the map's camera is placed at the three.js chase camera's position, looking at the same point, with the same 60° vertical field of view (`calculateCameraOptionsFromTo`). The real streets and buildings therefore line up with the coupe. The made-up grass, trees and buildings are gone. The road ribbon, kerbs and start line stay on top as the track to follow.
- **Same game.** The physics, scoring, 90-second runs, gamepad, paints and the server-timed leaderboard (ADR 0037) are unchanged. The server checks timing and the points-per-second limit, not the track.

## Consequences

- Drifting happens on streets students walk every day, in the site's pixel style.
- The car and road are drawn on their own layer, so map buildings never hide the car (rarely noticeable from a chase camera). Real elevation, such as University's climb to Pine, isn't modelled: the map is flat.
- Leaderboard scores from the old loop stay listed; the new track is a different length, so times and scores aren't directly comparable. Resetting the board would be a separate decision.
- Like the other maps, Drift needs the OpenFreeMap tiles. Without them the sky-coloured background and the track still show.
