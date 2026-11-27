# 0052. Drift tracks

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0047](0047-drift-on-the-real-campus.md) (real-street loop), [0050](0050-drift-ghost-races.md) (ghosts)

## Context

Martlet Drift had one track, a 1.8 km loop on the streets around campus. Students asked to drive into campus itself. Changing the one track would make existing scores and ghosts meaningless.

## Decision

- **Two tracks:** the street loop, unchanged, and a **Campus** loop (about 850 m). It goes up Sherbrooke, in through the Roddick Gates, up the main avenue past the Arts Building, west by Leacock and down McTavish. It's built once from OpenStreetMap paths into `lib/drift-campus.ts`, with the same axes and origin as the street loop.
- **Per track:** migration 036 adds `track` to scores, runs and ghosts. Each student has one best and one ghost per track. A run records its track when it starts, so a score can't be moved to another track.
- **Compatible:** existing rows become the street loop's. The old function signatures still mean the street loop, so an older app keeps working while the migration rolls out.
- You pick the track on the start card; the leaderboard has a tab for each.

## Consequences

- Adding a track later is a new loop file, a `TRACKS` entry and a one-line change to the check constraints.
- Driving through campus is a game; cars don't belong on lower campus in real life.
