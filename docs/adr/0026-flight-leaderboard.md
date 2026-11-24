# 0026. Martlet Flight leaderboard

- **Status:** Accepted
- **Date:** 2026-11-22

## Context
Students want to compare Martlet Flight scores. The game runs in the browser, so any score it reports could be faked.

## Decision
- **One best score per signed-in student** (`flight_scores`, migration 016). Guests can still play, and their best stays in the browser.
- **The server times every run.** Starting a game calls `start_flight_run()`, which stores a run id and start time. Game over calls `submit_flight_score(run, score)`, which:
  - accepts each run **once**;
  - rejects scores that are impossible for the time played (more than 4 points per second plus 3) or above 2000;
  - takes the player from `auth.uid()`.
- **No direct table access.** Reads go through `get_flight_leaderboard()`, which returns display names, scores and ranks, plus the caller's own rank. Signed-in users only.

## Consequences
- A determined cheater could still script a "perfect" run in real time. That's acceptable for a campus mini-game.
- Moderators (ADR 0027) can remove abusive display names if needed.
