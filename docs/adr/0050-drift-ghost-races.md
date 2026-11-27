# 0050. Martlet Drift ghost races

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0037](0037-martlet-drift.md) (server-timed scores), [0047](0047-drift-on-the-real-campus.md) (the real-street loop)

## Context

Students asked for racing against each other in Martlet Drift. Live races need lobbies, synced starts, real-time positions, and mute/block for the names shown, so they're a bigger step. Racing recorded runs ("ghosts") gives most of the fun now, needs no live connection, and its replays are reusable for live races later.

## Decision

- **Every run is recorded** 10 times a second as `[x×10, z×10, heading×1000, banked score÷10]` smallints (about 900 samples, around 7 KB). The banked score never goes down; the last sample carries the final score.
- **A new best keeps its replay as your ghost** (`drift_ghosts`, one per student). `submit_drift_run` wraps the existing `submit_drift_score`, so timing and score limits are unchanged (ADR 0037). It stores the ghost only when the path is plausible: no jump faster than the car's top speed (with slack) between samples, a score that never drops, and a final score that matches the submitted one. Nobody can write the table directly.
- **Racing:** before a run you pick the top ghosts (with display names) or your own best. The ghost drives as a see-through coupe in its own paint, appears as a grey arrow on the minimap, and the HUD shows your lead or deficit in points at the same moment of its run. Ghosts pass through you.
- Guests can drive but don't see or save ghosts, the same as the leaderboard.

## Consequences

- A social race that works any time, even alone.
- A determined cheater could still craft a plausible replay with a fake score, as they could a fake score before. The same server limits apply.
- Live multiplayer races can reuse the sample format for their position stream.
